-- ============================================================================
-- BISO INVEST — MIGRATION 033 : TAUX ET DURÉE PAR SECTEUR
-- ============================================================================
-- Nouvelle grille commerciale officielle, pour les NOUVELLES souscriptions :
--
--   Agriculture : durée 15 jours, bénéfice quotidien 10 % du capital
--   Élevage     : durée 18 jours, bénéfice quotidien 15 % du capital
--   Pisciculture: durée 10 jours, bénéfice quotidien 20 % du capital
--
-- Principe inchangé : daily_profit = round(total_amount × taux, 2) est un
-- snapshot posé à la souscription et crédité une fois par date métier
-- Africa/Kinshasa ; les claims, la finalisation et les notifications
-- s'arrêtent à ends_at sans réécrire les claims historiques.
--
-- Implémentation (idempotente, à appliquer après 030/031/032) :
--   1) product_categories.daily_rate : la politique par secteur ;
--   2) products.daily_rate + duration_days (15/18/10) + total_returns ;
--   3) investments.daily_rate : snapshot posé à la souscription ;
--   4) la contrainte 10% fixe est remplacée par une contrainte au taux
--      snapshoté : daily_profit = round(total_amount × coalesce(daily_rate,
--      0.10), 2) ;
--   5) triggers et RPC recalibrés sur le taux snapshoté.
-- ============================================================================

-- ============================================================================
-- 1. POLITIQUE PAR SECTEUR : product_categories.daily_rate
-- ============================================================================
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS daily_rate numeric(6,4);

UPDATE public.product_categories
SET daily_rate = CASE name
      WHEN 'Agriculture'   THEN 0.10
      WHEN 'Élevage'       THEN 0.15
      WHEN 'Pisciculture'  THEN 0.20
      ELSE 0.10
    END
WHERE daily_rate IS NULL;

ALTER TABLE public.product_categories
  ALTER COLUMN daily_rate SET DEFAULT 0.10;
ALTER TABLE public.product_categories
  ALTER COLUMN daily_rate SET NOT NULL;

ALTER TABLE public.product_categories
  DROP CONSTRAINT IF EXISTS product_categories_daily_rate_check;
ALTER TABLE public.product_categories
  ADD CONSTRAINT product_categories_daily_rate_check
  CHECK (daily_rate > 0 AND daily_rate <= 1);

COMMENT ON COLUMN public.product_categories.daily_rate IS
  'Taux de bénéfice quotidien du secteur : 10% Agriculture, 15% Élevage, 20% Pisciculture.';

-- ============================================================================
-- 2. CATALOGUE PRODUITS : taux + durée courte par secteur
-- ============================================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS daily_rate numeric(6,4);

UPDATE public.products AS p
SET daily_rate = coalesce(c.daily_rate, 0.10)
FROM public.product_categories AS c
WHERE c.id = p.category_id
  AND p.daily_rate IS DISTINCT FROM coalesce(c.daily_rate, 0.10);

ALTER TABLE public.products
  ALTER COLUMN daily_rate SET DEFAULT 0.10;
ALTER TABLE public.products
  ALTER COLUMN daily_rate SET NOT NULL;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_daily_rate_check;
ALTER TABLE public.products
  ADD CONSTRAINT products_daily_rate_check
  CHECK (daily_rate > 0 AND daily_rate <= 1);

-- Durées commerciales par secteur (Agriculture 15 est déjà posée par 032).
UPDATE public.products AS p
SET duration_days = CASE c.name
      WHEN 'Agriculture'   THEN 15
      WHEN 'Élevage'       THEN 18
      WHEN 'Pisciculture'  THEN 10
      ELSE p.duration_days
    END
FROM public.product_categories AS c
WHERE c.id = p.category_id
  AND c.name IN ('Agriculture', 'Élevage', 'Pisciculture')
  AND duration_days IS DISTINCT FROM CASE c.name
      WHEN 'Agriculture'   THEN 15
      WHEN 'Élevage'       THEN 18
      WHEN 'Pisciculture'  THEN 10
    END;

