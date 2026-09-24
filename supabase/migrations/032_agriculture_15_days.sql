-- ============================================================================
-- BISO INVEST — MIGRATION 032 : PACKS AGRICULTURE SUR 15 JOURS
-- ============================================================================
-- Les packs du secteur Agriculture ont un contrat de 15 JOURS (au lieu de
-- 3 mois), pour les NOUVELLES souscriptions uniquement.
--
-- Règle : le bénéfice quotidien reste 10 % du capital investi, versé
-- chaque jour métier de la durée du pack.  Un pack Agriculture de 20 000 FC
-- verse donc 2 000 FC/jour pendant 15 jours = 30 000 FC au total.
--
-- Implémentation :
--   1) products.duration_days  : catalogue (15 pour l'Agriculture, NULL sinon).
--   2) investments.duration_days : snapshot posé à la souscription.
--   3) ends_at est calculé à partir de duration_days quand il est renseigné
--      (+15 jours) ; toutes les chaînes (claims, finalisation, notifications,
--      projections) s'appuient déjà sur ends_at et s'arrêtent donc
--      naturellement au 15e jour, SANS réécrire les claims historiques.
--   4) total_expected = daily_profit × 15 pour ces packs.
--
-- Idempotente : à appliquer après 030/031 sur une base déjà déployée.
-- ============================================================================

-- ============================================================================
-- 1. CATALOGUE : COLONNE duration_days + SECTEUR AGRICULTURE = 15 JOURS
-- ============================================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS duration_days int;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_duration_days_positive;
ALTER TABLE public.products
  ADD CONSTRAINT products_duration_days_positive
  CHECK (duration_days IS NULL OR duration_days > 0);

-- Durée commerciale du secteur Agriculture : 15 jours.  duration_months reste
-- 3 (contrainte CHECK 030) ; seul duration_days gouverne la souscription.
-- total_returns = daily_profit × 15 pour l'affichage catalogue.
UPDATE public.products AS p
SET duration_days = 15,
    total_returns = round(p.price * 0.10 * 15, 2)
FROM public.product_categories AS c
WHERE c.id = p.category_id
  AND c.name = 'Agriculture'
  AND p.duration_days IS DISTINCT FROM 15;

-- ============================================================================
-- 2. INVESTISSEMENTS : SNAPSHOT duration_days
-- ============================================================================
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS duration_days int;

ALTER TABLE public.investments
  DROP CONSTRAINT IF EXISTS investments_duration_days_positive;
ALTER TABLE public.investments
  ADD CONSTRAINT investments_duration_days_positive
  CHECK (duration_days IS NULL OR duration_days > 0);

COMMENT ON COLUMN public.investments.duration_days IS
  'Durée en jours snapshotée à la souscription (15 pour les packs Agriculture). NULL = contrat mensuel (3 mois).';

