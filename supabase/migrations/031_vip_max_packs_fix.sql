-- ============================================================================
-- BISO INVEST — MIGRATION 031 : PLAFOND VIP COHÉRENT (GLOBAL) + VIP0 = 0 PACK
-- ============================================================================
-- Correction du contrôle de plafond des packs :
--   * VIP0 ne peut détenir aucun pack (max_packs = 0);
--   * le plafond max_packs s'applique à l'ENSEMBLE des packs ACTIFS de
--     l'utilisateur, tous produits confondus (avant : par produit, ce qui
--     permettait de contourner la limite en achetant le même nombre de packs
--     dans chaque secteur);
--   * le niveau de référence reste le plus haut palier actif qualifiable par
--     l'investissement projeté (total_invested + nouvel achat), repli sur le
--     niveau courant — un nouveau client VIP0 peut donc acheter son premier
--     pack (l'achat le qualifie VIP1+), mais ne peut jamais EN DÉTENIR plus
--     que le plafond de son palier.
--
-- Migration idempotente : à appliquer après 030 sur une base déployée.
-- ============================================================================

-- ============================================================================
-- 1. VIP0 : AUCUN pack autorisé
-- ============================================================================
UPDATE public.vip_levels
SET max_packs = 0,
    benefits = 'Condition 0 FC — Aucun pack autorisé'
WHERE level_name = 'VIP0';

-- Garde-fou : le plafond ne peut jamais être négatif pour un palier actif.
ALTER TABLE public.vip_levels
  DROP CONSTRAINT IF EXISTS vip_levels_max_packs_non_negative;
ALTER TABLE public.vip_levels
  ADD CONSTRAINT vip_levels_max_packs_non_negative
  CHECK (max_packs >= 0);

-- ============================================================================
-- 2. PURCHASE_INVESTMENT : PLAFOND GLOBAL
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
  v_vip_level varchar;
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
  'Souscription atomique; plafond max_packs global (tous produits) selon le palier VIP qualifié/courant; snapshot 10%.';

-- ============================================================================
-- 3. GARDE SERVEUR : AUCUN INSERT DIRECT NE PEUT DÉPASSER LE PLAFOND
-- ============================================================================
-- Même si un SQL administratif insérait directement un pack, le trigger de
-- vérification du plafond VIP global le rejette.
CREATE OR REPLACE FUNCTION public.enforce_vip_pack_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_vip_limit int;
  v_vip_level varchar;
  v_pack_count int;
  v_projected numeric(15,2);
BEGIN
  IF NEW.status <> 'ACTIVE' THEN
    RETURN NEW;
  END IF;

  -- Palier jugé comme dans purchase_investment : le plus haut palier actif
  -- qualifiable par l'investissement projeté (total_invested + ce pack),
  -- repli sur le niveau courant.  Un nouveau client VIP0 est donc qualifié
  -- VIP1 par son premier achat et peut le faire.
  SELECT coalesce(w.total_invested, 0) + NEW.total_amount
    INTO v_projected
  FROM public.wallets AS w
  WHERE w.user_id = NEW.user_id;

  IF v_projected IS NULL THEN
    v_projected := NEW.total_amount;
  END IF;

  SELECT level_name INTO v_vip_level
  FROM public.vip_levels
  WHERE is_active = true
    AND min_investment <= v_projected
  ORDER BY display_order DESC
  LIMIT 1;

  IF v_vip_level IS NULL THEN
    SELECT coalesce(current_vip, 'VIP0') INTO v_vip_level
    FROM public.profiles
    WHERE id = NEW.user_id;
  END IF;

  SELECT max_packs INTO v_vip_limit
  FROM public.vip_levels
  WHERE level_name = v_vip_level;

  IF v_vip_limit IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_vip_limit = 0 THEN
    RAISE EXCEPTION
      'Votre niveau VIP ne permet aucun pack' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(sum(i.quantity), 0) INTO v_pack_count
  FROM public.investments AS i
  WHERE i.user_id = NEW.user_id
    AND i.status = 'ACTIVE'
    AND i.id <> NEW.id
    AND i.ends_at > now()
    AND (i.ends_at AT TIME ZONE 'Africa/Kinshasa')::date
        > (now() AT TIME ZONE 'Africa/Kinshasa')::date;

  IF (v_pack_count + NEW.quantity) > v_vip_limit THEN
    RAISE EXCEPTION
      'Dépassement de la limite autorisée (% packs au total pour votre niveau %)',
      v_vip_limit,
      v_vip_level
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- Le trigger s'attache à l'insertion ET à toute remise en ACTIVE (évite les
-- contournements par un UPDATE de statut).  L'update des montants financiers
-- des snapshots (prohibé par 030) n'est pas concerné.
DROP TRIGGER IF EXISTS trg_enforce_vip_pack_cap ON public.investments;
CREATE TRIGGER trg_enforce_vip_pack_cap
  BEFORE INSERT OR UPDATE OF status ON public.investments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_vip_pack_cap();

COMMENT ON TRIGGER trg_enforce_vip_pack_cap ON public.investments IS
  'Plafond VIP global (max_packs, tous produits) appliqué même aux insertions directes.';

-- Fin de la migration 031.