-- total_returns catalogue = taux × durée × prix (affichage uniquement).
UPDATE public.products
SET total_returns = round(price * daily_rate * duration_days, 2)
WHERE duration_days IS NOT NULL
  AND total_returns IS DISTINCT FROM round(price * daily_rate * duration_days, 2);

COMMENT ON COLUMN public.products.daily_rate IS
  'Taux de bénéfice quotidien snapshoté du pack (hérité du secteur : 10/15/20 %).';
COMMENT ON COLUMN public.products.duration_days IS
  'Durée en jours du contrat : 15 Agriculture, 18 Élevage, 10 Pisciculture. NULL = 3 mois.';

-- ============================================================================
-- 3. INVESTISSEMENTS : SNAPSHOT daily_rate
-- ============================================================================
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS daily_rate numeric(6,4);

-- Historique : tous les contrats existants étaient à 10 %.
UPDATE public.investments
SET daily_rate = 0.10
WHERE daily_rate IS NULL;

ALTER TABLE public.investments
  ALTER COLUMN daily_rate SET DEFAULT 0.10;
ALTER TABLE public.investments
  ALTER COLUMN daily_rate SET NOT NULL;

ALTER TABLE public.investments
  DROP CONSTRAINT IF EXISTS investments_daily_rate_check;
ALTER TABLE public.investments
  ADD CONSTRAINT investments_daily_rate_check
  CHECK (daily_rate > 0 AND daily_rate <= 1);

-- La contrainte 10 % fixe devient une contrainte au taux snapshoté.
ALTER TABLE public.investments
  DROP CONSTRAINT IF EXISTS investments_daily_profit_10_percent_check;
ALTER TABLE public.investments
  ADD CONSTRAINT investments_daily_profit_10_percent_check
  CHECK (daily_profit = round(total_amount * daily_rate, 2));

COMMENT ON COLUMN public.investments.daily_rate IS
  'Taux de bénéfice quotidien snapshoté à la souscription (10/15/20 % selon le secteur).';
COMMENT ON COLUMN public.investments.total_amount IS
  'Capital total immuable de la souscription; base du bénéfice quotidien (round(total × taux, 2)).';
COMMENT ON COLUMN public.investments.daily_profit IS
  'Snapshot immuable: round(total_amount × daily_rate, 2), crédité une fois par date métier Africa/Kinshasa.';

-- ============================================================================
-- 4. TRIGGER DE SNAPSHOT : TAUX + DURÉE COURTE
-- ============================================================================
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
  NEW.daily_rate := coalesce(NEW.daily_rate, 0.10);
  NEW.daily_profit := round(NEW.total_amount * NEW.daily_rate, 2);

  v_duration_months := least(
    greatest(coalesce(NEW.duration_months, 3), 1),
    3
  );
  NEW.duration_months := v_duration_months;

  IF NEW.duration_days IS NOT NULL AND NEW.duration_days > 0 THEN
    -- Contrat court (15/18/10 jours) : une seule période.
    NEW.remaining_installments := 1;
    NEW.ends_at := NEW.created_at + (NEW.duration_days * interval '1 day');
  ELSE
    NEW.duration_days := NULL;
    NEW.remaining_installments := v_duration_months;
    NEW.ends_at := NEW.created_at + (v_duration_months * interval '1 month');
  END IF;

  v_eligible_days := greatest(
    0,
    (NEW.ends_at AT TIME ZONE 'Africa/Kinshasa')::date
    - (NEW.created_at AT TIME ZONE 'Africa/Kinshasa')::date
  );
  NEW.total_expected := round(NEW.daily_profit * v_eligible_days, 2);
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 5. CYCLE INITIAL : TAUX SNAPSHOTÉ
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
  -- Basé sur le snapshot NEW.total_amount × NEW.daily_rate, jamais sur le
  -- produit courant.
  v_daily_profit := round(
    NEW.total_amount * coalesce(NEW.daily_rate, 0.10),
    2
  );
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