-- ============================================================================
-- 3. TRIGGER DE SNAPSHOT : ends_at = +duration_days QUAND RENSEIGNÉ
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
  v_duration_months := least(
    greatest(coalesce(NEW.duration_months, 3), 1),
    3
  );
  NEW.duration_months := v_duration_months;

  IF NEW.duration_days IS NOT NULL AND NEW.duration_days > 0 THEN
    -- Contrat court (Agriculture 15 jours) : une seule période.
    NEW.remaining_installments := 1;
    NEW.ends_at := NEW.created_at + (NEW.duration_days * interval '1 day');
  ELSE
    NEW.duration_days := NULL;
    NEW.remaining_installments := v_duration_months;
    NEW.ends_at := NEW.created_at + (v_duration_months * interval '1 month');
  END IF;

  NEW.daily_profit := round(NEW.total_amount * 0.10, 2);
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
-- 4. PURCHASE_INVESTMENT : SOUSCRIPTION 15 JOURS POUR L'AGRICULTURE
-- ============================================================================
-- Reprend purchase_investment de 031 (plafond VIP global) et ajoute la durée
-- courte : quand products.duration_days est renseigné, le contrat court 15
-- jours et se termine à ends_at = created_at + 15 days.
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
  v_duration_months := least(
    greatest(coalesce(v_product.duration_months, 3), 1),
    3
  );
  v_duration_days := coalesce(v_product.duration_days, 0);

  IF v_duration_days > 0 THEN
    -- Contrat court (Agriculture 15 jours) : un seul cycle, fin à +15 jours.
    v_ends_at := v_created_at + (v_duration_days * interval '1 day');
    v_next_cycle_end := v_ends_at;
    v_remaining := 1;
  ELSE
    -- Contrat standard : 3 mois.
    v_ends_at := v_created_at + (v_duration_months * interval '1 month');
    v_next_cycle_end := v_created_at + interval '1 month';
    v_remaining := v_duration_months;
  END IF;

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
             THEN ' — contrat ' || v_duration_days || ' jours, bénéfice quotidien snapshot 10%'
             ELSE ' — bénéfice quotidien snapshot 10%'
         END,
    'COMPLETED'
  )
  RETURNING id INTO v_tx_id;

  INSERT INTO public.investments (
    user_id, product_id, quantity, total_amount, monthly_return,
    duration_months, duration_days, paid_installments, remaining_installments,
    next_payment_date, total_expected, status, idempotency_key,
    created_at, daily_profit, ends_at
  )
  VALUES (
    v_user_id, p_product_id, p_quantity, v_total_cost, v_monthly_return,
    v_duration_months, CASE WHEN v_duration_days > 0 THEN v_duration_days ELSE NULL END,
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
      || '; duration_days=' || coalesce(v_duration_days, 0)
  );

  RETURN json_build_object(
    'success', true,
    'investment_id', v_inv_id,
    'total_cost', v_total_cost,
    'daily_profit', v_daily_profit,
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
  'Souscription atomique; plafond max_packs global; snapshot 10%; durée 15 jours pour les packs Agriculture (duration_days), 3 mois sinon.';

-- ============================================================================
-- 5. CONTENU ÉDITORIAL : AGRICULTURE = 15 JOURS
-- ============================================================================
UPDATE public.faq
SET answer = 'Chaque investissement verse 10 % du capital investi par jour, pendant la durée de son contrat : 15 jours pour les packs du secteur Agriculture, 3 mois pour les autres secteurs. Le bénéfice du jour doit être vendu chaque jour ; un jour non réclamé est perdu et n''est jamais reporté.'
WHERE question = 'Comment fonctionnent les versements ?';

UPDATE public.academy_lessons
SET content = $content$
## L'investissement, simplement

Chaque secteur propose des packs de **20 000, 50 000, 100 000 et 250 000 FC**.

- Les packs du secteur **Agriculture** durent **15 jours** ;
- les packs des autres secteurs durent **3 mois**.

Le bénéfice quotidien représente **10 % du capital investi**. Par exemple, un pack Agriculture de 50 000 FC rapporte **5 000 FC par jour pendant 15 jours**, soit 75 000 FC si chaque jour est vendu.
$content$
WHERE title = 'Leçon 1 - C''est quoi investir sur BISO INVEST ?';

UPDATE public.academy_lessons
SET content = $content$
## Choisir son premier pack

| Investissement | Bénéfice quotidien (10 %) | Agriculture (15 jours) | Autres secteurs (90 jours) |
|----------------|---------------------------|-------------------------|----------------------------|
| 20 000 FC      | 2 000 FC                  | 30 000 FC               | 180 000 FC                  |
| 50 000 FC      | 5 000 FC                  | 75 000 FC               | 450 000 FC                  |
| 100 000 FC     | 10 000 FC                 | 150 000 FC              | 900 000 FC                  |
| 250 000 FC     | 25 000 FC                 | 375 000 FC              | 2 250 000 FC                |

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

Cliquez sur **VENDRE** chaque jour. Un bénéfice non réclamé est perdu et n'est jamais reporté. La durée des packs est de **3 mois, sauf pour l'Agriculture où elle est de 15 jours**.
$content$
WHERE title = 'Leçon 5 - Comprendre les bénéfices quotidiens';

-- Fin de la migration 032.