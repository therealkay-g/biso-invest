-- ============================================================================
-- BISO INVEST — MIGRATION 030 : DAILY PROFIT = 10% DU CAPITAL
-- ============================================================================
-- DÉPLOIEMENT : appliquer ce fichier APRÈS les migrations 001 à 029 sur une
-- base déjà déployée.  Il est idempotent et corrige les objets SQL actifs sans
-- modifier les snapshots historiques des transactions déjà créditées.
--
-- Règle officielle et immuable :
--   daily_profit = round(investments.total_amount * 0.10, 2)
-- pour chaque date métier éligible.  La date métier est le calendrier de
-- Africa/Kinshasa.  Le produit, sa ligne monthly_return et ses prix futurs ne
-- participent jamais au calcul d'un claim.
--
-- Cette migration :
--   1) ajoute les snapshots daily_profit et ends_at aux investissements ;
--   2) remplace purchase_investment et le trigger des cycles ;
--   3) installe claim_daily_profit(uuid), atomique et limité au propriétaire ;
--   4) retire les anciennes RPC qui permettaient un autre chemin de crédit ;
--   5) garde l'accrual interne non appelable par les clients.
-- ============================================================================

-- ============================================================================
-- 1. SNAPSHOTS FINANCIERS DE L'INVESTISSEMENT
-- ============================================================================
-- total_amount reste la seule capitalisation contractuelle.  daily_profit et
-- ends_at sont des snapshots serveur : les changements de produit ne les
-- modifient jamais.
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS daily_profit numeric(15,2);
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS ends_at timestamp with time zone;

-- Backfill idempotent des bases existantes.  On recalcule aussi une valeur
-- historique absente ou non conforme afin que la contrainte ci-dessous soit
-- toujours applicable.
UPDATE public.investments
SET daily_profit = round(total_amount * 0.10, 2)
WHERE daily_profit IS NULL
   OR daily_profit IS DISTINCT FROM round(total_amount * 0.10, 2);

UPDATE public.investments
SET ends_at = created_at
              + (coalesce(duration_months, 3) * interval '1 month')
WHERE ends_at IS NULL
   OR ends_at IS DISTINCT FROM (
         created_at
         + (coalesce(duration_months, 3) * interval '1 month')
       );

-- total_expected est le contrat total cohérent avec les claims quotidiens :
-- nombre de dates calendaires éligibles × bénéfice quotidien snapshot.
UPDATE public.investments AS i
SET total_expected = round(
      i.daily_profit * greatest(
        0,
        (i.ends_at AT TIME ZONE 'Africa/Kinshasa')::date
        - (i.created_at AT TIME ZONE 'Africa/Kinshasa')::date
      ),
      2
    )
WHERE i.total_expected IS DISTINCT FROM round(
      i.daily_profit * greatest(
        0,
        (i.ends_at AT TIME ZONE 'Africa/Kinshasa')::date
        - (i.created_at AT TIME ZONE 'Africa/Kinshasa')::date
      ),
      2
    );

ALTER TABLE public.investments
  ALTER COLUMN daily_profit SET NOT NULL;
ALTER TABLE public.investments
  ALTER COLUMN ends_at SET NOT NULL;
ALTER TABLE public.investments
  ALTER COLUMN duration_months SET DEFAULT 3;
ALTER TABLE public.investments
  ALTER COLUMN remaining_installments SET DEFAULT 3;

-- Compatibilité catalogue uniquement : l'affichage reste cohérent avec
-- 10% × 90 jours.  Aucun calcul de claim ne lit cette colonne.
UPDATE public.products
SET duration_months = 3,
    monthly_return = price,
    total_returns = round(price * 0.10 * 90, 2);

-- La nouvelle politique commerciale est fixée à 3 mois.  La contrainte est
-- posée après la normalisation afin qu'une base historique ne soit pas bloquée.
ALTER TABLE public.products
  ALTER COLUMN duration_months SET DEFAULT 3;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_duration_three_months_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_duration_three_months_check
  CHECK (duration_months = 3);

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_price_positive_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_price_positive_check
  CHECK (price > 0);

ALTER TABLE public.investments
  ALTER COLUMN duration_months SET DEFAULT 3;

ALTER TABLE public.investments
  DROP CONSTRAINT IF EXISTS investments_daily_profit_10_percent_check;
ALTER TABLE public.investments
  ADD CONSTRAINT investments_daily_profit_10_percent_check
  CHECK (daily_profit = round(total_amount * 0.10, 2));

COMMENT ON COLUMN public.investments.total_amount IS
  'Capital total immuable de la souscription; base de la règle quotidienne 10%.';
COMMENT ON COLUMN public.investments.daily_profit IS
  'Snapshot immuable: round(total_amount * 0.10, 2), crédité une fois par date métier Africa/Kinshasa.';
COMMENT ON COLUMN public.investments.ends_at IS
  'Fin exclusive du contrat, snapshotée à la souscription et utilisée pour le contrôle d''éligibilité.';
COMMENT ON COLUMN public.investments.total_expected IS
  'Total contractuel attendu, calculé à partir des dates éligibles et du snapshot daily_profit.';