-- ============================================================================
-- 6. PURCHASE_INVESTMENT : SOUSCRIPTION AU TAUX DU SECTEUR
-- ============================================================================
-- Reprend purchase_investment de 032 (plafond VIP global + durée courte) et
-- ajoute daily_rate (taux du produit) à la souscription.
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
  v_daily_rate numeric(6,4);
  v_duration_months int;
  v_duration_days int;
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
  v_vip_level varchar;
  v_vip_limit int;
  v_user_pack_count int;
  v_projected_invested numeric(15,2);
  v_idempotency_key varchar(100);
  v_remaining int;
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
  -- sans second débit.  La propriété est incluse dans la recherche.
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
  v_daily_rate := coalesce(v_product.daily_rate, 0.10);
  v_duration_months := least(
    greatest(coalesce(v_product.duration_months, 3), 1),
    3
  );
  v_duration_days := coalesce(v_product.duration_days, 0);

  IF v_duration_days > 0 THEN
    -- Contrat court (15/18/10 jours) : un seul cycle, fin à +duration_days.
    v_ends_at := v_created_at + (v_duration_days * interval '1 day');
    v_next_cycle_end := v_ends_at;
    v_remaining := 1;
  ELSE
    -- Contrat standard : 3 mois.
    v_ends_at := v_created_at + (v_duration_months * interval '1 month');
    v_next_cycle_end := v_created_at + interval '1 month';
    v_remaining := v_duration_months;
  END IF;

  -- Règle : round(capital × taux du secteur, 2), jamais une division par jours.
  v_daily_profit := round(v_total_cost * v_daily_rate, 2);
  v_eligible_days := greatest(
    0,
    (v_ends_at AT TIME ZONE 'Africa/Kinshasa')::date
    - (v_created_at AT TIME ZONE 'Africa/Kinshasa')::date
  );
  v_total_expected := round(v_daily_profit * v_eligible_days, 2);

  -- Snapshot historique conservé pour les écrans existants.  Il n'est pas
  -- utilisé par la logique de profit, qui lit daily_rate/daily_profit.
  v_monthly_return := v_total_cost;

  -- Les contrats expirés ne doivent pas continuer à consommer le plafond VIP.
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

  v_vip_level := coalesce(v_qualified_vip, v_current_vip, 'VIP0');
  SELECT max_packs INTO v_vip_limit
  FROM public.vip_levels
  WHERE level_name = v_vip_level;
  v_vip_limit := coalesce(v_vip_limit, 0);

  -- Plafond GLOBAL : tous les packs ACTIFS de l'utilisateur, tous produits
  -- confondus.  Un plafond de 5 signifie 5 packs au total, pas 5 par secteur.
  SELECT coalesce(sum(i.quantity), 0) INTO v_user_pack_count
  FROM public.investments AS i
  WHERE i.user_id = v_user_id
    AND i.status = 'ACTIVE'
    AND i.ends_at > now()
    AND (i.ends_at AT TIME ZONE 'Africa/Kinshasa')::date
        > (now() AT TIME ZONE 'Africa/Kinshasa')::date;

  IF (v_user_pack_count + p_quantity) > v_vip_limit THEN
    RAISE EXCEPTION
      'Dépassement de la limite autorisée (% packs au total pour votre niveau %)',
      v_vip_limit,
      v_vip_level;
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
      || CASE WHEN v_duration_days > 0
             THEN ' — contrat ' || v_duration_days || ' jours, bénéfice quotidien snapshot '
                  || round(v_daily_rate * 100) || '%'
             ELSE ' — bénéfice quotidien snapshot '
                  || round(v_daily_rate * 100) || '%'
         END,
    'COMPLETED'
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO public.investments (
    user_id, product_id, quantity, total_amount, monthly_return,
    duration_months, duration_days, daily_rate,
    paid_installments, remaining_installments,
    next_payment_date, total_expected, status, idempotency_key,
    created_at, daily_profit, ends_at
  )
  VALUES (
    v_user_id, p_product_id, p_quantity, v_total_cost, v_monthly_return,
    v_duration_months, CASE WHEN v_duration_days > 0 THEN v_duration_days ELSE NULL END,
    v_daily_rate,
    0, v_remaining, v_next_cycle_end,
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
      || '; daily_rate=' || v_daily_rate
      || '; duration_days=' || coalesce(v_duration_days, 0)
  );

  RETURN json_build_object(
    'success', true,
    'investment_id', v_inv_id,
    'total_cost', v_total_cost,
    'daily_profit', v_daily_profit,
    'daily_rate', v_daily_rate,
    'ends_at', v_ends_at,
    'total_expected', v_total_expected,
    'duration_days', CASE WHEN v_duration_days > 0 THEN v_duration_days ELSE NULL END,
    'reference', v_reference
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purchase_investment(uuid, int, varchar)
  FROM public, anon;
GRANT EXECUTE ON FUNCTION public.purchase_investment(uuid, int, varchar)
  TO authenticated;

COMMENT ON FUNCTION public.purchase_investment(uuid, int, varchar) IS
  'Souscription atomique; plafond max_packs global; snapshot daily_profit = round(capital × taux secteur, 2); durée 15/18/10 jours selon le secteur (duration_days), 3 mois sinon.';

-- ============================================================================
-- 7. CLAIM : MONTANT AU TAUX SNAPSHOTÉ
-- ============================================================================
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
  -- snapshot daily_profit est vérifié contre le taux snapshoté, puis arrondi
  -- à nouveau à 2 décimales.
  IF v_inv.daily_profit IS DISTINCT FROM
     round(v_inv.total_amount * coalesce(v_inv.daily_rate, 0.10), 2) THEN
    RAISE EXCEPTION 'Snapshot financier incohérent';
  END IF;
  v_amount := round(
    coalesce(v_inv.daily_profit, round(v_inv.total_amount * coalesce(v_inv.daily_rate, 0.10), 2)),
    2
  );
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
    'Bénéfice quotidien '
      || round(coalesce(v_inv.daily_rate, 0.10) * 100) || '% du capital snapshot ('
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
  'Claim atomique du snapshot daily_profit (round(capital × taux, 2)), une fois par business_date Africa/Kinshasa, avec contrôle de propriété et de fin de contrat.';

-- ============================================================================
-- 8. NOTIFICATIONS : MONTANT AU TAUX SNAPSHOTÉ
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
  v_rate_pct int;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  FOR v_inv IN
    SELECT i.id, i.total_amount, i.daily_profit, i.daily_rate
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
      v_daily_profit := coalesce(
        v_inv.daily_profit,
        round(v_inv.total_amount * coalesce(v_inv.daily_rate, 0.10), 2)
      );
      v_rate_pct := round(coalesce(v_inv.daily_rate, 0.10) * 100);
      v_notification_id := NULL;

      INSERT INTO public.notifications (
        user_id, type, title, message, reference_id, reference_date
      )
      VALUES (
        v_user_id,
        'profit',
        'Bénéfice disponible',
        'Bénéfice quotidien de ' || v_daily_profit
          || ' FC = ' || v_rate_pct || '% du capital. Cliquez sur VENDRE.',
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

-- ============================================================================
-- 9. CONTENU ÉDITORIAL : GRILLE PAR SECTEUR
-- ============================================================================
UPDATE public.faq
SET answer = 'Chaque secteur a sa propre durée et son propre taux de bénéfice quotidien :
- Agriculture : 15 jours, 10 % du capital chaque jour ;
- Élevage : 18 jours, 15 % du capital chaque jour ;
- Pisciculture : 10 jours, 20 % du capital chaque jour.
Le bénéfice du jour doit être vendu chaque jour ; un jour non réclamé est perdu et n''est jamais reporté.'
WHERE question = 'Comment fonctionnent les versements ?';

UPDATE public.academy_lessons
SET content = $content$
## L'investissement, simplement

Chaque secteur propose des packs de **20 000, 50 000, 100 000 et 250 000 FC**.

| Secteur | Durée | Bénéfice quotidien |
|---------|-------|--------------------|
| Agriculture | 15 jours | 10 % du capital |
| Élevage | 18 jours | 15 % du capital |
| Pisciculture | 10 jours | 20 % du capital |

Par exemple, un pack Élevage de 50 000 FC rapporte **7 500 FC par jour pendant 18 jours**, soit 135 000 FC si chaque jour est vendu.
$content$
WHERE title = 'Leçon 1 - C''est quoi investir sur BISO INVEST ?';

UPDATE public.academy_lessons
SET content = $content$
## Les packs et leurs paliers

Chaque secteur propose des packs à **20 000, 50 000, 100 000 et 250 000 FC**.

| Investissement | Agriculture (10 % / 15 j) | Élevage (15 % / 18 j) | Pisciculture (20 % / 10 j) |
|----------------|---------------------------|-----------------------|----------------------------|
| 20 000 FC | 2 000 FC/jour → 30 000 FC | 3 000 FC/jour → 54 000 FC | 4 000 FC/jour → 40 000 FC |
| 50 000 FC | 5 000 FC/jour → 75 000 FC | 7 500 FC/jour → 135 000 FC | 10 000 FC/jour → 100 000 FC |
| 100 000 FC | 10 000 FC/jour → 150 000 FC | 15 000 FC/jour → 270 000 FC | 20 000 FC/jour → 200 000 FC |
| 250 000 FC | 25 000 FC/jour → 375 000 FC | 37 500 FC/jour → 675 000 FC | 50 000 FC/jour → 500 000 FC |

## Comment bien choisir

- **Débutant** : commencez par le pack le plus accessible que vous pouvez confortablement financer.
- **Objectif régularité** : investissez des montants adaptés à votre budget ; chaque pack court (10, 15 ou 18 jours) libère rapidement votre capital.
- **Niveau VIP** : chaque palier vous fait aussi progresser en niveau VIP, ce qui augmente votre plafond de packs actifs.

## Bonus

Chaque pack finance un projet réel : Tilapia et Carpe pour la pisciculture, Poulets et Œufs pour l'élevage, Maïs et Soja pour l'agriculture. Vous investissez dans l'économie congolaise, pas dans du vent.
$content$
WHERE title = 'Leçon 4 - Choisir votre premier pack';

UPDATE public.academy_lessons
SET content = $content$
## Pourquoi diversifier ?

L'Agriculture, l'Élevage et la Pisciculture suivent des rythmes différents. En répartissant vos packs, vous lissez naturellement vos revenus.

## Les 3 secteurs disponibles

- **Agriculture** : Maïs, Soja, Manioc et autres cultures.
- **Élevage** : Poulets, Œufs, Porcs, Chèvres.
- **Pisciculture** : Tilapia, Silure, Anguille, Carpe.

## La règle de répartition

En début de parcours, une méthode simple : **un tiers dans chaque secteur** dès que vous pouvez ouvrir 3 packs. Sinon, commencez par le secteur que vous comprenez le mieux.

## Ce qui ne change pas

Quel que soit le secteur, la logique est identique : un taux de bénéfice quotidien propre au secteur (10 % Agriculture, 15 % Élevage, 20 % Pisciculture), une durée courte (15, 18 ou 10 jours) et une vente obligatoire chaque jour.

La diversification est la première protection d'un investisseur sérieux.
$content$
WHERE title = 'Leçon 3 - Diversifier entre les secteurs';

UPDATE public.academy_lessons
SET content = $content$
## Comprendre les bénéfices quotidiens

Le bénéfice de chaque jour est égal à **taux du secteur × capital total investi**, arrondi à deux décimales :

- Agriculture (10 %) : 20 000 FC → 2 000 FC par jour ;
- Élevage (15 %) : 20 000 FC → 3 000 FC par jour ;
- Pisciculture (20 %) : 20 000 FC → 4 000 FC par jour.

Cliquez sur **VENDRE** chaque jour. Un bénéfice non réclamé est perdu et n'est jamais reporté. La durée du contrat est fixée au moment de la souscription : 15 jours (Agriculture), 18 jours (Élevage) ou 10 jours (Pisciculture).
$content$
WHERE title = 'Leçon 5 - Comprendre les bénéfices quotidiens';

-- Fin de la migration 033.