CREATE INDEX IF NOT EXISTS idx_investments_active_ends_at
  ON public.investments (user_id, ends_at)
  WHERE status = 'ACTIVE';

-- today_earned était cumulé historiquement.  On lui ajoute une date métier
-- afin que le Wallet n'affiche pas les gains d'un ancien jour comme « du jour ».
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS today_earned_date date;

UPDATE public.wallets
SET today_earned_date = (now() AT TIME ZONE 'Africa/Kinshasa')::date,
    today_earned = 0
WHERE today_earned_date IS NULL;

-- Helper SQL unique pour la règle financière; il n'est pas exposé aux
-- clients.  Les fonctions server-side conservent aussi l'expression visible
-- afin que le calcul reste auditable dans chaque snapshot.
CREATE OR REPLACE FUNCTION public.calculate_daily_profit(p_total_amount numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = public, pg_temp
AS $$
  SELECT round(p_total_amount * 0.10, 2);
$$;
REVOKE EXECUTE ON FUNCTION public.calculate_daily_profit(numeric)
  FROM public, anon, authenticated;

COMMENT ON FUNCTION public.calculate_daily_profit(numeric) IS
  'Règle financière serveur: round(capital total * 0.10, 2); aucune valeur produit n''est consultée.';

-- ============================================================================
-- 2. GARDEFOUS D'INSERTION ET D'IMMUTABILITÉ
-- ============================================================================
-- Ces triggers garantissent que même une insertion SQL directe ne peut pas
-- introduire un taux ou une fin de contrat différent de la règle officielle.
CREATE OR REPLACE FUNCTION public.set_investment_financial_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_duration_months int;
  v_eligible_days int;
BEGIN
  IF NEW.total_amount IS NULL THEN
    RAISE EXCEPTION 'Le capital total est obligatoire';
  END IF;

  NEW.created_at := coalesce(NEW.created_at, now());
  v_duration_months := least(
    greatest(coalesce(NEW.duration_months, 3), 1),
    3
  );
  NEW.duration_months := v_duration_months;
  NEW.remaining_installments := v_duration_months;

  -- Le serveur recalcule toujours les snapshots; aucune valeur client ou
  -- produit ne peut les remplacer.
  NEW.daily_profit := round(NEW.total_amount * 0.10, 2);
  NEW.ends_at := NEW.created_at + (v_duration_months * interval '1 month');
  v_eligible_days := greatest(
    0,
    (NEW.ends_at AT TIME ZONE 'Africa/Kinshasa')::date
    - (NEW.created_at AT TIME ZONE 'Africa/Kinshasa')::date
  );
  NEW.total_expected := round(NEW.daily_profit * v_eligible_days, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_investment_financial_snapshots ON public.investments;
CREATE TRIGGER trg_set_investment_financial_snapshots
  BEFORE INSERT ON public.investments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_investment_financial_snapshots();

CREATE OR REPLACE FUNCTION public.protect_investment_financial_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.total_amount IS DISTINCT FROM NEW.total_amount
     OR OLD.daily_profit IS DISTINCT FROM NEW.daily_profit
     OR OLD.ends_at IS DISTINCT FROM NEW.ends_at
     OR OLD.total_expected IS DISTINCT FROM NEW.total_expected
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION
      'Les snapshots financiers d''un investissement sont immuables'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_investment_financial_snapshots ON public.investments;
CREATE TRIGGER trg_protect_investment_financial_snapshots
  BEFORE UPDATE ON public.investments
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_investment_financial_snapshots();

-- ============================================================================
-- 3. CYCLE INITIAL : 10% DU SNAPSHOT INVESTMENT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.init_investment_cycles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_daily_profit numeric(15,2);
  v_cycle_end timestamp with time zone;
BEGIN
  -- Le trigger est volontairement basé sur NEW.total_amount, jamais sur
  -- products.monthly_return ou sur le produit courant.
  v_daily_profit := round(NEW.total_amount * 0.10, 2);
  v_cycle_end := NEW.created_at + interval '1 month';
  IF NEW.ends_at IS NOT NULL AND v_cycle_end > NEW.ends_at THEN
    v_cycle_end := NEW.ends_at;
  END IF;
  IF v_cycle_end <= NEW.created_at THEN
    v_cycle_end := NEW.created_at + interval '1 day';
  END IF;

  INSERT INTO public.investment_cycles (
    investment_id, cycle_number, cycle_start_date, cycle_end_date,
    daily_profit, accumulated_profit, withdrawn_profit,
    last_accrual_date, status
  )
  VALUES (
    NEW.id,
    1,
    NEW.created_at,
    v_cycle_end,
    v_daily_profit,
    0.00,
    0.00,
    NEW.created_at,
    'ACTIVE'
  )
  ON CONFLICT (investment_id, cycle_number) DO UPDATE
    SET daily_profit = EXCLUDED.daily_profit;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_investment_created_init_cycles ON public.investments;
CREATE TRIGGER on_investment_created_init_cycles
  AFTER INSERT ON public.investments
  FOR EACH ROW
  EXECUTE FUNCTION public.init_investment_cycles();

-- Reconcilier les cycles déjà déployés avec le capital snapshot.  Les cycles
-- 4..12 hérités sont terminés, jamais utilisés pour un nouveau claim.
UPDATE public.investment_cycles AS c
SET daily_profit = round(i.total_amount * 0.10, 2)
FROM public.investments AS i
WHERE i.id = c.investment_id
  AND c.daily_profit IS DISTINCT FROM round(i.total_amount * 0.10, 2);

UPDATE public.investment_cycles
SET status = 'COMPLETED'
WHERE cycle_number > 3
  AND status = 'ACTIVE';

-- Les anciens investissements sans cycle reçoivent le même cycle initial.
INSERT INTO public.investment_cycles (
  investment_id, cycle_number, cycle_start_date, cycle_end_date,
  daily_profit, accumulated_profit, withdrawn_profit,
  last_accrual_date, status
)
SELECT
  i.id,
  1,
  i.created_at,
  least(i.created_at + interval '1 month', i.ends_at),
  i.daily_profit,
  0.00,
  0.00,
  i.created_at,
  'ACTIVE'
FROM public.investments AS i
WHERE NOT EXISTS (
  SELECT 1
  FROM public.investment_cycles AS c
  WHERE c.investment_id = i.id
)
ON CONFLICT (investment_id, cycle_number) DO NOTHING;

-- ============================================================================
-- 4. NOTIFICATIONS : INDEX PARTIEL ET DATE MÉTIER
-- ============================================================================
-- 018 a déjà ajouté la colonne; ces instructions rendent aussi 030 autonome
-- sur une base où la version historique de 018 n'a pas été rejouée.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS reference_date date;

-- L'ancien index (user,type,reference) bloquait tous les jours après le
-- premier profit.  On le réserve aux événements non-profit et on laisse un
-- index distinct gérer (investment, business_date).
DROP INDEX IF EXISTS public.uniq_notif_user_type_ref;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notif_user_type_ref
  ON public.notifications (user_id, type, reference_id)
  WHERE reference_id IS NOT NULL AND type <> 'profit';

DROP INDEX IF EXISTS public.uniq_notif_user_type_ref_date;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notif_user_type_ref_date
  ON public.notifications (user_id, type, reference_id, reference_date)
  WHERE reference_id IS NOT NULL AND reference_date IS NOT NULL;

-- ============================================================================
-- 5. PURCHASE_INVESTMENT : SNAPSHOT DU CONTRAT ET DU BÉNÉFICE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.purchase_investment(
  p_product_id uuid,
  p_quantity int,
  p_idempotency_key varchar DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_product record;
  v_wallet record;
  v_existing_inv record;
  v_total_cost numeric(15,2);
  v_daily_profit numeric(15,2);
  v_duration_months int;
  v_monthly_return numeric(15,2);
  v_total_expected numeric(15,2);
  v_eligible_days int;
  v_created_at timestamp with time zone := now();
  v_ends_at timestamp with time zone;
  v_next_cycle_end timestamp with time zone;
  v_new_balance numeric(15,2);
  v_reference varchar;
  v_tx_id uuid;
  v_inv_id uuid;
  v_current_vip varchar;
  v_qualified_vip varchar;
  v_vip_limit int;
  v_user_pack_count int;
  v_projected_invested numeric(15,2);
  v_idempotency_key varchar(100);
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantité invalide';
  END IF;

  v_idempotency_key := coalesce(
    nullif(trim(p_idempotency_key), ''),
    'INV-KEY-' || gen_random_uuid()::text
  );

  -- Une clé déjà utilisée par cet utilisateur retourne le même investissement,
  -- sans second débit.  La propriété est inclus dans la recherche.
  SELECT * INTO v_existing_inv
  FROM public.investments
  WHERE idempotency_key = v_idempotency_key
    AND user_id = v_user_id;

  IF FOUND THEN
    RETURN json_build_object(
      'success', true,
      'investment_id', v_existing_inv.id,
      'idempotent_replay', true,
      'total_cost', v_existing_inv.total_amount,
      'daily_profit', v_existing_inv.daily_profit,
      'ends_at', v_existing_inv.ends_at,
      'total_expected', v_existing_inv.total_expected
    );
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id
    AND is_active = true
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Produit introuvable ou inactif';
  END IF;
  IF p_quantity > v_product.purchase_limit THEN
    RAISE EXCEPTION 'Dépassement de la limite d''achat pour ce pack';
  END IF;

  -- Le capital est calculé une seule fois à partir du prix lu sous verrou de
  -- la transaction; il ne sera plus relu dans products par les claims.
  v_total_cost := round(v_product.price * p_quantity, 2);
  v_duration_months := least(
    greatest(coalesce(v_product.duration_months, 3), 1),
    3
  );
  v_ends_at := v_created_at + (v_duration_months * interval '1 month');
  v_next_cycle_end := v_created_at + interval '1 month';

  -- Règle 10% : snapshot à deux décimales, jamais une division par les jours.
  v_daily_profit := round(v_total_cost * 0.10, 2);
  v_eligible_days := greatest(
    0,
    (v_ends_at AT TIME ZONE 'Africa/Kinshasa')::date
    - (v_created_at AT TIME ZONE 'Africa/Kinshasa')::date
  );
  v_total_expected := round(v_daily_profit * v_eligible_days, 2);

  -- Snapshot historique conservé pour les écrans existants.  Il n'est pas
  -- utilisé par la logique de profit, qui lit daily_profit/total_amount.
  v_monthly_return := v_total_cost;

  -- Les contrats expirés ne doivent pas continuer à consommer le plafond VIP.
  -- Cette normalisation est faite avant le verrou du wallet afin de garder
  -- un ordre d'acquisition uniforme avec les claims (investment -> wallet).
  UPDATE public.investments AS i
  SET status = 'COMPLETED',
      remaining_installments = 0
  WHERE i.user_id = v_user_id
    AND i.status = 'ACTIVE'
    AND (
      i.ends_at <= now()
      OR (i.ends_at AT TIME ZONE 'Africa/Kinshasa')::date
           <= (now() AT TIME ZONE 'Africa/Kinshasa')::date
    );

  UPDATE public.investment_cycles AS c
  SET status = 'COMPLETED'
  FROM public.investments AS i
  WHERE c.investment_id = i.id
    AND i.user_id = v_user_id
    AND i.status = 'COMPLETED'
    AND c.status = 'ACTIVE';

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_wallet.balance < v_total_cost THEN
    RAISE EXCEPTION 'Solde insuffisant dans votre portefeuille';
  END IF;

  v_projected_invested := v_wallet.total_invested + v_total_cost;
  SELECT level_name INTO v_qualified_vip
  FROM public.vip_levels
  WHERE is_active = true
    AND min_investment <= v_projected_invested
  ORDER BY display_order DESC
  LIMIT 1;

  SELECT current_vip INTO v_current_vip
  FROM public.profiles
  WHERE id = v_user_id;

  SELECT max_packs INTO v_vip_limit
  FROM public.vip_levels
  WHERE level_name = coalesce(v_qualified_vip, v_current_vip, 'VIP0');
  v_vip_limit := coalesce(v_vip_limit, 1);

  SELECT coalesce(sum(i.quantity), 0) INTO v_user_pack_count
  FROM public.investments AS i
  WHERE i.user_id = v_user_id
    AND i.product_id = p_product_id
    AND i.status = 'ACTIVE'
    AND i.ends_at > now()
    AND (i.ends_at AT TIME ZONE 'Africa/Kinshasa')::date
        > (now() AT TIME ZONE 'Africa/Kinshasa')::date;
  IF (v_user_pack_count + p_quantity) > v_vip_limit THEN
    RAISE EXCEPTION
      'Dépassement de la limite autorisée (% packs pour votre niveau %)',
      v_vip_limit,
      coalesce(v_qualified_vip, v_current_vip, 'VIP0');
  END IF;

  v_new_balance := round(v_wallet.balance - v_total_cost, 2);
  v_reference := 'INV-' || upper(
    substring(md5(random()::text || clock_timestamp()::text) from 1 for 10)
  );

  UPDATE public.wallets
  SET balance = v_new_balance,
      total_invested = total_invested + v_total_cost,
      total_assets = total_assets + v_total_cost,
      updated_at = now()
  WHERE user_id = v_user_id;

  INSERT INTO public.wallet_transactions (
    user_id, type, amount, balance_before, balance_after,
    reference, description, status
  )
  VALUES (
    v_user_id,
    'INVESTMENT',
    v_total_cost,
    v_wallet.balance,
    v_new_balance,
    v_reference,
    'Souscription ' || p_quantity || 'x ' || v_product.name
      || ' — bénéfice quotidien snapshot 10%',
    'COMPLETED'
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO public.investments (
    user_id, product_id, quantity, total_amount, monthly_return,
    duration_months, paid_installments, remaining_installments,
    next_payment_date, total_expected, status, idempotency_key,
    created_at, daily_profit, ends_at
  )
  VALUES (
    v_user_id, p_product_id, p_quantity, v_total_cost, v_monthly_return,
    v_duration_months, 0, v_duration_months, v_next_cycle_end,
    v_total_expected, 'ACTIVE', v_idempotency_key,
    v_created_at, v_daily_profit, v_ends_at
  )
  RETURNING id INTO v_inv_id;

  PERFORM public.evaluate_and_update_user_vip(v_user_id);
  PERFORM public.distribute_commissions(v_user_id, v_total_cost, v_tx_id);

  INSERT INTO public.admin_logs (admin_id, action, target_object, new_value)
  VALUES (
    NULL,
    'PURCHASE_INVESTMENT',
    'investments',
    'User ' || v_user_id || ' souscrit ' || p_quantity || 'x '
      || v_product.name || ' pour ' || v_total_cost
      || ' FC; daily_profit=' || v_daily_profit
  );

  RETURN json_build_object(
    'success', true,
    'investment_id', v_inv_id,
    'total_cost', v_total_cost,
    'daily_profit', v_daily_profit,
    'ends_at', v_ends_at,
    'total_expected', v_total_expected,
    'reference', v_reference
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_investment(uuid, int, varchar)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purchase_investment(uuid, int, varchar)
  TO authenticated;

COMMENT ON FUNCTION public.purchase_investment(uuid, int, varchar) IS
  'Souscription atomique; snapshot daily_profit = round(total_amount * 0.10, 2), ends_at et total_expected.';

-- L'ancienne surcharge sans clé d'idempotence ne doit plus être exposée.
DROP FUNCTION IF EXISTS public.purchase_investment(uuid, int);

-- ============================================================================
-- 6. ACCRUAL INTERNE : 3 CYCLES ET DAILY_PROFIT DU CYCLE
-- ============================================================================
-- Cette fonction ne crédite pas un wallet.  Elle est conservée pour le
-- bookkeeping historique et appelle uniquement le snapshot de chaque cycle.
CREATE OR REPLACE FUNCTION public.accrual_investment_yields(p_investment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inv record;
  v_cycle record;
  v_now timestamp with time zone := now();
  v_accrual_until timestamp with time zone;
  v_next_end timestamp with time zone;
  v_contract_end timestamp with time zone;
  v_days_diff int;
  v_max_cycles int := 3;
BEGIN
  SELECT * INTO v_inv
  FROM public.investments
  WHERE id = p_investment_id
  FOR UPDATE;
  IF NOT FOUND OR v_inv.status <> 'ACTIVE' THEN
    RETURN;
  END IF;

  v_max_cycles := least(greatest(coalesce(v_inv.duration_months, 3), 1), 3);
  v_contract_end := coalesce(
    v_inv.ends_at,
    v_inv.created_at + (v_max_cycles * interval '1 month')
  );

  LOOP
    SELECT * INTO v_cycle
    FROM public.investment_cycles
    WHERE investment_id = p_investment_id
      AND status = 'ACTIVE'
    ORDER BY cycle_number ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND OR v_cycle.cycle_number > v_max_cycles THEN
      EXIT;
    END IF;

    IF v_now >= v_cycle.cycle_end_date THEN
      v_accrual_until := least(v_now, v_cycle.cycle_end_date);
      v_days_diff := greatest(
        0,
        floor(extract(epoch FROM (v_accrual_until - v_cycle.last_accrual_date)) / 86400)::int
      );
      IF v_days_diff > 0 THEN
        UPDATE public.investment_cycles
        SET accumulated_profit = accumulated_profit
              + (v_days_diff * v_cycle.daily_profit),
            last_accrual_date = v_accrual_until
        WHERE id = v_cycle.id;
      END IF;

      UPDATE public.investment_cycles
      SET status = 'COMPLETED'
      WHERE id = v_cycle.id;

      EXIT WHEN v_cycle.cycle_number >= v_max_cycles
        OR v_cycle.cycle_end_date >= v_contract_end;

      v_next_end := v_inv.created_at
        + ((v_cycle.cycle_number + 1) * interval '1 month');
      IF v_next_end > v_contract_end THEN
        v_next_end := v_contract_end;
      END IF;
      IF v_next_end > v_cycle.cycle_end_date THEN
        INSERT INTO public.investment_cycles (
          investment_id, cycle_number, cycle_start_date, cycle_end_date,
          daily_profit, accumulated_profit, withdrawn_profit,
          last_accrual_date, status
        )
        VALUES (
          p_investment_id,
          v_cycle.cycle_number + 1,
          v_cycle.cycle_end_date,
          v_next_end,
          v_cycle.daily_profit,
          0.00,
          0.00,
          v_cycle.cycle_end_date,
          'ACTIVE'
        )
        ON CONFLICT (investment_id, cycle_number) DO NOTHING;
      END IF;
    ELSE
      v_days_diff := greatest(
        0,
        floor(extract(epoch FROM (v_now - v_cycle.last_accrual_date)) / 86400)::int
      );
      IF v_days_diff > 0 THEN
        UPDATE public.investment_cycles
        SET accumulated_profit = accumulated_profit
              + (v_days_diff * v_cycle.daily_profit),
            last_accrual_date = v_now
        WHERE id = v_cycle.id;
      END IF;
      EXIT;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accrual_investment_yields(uuid)
  FROM public, anon, authenticated;

-- ============================================================================
-- 7. RETIRER LES ANCIENS CHEMINS DE CRÉDIT
-- ============================================================================
-- L'ancienne RPC sans paramètre est supprimée : elle créditait tous les
-- investissements de l'utilisateur en une fois et ne peut pas coexister avec
-- l'UI par carte.  Le DROP est idempotent; le REVOKE conditionnel évite
-- d'échouer sur une base où 013 a déjà été corrigé.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE p.oid = to_regprocedure('public.claim_daily_profit()')
      AND n.nspname = 'public'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.claim_daily_profit() FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;
DROP FUNCTION IF EXISTS public.claim_daily_profit();

-- La RPC legacy acceptait un montant client et pouvait donc contourner la
-- nouvelle sémantique 10%.  On la retire après avoir remplacé les règles.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE p.oid = to_regprocedure(
        'public.claim_investment_profit(uuid, uuid, numeric)'
      )
      AND n.nspname = 'public'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.claim_investment_profit(uuid, uuid, numeric) FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;
DROP FUNCTION IF EXISTS public.claim_investment_profit(uuid, uuid, numeric);

-- ============================================================================
-- 8. RPC AUTORITATIVE PAR INVESTISSEMENT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.business_date(p_at timestamp with time zone)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT (p_at AT TIME ZONE 'Africa/Kinshasa')::date;
$$;
REVOKE EXECUTE ON FUNCTION public.business_date(timestamp with time zone)
  FROM public, anon, authenticated;

-- Les anciennes fonctions de commission/parrainage increase également
-- today_earned.  Le trigger conserve leur delta et remet le compteur à zéro
-- lorsqu'on change de date métier.
CREATE OR REPLACE FUNCTION public.reset_today_earned_on_new_business_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_business_date date := (now() AT TIME ZONE 'Africa/Kinshasa')::date;
BEGIN
  IF NEW.today_earned_date IS NOT DISTINCT FROM OLD.today_earned_date
     AND OLD.today_earned_date IS DISTINCT FROM v_business_date THEN
    NEW.today_earned_date := v_business_date;
    NEW.today_earned := greatest(
      coalesce(NEW.today_earned, 0) - coalesce(OLD.today_earned, 0),
      0
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_today_earned ON public.wallets;
CREATE TRIGGER trg_reset_today_earned
  BEFORE UPDATE OF today_earned, today_earned_date ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_today_earned_on_new_business_date();

CREATE OR REPLACE FUNCTION public.claim_daily_profit(p_investment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_now timestamp with time zone;
  v_business_date date;
  v_ends_at timestamp with time zone;
  v_start_business_date date;
  v_end_business_date date;
  v_inv record;
  v_wallet record;
  v_cycle_id uuid;
  v_amount numeric(15,2);
  v_new_balance numeric(15,2);
  v_claim_id uuid;
  v_tx_id uuid;
  v_reference varchar;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;
  IF p_investment_id IS NULL THEN
    RAISE EXCEPTION 'Investissement requis';
  END IF;

  v_now := now();
  v_business_date := public.business_date(v_now);

  -- Lock + ownership dans la même requête.  Un utilisateur ne peut jamais
  -- passer l'ID d'un investissement appartenant à un autre compte.
  SELECT * INTO v_inv
  FROM public.investments
  WHERE id = p_investment_id
    AND user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Investissement introuvable ou accès refusé';
  END IF;

  IF v_inv.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Investissement non actif';
  END IF;

  v_ends_at := coalesce(
    v_inv.ends_at,
    v_inv.created_at + (greatest(coalesce(v_inv.duration_months, 3), 1) * interval '1 month')
  );
  v_start_business_date := public.business_date(v_inv.created_at);
  v_end_business_date := public.business_date(v_ends_at);
  IF v_now < v_inv.created_at
     OR v_business_date < v_start_business_date
     OR v_business_date >= v_end_business_date
     OR v_now >= v_ends_at THEN
    RAISE EXCEPTION 'Investissement terminé ou non éligible';
  END IF;

  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet introuvable';
  END IF;

  -- Le montant est calculé par le serveur à partir du capital immuable.  Le
  -- snapshot daily_profit est vérifié, puis arrondi à nouveau à 2 décimales.
  IF v_inv.daily_profit IS DISTINCT FROM round(v_inv.total_amount * 0.10, 2) THEN
    RAISE EXCEPTION 'Snapshot financier incohérent';
  END IF;
  v_amount := round(coalesce(v_inv.daily_profit, round(v_inv.total_amount * 0.10, 2)), 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Bénéfice journalier nul';
  END IF;

  -- Le cycle n'est qu'une référence d'audit; il ne remplace jamais le snapshot
  -- d'investissement utilisé pour le crédit.
  SELECT c.id INTO v_cycle_id
  FROM public.investment_cycles AS c
  WHERE c.investment_id = v_inv.id
    AND c.status = 'ACTIVE'
    AND c.cycle_start_date <= v_now
    AND c.cycle_end_date > v_now
  ORDER BY c.cycle_number ASC
  LIMIT 1;

  v_claim_id := NULL;
  INSERT INTO public.profit_claims (
    user_id, investment_id, cycle_id, profit_date, amount, claimed_at
  )
  VALUES (
    v_user_id, v_inv.id, v_cycle_id, v_business_date, v_amount, v_now
  )
  ON CONFLICT (investment_id, profit_date) DO NOTHING
  RETURNING id INTO v_claim_id;

  IF v_claim_id IS NULL THEN
    RETURN json_build_object(
      'success', true,
      'investment_id', p_investment_id,
      'claimed_amount', 0,
      'already_claimed_today', true,
      'new_balance', v_wallet.balance,
      'business_date', v_business_date,
      'message', 'Bénéfice déjà réclamé pour cette date métier'
    );
  END IF;

  -- Wallet et ledger sont mis à jour dans la même transaction PostgreSQL que
  -- l'insert de profit_claims.  Une erreur ici annule les trois écritures.
  v_new_balance := round(v_wallet.balance + v_amount, 2);
  UPDATE public.wallets
  SET balance = v_new_balance,
      total_earned = total_earned + v_amount,
      today_earned = CASE
        WHEN today_earned_date = v_business_date THEN today_earned + v_amount
        ELSE v_amount
      END,
      today_earned_date = v_business_date,
      updated_at = now()
  WHERE user_id = v_user_id;

  v_reference := 'DAILY-'
    || upper(substring(replace(p_investment_id::text, '-', '') from 1 for 32))
    || '-' || to_char(v_business_date, 'YYYYMMDD');

  INSERT INTO public.wallet_transactions (
    user_id, type, amount, balance_before, balance_after,
    reference, description, status
  )
  VALUES (
    v_user_id,
    'DAILY_PROFIT',
    v_amount,
    v_wallet.balance,
    v_new_balance,
    v_reference,
    'Bénéfice quotidien = 10% du capital snapshot ('
      || v_inv.total_amount || ' FC), date métier ' || v_business_date,
    'COMPLETED'
  )
  RETURNING id INTO v_tx_id;

  UPDATE public.profit_claims
  SET transaction_id = v_tx_id
  WHERE id = v_claim_id;

  IF v_cycle_id IS NOT NULL THEN
    UPDATE public.investment_cycles
    SET withdrawn_profit = withdrawn_profit + v_amount
    WHERE id = v_cycle_id;
  END IF;

  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = v_user_id
    AND type = 'profit'
    AND reference_id = p_investment_id
    AND reference_date = v_business_date
    AND is_read = false;

  INSERT INTO public.admin_logs (admin_id, action, target_object, new_value)
  VALUES (
    NULL,
    'DAILY_PROFIT_CLAIM',
    'profit_claims',
    'User ' || v_user_id || ' a réclamé ' || v_amount
      || ' FC sur investment ' || p_investment_id
      || ' pour le ' || v_business_date
  );

  RETURN json_build_object(
    'success', true,
    'investment_id', p_investment_id,
    'claimed_amount', v_amount,
    'already_claimed_today', false,
    'new_balance', v_new_balance,
    'transaction_id', v_tx_id,
    'business_date', v_business_date
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_daily_profit(uuid)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_profit(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.claim_daily_profit(uuid) IS
  'Claim atomique de round(total_amount * 0.10, 2), une fois par business_date Africa/Kinshasa, avec contrôle de propriété et de fin de contrat.';

-- ============================================================================
-- 9. FINALISATION USER-SCOPED DES CONTRATS EXPIRES
-- ============================================================================
CREATE OR REPLACE FUNCTION public.finalize_expired_investments()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_business_date date := public.business_date(now());
  v_inv record;
  v_count int := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  FOR v_inv IN
    SELECT i.id
    FROM public.investments AS i
    WHERE i.user_id = v_user_id
      AND i.status = 'ACTIVE'
      AND (
        i.ends_at <= now()
        OR (i.ends_at AT TIME ZONE 'Africa/Kinshasa')::date <= v_business_date
      )
    FOR UPDATE
  LOOP
    PERFORM public.accrual_investment_yields(v_inv.id);
    UPDATE public.investment_cycles
    SET status = 'COMPLETED'
    WHERE investment_id = v_inv.id
      AND status = 'ACTIVE';
    UPDATE public.investments
    SET status = 'COMPLETED'
    WHERE id = v_inv.id
      AND user_id = v_user_id
      AND status = 'ACTIVE';
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.wallets
  SET today_earned = 0,
      today_earned_date = v_business_date
  WHERE user_id = v_user_id
    AND today_earned_date IS DISTINCT FROM v_business_date;

  RETURN json_build_object(
    'success', true,
    'finalized_count', v_count,
    'business_date', v_business_date
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_expired_investments()
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.finalize_expired_investments()
  TO authenticated;

-- ============================================================================
-- 10. SYNCHRONISATION DES NOTIFICATIONS DE PROFIT
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_profit_notifications()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamp with time zone := now();
  v_business_date date := public.business_date(v_now);
  v_inv record;
  v_has_claim boolean;
  v_daily_profit numeric(15,2);
  v_notification_id uuid;
  v_inserted int := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  FOR v_inv IN
    SELECT i.id, i.total_amount
    FROM public.investments AS i
    WHERE i.user_id = v_user_id
      AND i.status = 'ACTIVE'
      AND i.created_at <= v_now
      AND i.ends_at > v_now
      AND public.business_date(i.ends_at) > v_business_date
  LOOP
    SELECT EXISTS (
      SELECT 1
      FROM public.profit_claims AS pc
      WHERE pc.investment_id = v_inv.id
        AND pc.profit_date = v_business_date
    ) INTO v_has_claim;

    IF NOT v_has_claim THEN
      v_daily_profit := round(v_inv.total_amount * 0.10, 2);
      v_notification_id := NULL;

      INSERT INTO public.notifications (
        user_id, type, title, message, reference_id, reference_date
      )
      VALUES (
        v_user_id,
        'profit',
        'Bénéfice disponible',
        'Bénéfice quotidien de ' || v_daily_profit
          || ' FC = 10% du capital. Cliquez sur VENDRE.',
        v_inv.id,
        v_business_date
      )
      ON CONFLICT (user_id, type, reference_id, reference_date)
        WHERE reference_id IS NOT NULL AND reference_date IS NOT NULL
        DO NOTHING
      RETURNING id INTO v_notification_id;

      IF v_notification_id IS NOT NULL THEN
        v_inserted := v_inserted + 1;
      END IF;
    END IF;
  END LOOP;

  DELETE FROM public.notifications
  WHERE user_id = v_user_id
    AND type = 'profit'
    AND created_at < (now() - interval '7 days');

  RETURN json_build_object(
    'success', true,
    'business_date', v_business_date,
    'new_notifications', v_inserted
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_profit_notifications()
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_profit_notifications()
  TO authenticated;

COMMENT ON FUNCTION public.sync_profit_notifications() IS
  'Notifications profit idempotentes par investment et business_date Africa/Kinshasa; montant 10% calculé côté serveur.';

-- ============================================================================
-- 11. CONTENU HISTORIQUE : 10 % DANS LES FAQ ET ACADEMY
-- ============================================================================
UPDATE public.faq
SET answer = 'Chaque investissement verse 10 % du capital investi par jour pendant 3 mois. Le bénéfice du jour doit être vendu chaque jour ; un jour non réclamé est perdu et n''est jamais reporté.'
WHERE question = 'Comment fonctionnent les versements ?';

UPDATE public.faq
SET answer = 'Enregistrez votre compte de retrait dans vos paramètres, puis rendez-vous sur Retirer. Le minimum est de 5 000 FC et des frais de 15 % s''appliquent sur le montant demandé.'
WHERE question = 'Comment retirer ?';

UPDATE public.faq
SET answer = 'Partagez votre code de parrainage. Chaque invite qui investit valide 3 000 FC, puis des bonus automatiques sont crédités à 5, 10, 20, 50 et 100 invitations valides.'
WHERE question = 'Comment fonctionne l’équipe ?';

UPDATE public.academy_lessons
SET content = $content$
## L'investissement, simplement

Chaque secteur propose des packs de **20 000, 50 000, 100 000 et 250 000 FC**, pour une durée de **3 mois**.

Le bénéfice quotidien représente **10 % du capital investi**. Par exemple, un pack de 50 000 FC rapporte **5 000 FC par jour**. Sur 90 jours éligibles, cela représente 450 000 FC si chaque jour est vendu.
$content$
WHERE title = 'Leçon 1 - C''est quoi investir sur BISO INVEST ?';

UPDATE public.academy_lessons
SET content = $content$
## Choisir son premier pack

| Investissement | Bénéfice quotidien (10 %) | Sur 90 jours éligibles |
|----------------|---------------------------|-------------------------|
| 20 000 FC      | 2 000 FC                  | 180 000 FC               |
| 50 000 FC      | 5 000 FC                  | 450 000 FC               |
| 100 000 FC     | 10 000 FC                 | 900 000 FC               |
| 250 000 FC     | 25 000 FC                 | 2 250 000 FC             |

Choisissez un pack adapté à votre budget, puis vendez son bénéfice chaque jour. Une journée non réclamée est définitivement perdue.
$content$
WHERE title = 'Leçon 4 - Choisir son premier pack';

UPDATE public.academy_lessons
SET content = $content$
## Comprendre les bénéfices quotidiens

Le bénéfice de chaque jour est égal à **10 % du capital total investi**, arrondi à deux décimales.

- 20 000 FC → 2 000 FC par jour ;
- 50 000 FC → 5 000 FC par jour ;
- 250 000 FC → 25 000 FC par jour.

Cliquez sur **VENDRE** chaque jour. Un bénéfice non réclamé est perdu et n'est jamais reporté. La durée actuelle des packs est de 3 mois.
$content$
WHERE title = 'Leçon 5 - Comprendre les bénéfices quotidiens';

UPDATE public.academy_lessons
SET content = replace(
      replace(
        content,
        '12 mois, revenu mensuel égal à l''investissement, bénéfices quotidiens, vente obligatoire chaque jour.',
        '3 mois, bénéfice quotidien égal à 10 % du capital investi, vente obligatoire chaque jour.'
      ),
      '3 mois, revenu mensuel égal à l''investissement, bénéfices quotidiens, vente obligatoire chaque jour.',
      '3 mois, bénéfice quotidien égal à 10 % du capital investi, vente obligatoire chaque jour.'
    )
WHERE title = 'Leçon 3 - Diversifier entre les secteurs';

-- Fin de la migration 030.  Ne pas exécuter cette migration depuis COMPLETE_SETUP.sql
-- pour une base déjà déployée : utiliser le mécanisme de migrations Supabase.
