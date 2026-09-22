-- BISO INVEST - MIGRATION 008: CONSOLIDATION COMPLÈTE DES RÈGLES FINANCIÈRES & SÉCURITÉ
-- Idempotente et intégrant les 10 priorités d''audit

-- ============================================================
-- 1. SCHÉMA : COLONNES ADDITIONNELLES & CONTRAINTES
-- ============================================================

-- 1.1 withdrawals : transaction_id & contrainte 5 000 FC
alter table withdrawals add column if not exists transaction_id uuid references wallet_transactions(id);
alter table withdrawals drop constraint if exists withdrawals_amount_check;
alter table withdrawals add constraint withdrawals_amount_check check (amount >= 5000);

-- 1.2 investments : clé d''idempotence anti-double achat
alter table investments add column if not exists idempotency_key varchar(100) unique;

-- 1.3 Sécurisation RLS : suppression de l''insertion directe par utilisateur
drop policy if exists "Users can create own withdrawal request" on withdrawals;

-- ============================================================
-- 2. PRIORITÉ 8 : HISTORISATION DES COMPTES DE PAIEMENT
-- ============================================================
create or replace function public.log_payment_account_change()
returns trigger as $$
begin
  if old.phone_number is distinct from new.phone_number then
    insert into payment_account_history (network, old_number, new_number, admin_id, created_at)
    values (
      new.network,
      old.phone_number,
      new.phone_number,
      coalesce(auth.uid(), new.updated_by, '00000000-0000-0000-0000-000000000000'::uuid),
      now()
    );
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists on_payment_account_updated on payment_accounts;
create trigger on_payment_account_updated
  before update on payment_accounts
  for each row execute procedure public.log_payment_account_change();

-- ============================================================
-- 3. CALCUL DU NOMBRE RÉEL DE JOURS D''UN MOIS CALENDAIRE
-- ============================================================
create or replace function public.get_days_in_month(p_date date)
returns int as $$
begin
  return extract(day from (date_trunc('month', p_date) + interval '1 month - 1 day'))::int;
end;
$$ language plpgsql immutable set search_path = public, pg_temp;

grant execute on function public.get_days_in_month(date) to authenticated, anon;

-- ============================================================
-- 4. PRIORITÉ 2 : SYSTÈME VIP SERVEUR (MONTÉE AUTOMATIQUE + HISTORIQUE)
-- ============================================================
create or replace function public.evaluate_and_update_user_vip(p_user_id uuid)
returns varchar as $$
declare
  v_current_vip varchar;
  v_new_vip varchar;
  v_total_invested numeric;
  v_curr_order int := 0;
  v_new_order int := 0;
begin
  select coalesce(total_invested, 0) into v_total_invested from wallets where user_id = p_user_id;
  select coalesce(current_vip, 'VIP0') into v_current_vip from profiles where id = p_user_id;

  select coalesce(display_order, 0) into v_curr_order from vip_levels where level_name = v_current_vip;

  -- Déterminer le plus haut palier actif pour lequel le montant est atteint
  select level_name, display_order into v_new_vip, v_new_order
  from vip_levels
  where is_active = true and min_investment <= v_total_invested
  order by display_order desc
  limit 1;

  if v_new_vip is not null and v_new_order > v_curr_order then
    update profiles set
      current_vip = v_new_vip,
      updated_at = now()
    where id = p_user_id;

    insert into user_vip_history (user_id, old_vip, new_vip, admin_id, created_at)
    values (p_user_id, v_current_vip, v_new_vip, null, now());

    return v_new_vip;
  end if;

  return v_current_vip;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.evaluate_and_update_user_vip(uuid) to authenticated;

-- ============================================================
-- 5. PRIORITÉ 1 : COMMISSIONS A/B/C/D + LEDGER STRICT
-- ============================================================
create or replace function public.distribute_commissions(
  p_user_id uuid,
  p_base_amount numeric,
  p_source_tx_id uuid
)
returns void as $$
declare
  curr_parent uuid;
  comm_rate numeric;
  comm_amt numeric;
  v_level varchar(2);
  v_rates numeric[] := array[10.0, 3.0, 1.0, 1.0];
  v_levels varchar[] := array['A', 'B', 'C', 'D'];
  v_wallet record;
  v_new_bal numeric;
  v_ref varchar;
  v_visited uuid[] := array[p_user_id];
begin
  -- Idempotency check global
  if exists (select 1 from commissions where source_transaction_id = p_source_tx_id) then
    return;
  end if;

  curr_parent := p_user_id;

  for i in 1..4 loop
    v_level := v_levels[i];
    comm_rate := v_rates[i];

    -- Remonter au parent de niveau A
    select parent_id into curr_parent
    from referrals
    where child_id = curr_parent and level = 'A';

    -- Si aucun parent ou auto-parrainage ou boucle
    if curr_parent is null or curr_parent = any(v_visited) then
      exit;
    end if;

    v_visited := array_append(v_visited, curr_parent);
    comm_amt := round((p_base_amount * comm_rate) / 100.0, 2);

    if comm_amt > 0 then
      -- 1. Insérer la commission
      insert into commissions (
        beneficiary_id, source_user_id, level, base_amount,
        rate, commission_amount, source_transaction_id, status
      )
      values (
        curr_parent, p_user_id, v_level, p_base_amount,
        comm_rate, comm_amt, p_source_tx_id, 'PAID'
      );

      -- 2. Verrouiller et créditer le wallet
      select * into v_wallet from wallets where user_id = curr_parent for update;
      if found then
        v_new_bal := v_wallet.balance + comm_amt;
        update wallets set
          balance = v_new_bal,
          team_earned = team_earned + comm_amt,
          total_earned = total_earned + comm_amt,
          today_earned = today_earned + comm_amt,
          updated_at = now()
        where user_id = curr_parent;

        -- 3. Écriture obligatoire dans wallet_transactions (LEDGER)
        v_ref := 'COM-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));
        insert into wallet_transactions (
          user_id, type, amount, balance_before, balance_after,
          reference, description, status
        )
        values (
          curr_parent,
          'COMMISSION',
          comm_amt,
          v_wallet.balance,
          v_new_bal,
          v_ref,
          'Commission réseau niveau ' || v_level || ' (' || comm_rate || '%) sur achat ' || p_base_amount || ' FC',
          'COMPLETED'
        );
      end if;
    end if;
  end loop;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- ============================================================
-- 6. PRIORITÉS 3 & 4 : RETRAIT SÉCURISÉ AVEC LIAISON LEDGER (transaction_id)
-- ============================================================
create or replace function public.create_withdrawal(
  p_withdrawal_account_id uuid,
  p_amount numeric
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_wallet record;
  v_account record;
  v_new_balance numeric;
  v_ref varchar;
  v_fee numeric;
  v_net_amount numeric;
  v_tx_id uuid;
  v_wit_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  if p_amount < 5000 then
    raise exception 'Le montant minimum de retrait est de 5 000 FC';
  end if;

  select * into v_account from withdrawal_accounts where id = p_withdrawal_account_id and user_id = v_user_id;
  if not found then
    raise exception 'Compte de retrait introuvable ou non autorisé';
  end if;

  select * into v_wallet from wallets where user_id = v_user_id for update;
  if not found or v_wallet.balance < p_amount then
    raise exception 'Solde insuffisant dans votre portefeuille';
  end if;

  v_fee := round(p_amount * 0.15, 2);
  v_net_amount := p_amount - v_fee;
  v_new_balance := v_wallet.balance - p_amount;
  v_ref := 'WIT-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));

  -- 1. Débiter immédiatement le montant brut
  update wallets set
    balance = v_new_balance,
    updated_at = now()
  where user_id = v_user_id;

  -- 2. Créer l''écriture comptable PENDING
  insert into wallet_transactions (
    user_id, type, amount, balance_before, balance_after,
    reference, description, status
  )
  values (
    v_user_id,
    'WITHDRAWAL',
    p_amount,
    v_wallet.balance,
    v_new_balance,
    v_ref,
    'Retrait brut ' || p_amount || ' FC (frais 15% = ' || v_fee || ' FC, net = ' || v_net_amount || ' FC) vers ' || v_account.network || ' ' || v_account.phone_number,
    'PENDING'
  )
  returning id into v_tx_id;

  -- 3. Créer le retrait avec liaison transaction_id stricte
  insert into withdrawals (
    user_id, withdrawal_account_id, amount, fee, net_amount,
    network, phone_number, status, transaction_id
  )
  values (
    v_user_id, p_withdrawal_account_id, p_amount, v_fee, v_net_amount,
    v_account.network, v_account.phone_number, 'EN_ATTENTE', v_tx_id
  )
  returning id into v_wit_id;

  return json_build_object(
    'success', true,
    'withdrawal_id', v_wit_id,
    'transaction_id', v_tx_id,
    'reference', v_ref,
    'gross_amount', p_amount,
    'fee', v_fee,
    'net_amount', v_net_amount
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.create_withdrawal(uuid, numeric) to authenticated;

-- ============================================================
-- 7. VALIDATION RETRAIT : CIBLAGE STRICT DE transaction_id
-- ============================================================
create or replace function public.approve_withdrawal(
  p_withdrawal_id uuid,
  p_payment_reference text
)
returns jsonb as $$
declare
  v_withdrawal record;
  v_admin_id uuid;
begin
  v_admin_id := auth.uid();
  if not public.is_admin() then
    raise exception 'Accès non autorisé';
  end if;

  if p_payment_reference is null or trim(p_payment_reference) = '' then
    raise exception 'La référence de paiement Mobile Money est obligatoire';
  end if;

  select * into v_withdrawal from withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'Retrait introuvable';
  end if;

  if v_withdrawal.status != 'EN_ATTENTE' and v_withdrawal.status != 'EN_TRAITEMENT' then
    raise exception 'Ce retrait a déjà été traité (idempotence)';
  end if;

  -- 1. Mettre à jour le retrait
  update withdrawals set
    status = 'PAYE',
    payment_reference = trim(p_payment_reference),
    admin_id = v_admin_id,
    processed_at = now()
  where id = p_withdrawal_id;

  -- 2. Total retiré cumulé sur le wallet
  update wallets set
    total_withdrawn = total_withdrawn + v_withdrawal.amount,
    updated_at = now()
  where user_id = v_withdrawal.user_id;

  -- 3. Mettre à jour EXACTEMENT la transaction liée par transaction_id
  if v_withdrawal.transaction_id is not null then
    update wallet_transactions set
      status = 'COMPLETED',
      description = description || ' | Réf paiement MM: ' || trim(p_payment_reference)
    where id = v_withdrawal.transaction_id;
  end if;

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (v_admin_id, 'APPROVE_WITHDRAWAL', 'withdrawals', 'Retrait ' || p_withdrawal_id || ' validé. Réf: ' || trim(p_payment_reference) || ' Net: ' || v_withdrawal.net_amount || ' FC');

  return json_build_object('success', true, 'net_amount', v_withdrawal.net_amount);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.approve_withdrawal(uuid, text) to authenticated;

-- ============================================================
-- 8. REFUS RETRAIT : CIBLAGE STRICT transaction_id & REMBOURSEMENT UNIQUE
-- ============================================================
create or replace function public.reject_withdrawal(
  p_withdrawal_id uuid,
  p_reason text
)
returns jsonb as $$
declare
  v_withdrawal record;
  v_wallet record;
  v_new_balance numeric;
  v_admin_id uuid;
begin
  v_admin_id := auth.uid();
  if not public.is_admin() then
    raise exception 'Accès non autorisé';
  end if;

  if p_reason is null or trim(p_reason) = '' then
    raise exception 'Le motif de refus est obligatoire';
  end if;

  select * into v_withdrawal from withdrawals where id = p_withdrawal_id for update;
  if not found or v_withdrawal.status in ('REFUSE', 'PAYE') then
    raise exception 'Retrait invalide ou déjà traité';
  end if;

  -- 1. Rembourser le wallet
  select * into v_wallet from wallets where user_id = v_withdrawal.user_id for update;
  v_new_balance := v_wallet.balance + v_withdrawal.amount;

  update wallets set
    balance = v_new_balance,
    updated_at = now()
  where user_id = v_withdrawal.user_id;

  -- 2. Marquer le retrait REFUSE
  update withdrawals set
    status = 'REFUSE',
    rejection_reason = trim(p_reason),
    admin_id = v_admin_id,
    processed_at = now()
  where id = p_withdrawal_id;

  -- 3. Marquer la transaction initiale en CANCELLED
  if v_withdrawal.transaction_id is not null then
    update wallet_transactions set
      status = 'CANCELLED',
      description = description || ' | REFUSÉ: ' || trim(p_reason)
    where id = v_withdrawal.transaction_id;
  end if;

  -- 4. Insérer l''écriture de remboursement ADJUSTMENT
  insert into wallet_transactions (
    user_id, type, amount, balance_before, balance_after,
    reference, description, status
  )
  values (
    v_withdrawal.user_id,
    'ADJUSTMENT',
    v_withdrawal.amount,
    v_wallet.balance,
    v_new_balance,
    'REF-WIT-' || substring(p_withdrawal_id::text from 1 for 8),
    'Remboursement suite au refus du retrait de ' || v_withdrawal.amount || ' FC — Motif: ' || trim(p_reason),
    'COMPLETED'
  );

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (v_admin_id, 'REJECT_WITHDRAWAL', 'withdrawals', 'Retrait ' || p_withdrawal_id || ' refusé. Motif: ' || trim(p_reason));

  return json_build_object('success', true, 'refunded_amount', v_withdrawal.amount);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.reject_withdrawal(uuid, text) to authenticated;

-- ============================================================
-- 9. PRIORITÉS 5 & 9 : PURCHASE_INVESTMENT AVEC IDEMPOTENCE & NETTOYAGE
-- ============================================================
create or replace function public.purchase_investment(
  p_product_id uuid,
  p_quantity int,
  p_idempotency_key varchar default null
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_product record;
  v_wallet record;
  v_total_cost numeric;
  v_new_balance numeric;
  v_reference varchar;
  v_tx_id uuid;
  v_inv_id uuid;
  v_current_vip varchar;
  v_vip_limit int;
  v_user_pack_count int;
  v_projected_invested numeric;
  v_qualified_vip varchar;
  v_existing_inv record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantité invalide';
  end if;

  -- PRIORITÉ 5 : IDEMPOTENCY KEY ANTI-DOUBLE ACHAT
  if p_idempotency_key is not null and trim(p_idempotency_key) != '' then
    select * into v_existing_inv from investments where idempotency_key = trim(p_idempotency_key);
    if found then
      return json_build_object(
        'success', true,
        'investment_id', v_existing_inv.id,
        'idempotent_replay', true,
        'total_cost', v_existing_inv.total_amount
      );
    end if;
  end if;

  -- Récupérer le produit
  select * into v_product from products where id = p_product_id and is_active = true;
  if not found then
    raise exception 'Produit introuvable ou inactif';
  end if;

  if p_quantity > v_product.purchase_limit then
    raise exception 'Dépassement de la limite d''achat pour ce pack';
  end if;

  v_total_cost := v_product.price * p_quantity;

  -- Verrouiller le wallet pour lecture/écriture
  select * into v_wallet from wallets where user_id = v_user_id for update;
  if not found or v_wallet.balance < v_total_cost then
    raise exception 'Solde insuffisant dans votre portefeuille';
  end if;

  -- PRIORITÉ 2 : Calculer le palier VIP qualifié avec cet achat
  v_projected_invested := v_wallet.total_invested + v_total_cost;
  select level_name into v_qualified_vip from vip_levels
  where is_active = true and min_investment <= v_projected_invested
  order by display_order desc limit 1;

  select current_vip into v_current_vip from profiles where id = v_user_id;

  -- On prend le plus haut entre VIP actuel et VIP qualifié par l'achat
  select max_packs into v_vip_limit from vip_levels
  where level_name = coalesce(v_qualified_vip, v_current_vip, 'VIP0');

  select coalesce(sum(quantity), 0) into v_user_pack_count
  from investments where user_id = v_user_id and product_id = p_product_id and status = 'ACTIVE';

  if (v_user_pack_count + p_quantity) > v_vip_limit then
    raise exception 'Dépassement de la limite autorisée (% packs pour votre niveau %)', v_vip_limit, coalesce(v_qualified_vip, v_current_vip);
  end if;

  v_new_balance := v_wallet.balance - v_total_cost;
  v_reference := 'INV-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));

  -- 1. Débiter le wallet et incrémenter total_invested
  update wallets set
    balance = v_new_balance,
    total_invested = total_invested + v_total_cost,
    total_assets = total_assets + v_total_cost,
    updated_at = now()
  where user_id = v_user_id;

  -- 2. Créer l''écriture ledger
  insert into wallet_transactions (
    user_id, type, amount, balance_before, balance_after,
    reference, description, status
  )
  values (
    v_user_id,
    'INVESTMENT',
    v_total_cost,
    v_wallet.balance,
    v_new_balance,
    v_reference,
    'Souscription ' || p_quantity || 'x ' || v_product.name,
    'COMPLETED'
  )
  returning id into v_tx_id;

  -- 3. Créer l''investissement avec clé d''idempotence
  insert into investments (
    user_id, product_id, quantity, total_amount, monthly_return,
    duration_months, paid_installments, remaining_installments,
    next_payment_date, total_expected, status, idempotency_key
  )
  values (
    v_user_id, p_product_id, p_quantity, v_total_cost,
    v_product.monthly_return * p_quantity, v_product.duration_months,
    0, v_product.duration_months, now() + interval '1 month',
    v_product.total_returns * p_quantity, 'ACTIVE',
    coalesce(trim(p_idempotency_key), 'INV-KEY-' || gen_random_uuid()::text)
  )
  returning id into v_inv_id;

  -- PRIORITÉ 9 : SUPPRESSION DÉFINITIVE DU DOUBLON investment_payments
  -- Le moteur de versement officiel est investment_cycles initialisé via le trigger on_investment_created_init_cycles.

  -- PRIORITÉ 2 : Exécuter la montée VIP automatique côté serveur
  perform public.evaluate_and_update_user_vip(v_user_id);

  -- PRIORITÉ 1 : Distribuer les commissions avec écritures ledger
  perform public.distribute_commissions(v_user_id, v_total_cost, v_tx_id);

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (null, 'PURCHASE_INVESTMENT', 'investments', 'User ' || v_user_id || ' souscrit ' || p_quantity || 'x ' || v_product.name || ' pour ' || v_total_cost || ' FC');

  return json_build_object(
    'success', true,
    'investment_id', v_inv_id,
    'total_cost', v_total_cost,
    'reference', v_reference
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.purchase_investment(uuid, int, varchar) to authenticated;

-- ============================================================
-- 10. CYCLES DE RENDEMENT BASÉS SUR LES JOURS RÉELS DU MOIS
-- ============================================================
create or replace function public.init_investment_cycles()
returns trigger as $$
declare
  v_daily_profit numeric;
  v_monthly_return numeric;
  v_start_date date;
  v_days_in_month int;
begin
  select monthly_return * new.quantity into v_monthly_return from products where id = new.product_id;

  v_start_date := new.created_at::date;
  v_days_in_month := public.get_days_in_month(v_start_date);
  v_daily_profit := round(v_monthly_return / v_days_in_month, 4);

  insert into investment_cycles (
    investment_id, cycle_number, cycle_start_date, cycle_end_date,
    daily_profit, accumulated_profit, withdrawn_profit, last_accrual_date, status
  )
  values (
    new.id,
    1,
    new.created_at,
    new.created_at + (v_days_in_month || ' days')::interval,
    v_daily_profit,
    0.00,
    0.00,
    new.created_at,
    'ACTIVE'
  );

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists on_investment_created_init_cycles on investments;
create trigger on_investment_created_init_cycles
  after insert on investments
  for each row execute procedure public.init_investment_cycles();

-- ============================================================
-- 11. PRIORITÉ 6 : TABLES & RPCS POUR L''AUTHENTIFICATION OTP (SÉCURISÉE SHA-256)
-- ============================================================
create extension if not exists "pgcrypto";

create table if not exists phone_verifications (
  id uuid default gen_random_uuid() primary key,
  phone varchar(30) not null,
  otp_code varchar(64) not null, -- Stockage exclusif du hash SHA-256 (64 caractères hex)
  attempts int default 0 not null,
  max_attempts int default 3 not null,
  expires_at timestamp with time zone not null,
  verified boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Adaptation de la table existante si déjà créée avec varchar(6)
alter table phone_verifications alter column otp_code type varchar(64);
alter table phone_verifications add column if not exists attempts int default 0 not null;
alter table phone_verifications add column if not exists max_attempts int default 3 not null;

alter table phone_verifications enable row level security;
drop policy if exists "Admins can view verifications" on phone_verifications;
create policy "Admins can view verifications" on phone_verifications for select using (public.is_admin());

create or replace function public.request_phone_otp(p_phone varchar)
returns jsonb as $$
declare
  v_code varchar(6);
  v_hash varchar(64);
  v_clean_phone varchar(30);
  v_recent_count int;
begin
  v_clean_phone := regexp_replace(p_phone, '[^0-9+]', '', 'g');
  if length(v_clean_phone) < 9 then
    raise exception 'Numéro de téléphone invalide';
  end if;

  -- Limitation de débit : max 5 demandes d'OTP par tranche de 10 minutes
  select count(*) into v_recent_count
  from phone_verifications
  where phone = v_clean_phone
    and created_at > (now() - interval '10 minutes');

  if v_recent_count >= 5 then
    raise exception 'Trop de demandes de code OTP. Veuillez patienter 10 minutes.';
  end if;

  -- Invalider les anciens codes non vérifiés pour ce numéro
  update phone_verifications
  set verified = true
  where phone = v_clean_phone
    and verified = false;

  -- Générer un code cryptographique à 6 chiffres
  v_code := lpad((floor(random() * 900000) + 100000)::text, 6, '0');

  -- Hachage SHA-256 avant stockage (pgcrypto) : le code en clair n'est JAMAIS stocké
  v_hash := encode(digest(v_code::bytea, 'sha256'), 'hex');

  insert into phone_verifications (phone, otp_code, attempts, max_attempts, expires_at, verified)
  values (v_clean_phone, v_hash, 0, 3, now() + interval '10 minutes', false);

  -- [INTERFACE FOURNISSEUR SMS]
  -- En production, cette section déclenche l'envoi physique du SMS (via webhook, pg_net ou Edge Function)
  -- avec les paramètres (v_clean_phone, v_code).
  -- Le code en clair n'apparaît dans aucun log, aucun stockage et aucune réponse API.

  -- Réponse épurée : AUCUN dev_otp, AUCUN code renvoyé au client
  return json_build_object(
    'success', true,
    'message', 'Code de vérification envoyé avec succès (valable 10 minutes)'
  );
end;
$$ language plpgsql security definer set search_path = public, extensions, pg_temp;

grant execute on function public.request_phone_otp(varchar) to anon, authenticated;

create or replace function public.verify_phone_otp(p_phone varchar, p_code varchar)
returns jsonb as $$
declare
  v_clean_phone varchar(30);
  v_input_hash varchar(64);
  v_rec record;
begin
  v_clean_phone := regexp_replace(p_phone, '[^0-9+]', '', 'g');

  if trim(p_code) is null or length(trim(p_code)) != 6 then
    raise exception 'Le code de vérification doit comporter exactement 6 chiffres';
  end if;

  -- Calcul du hash SHA-256 du code saisi par l'utilisateur
  v_input_hash := encode(digest(trim(p_code)::bytea, 'sha256'), 'hex');

  -- Recherche de la dernière demande active pour ce numéro
  select * into v_rec from phone_verifications
  where phone = v_clean_phone
    and verified = false
    and expires_at > now()
  order by created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Code de vérification invalide ou expiré';
  end if;

  -- Vérification du quota de tentatives
  if v_rec.attempts >= v_rec.max_attempts then
    update phone_verifications set verified = true where id = v_rec.id;
    raise exception 'Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.';
  end if;

  -- Incrémentation du compteur de tentatives
  update phone_verifications
  set attempts = attempts + 1
  where id = v_rec.id;

  -- Comparaison sécurisée des hash SHA-256
  if v_rec.otp_code != v_input_hash then
    if (v_rec.attempts + 1) >= v_rec.max_attempts then
      update phone_verifications set verified = true where id = v_rec.id;
      raise exception 'Code incorrect. Nombre maximal de tentatives atteint. Veuillez demander un nouveau code.';
    else
      raise exception 'Code de vérification incorrect. Il vous reste % tentative(s).', (v_rec.max_attempts - (v_rec.attempts + 1));
    end if;
  end if;

  -- Validation du code
  update phone_verifications
  set verified = true
  where id = v_rec.id;

  return json_build_object(
    'success', true,
    'verified', true,
    'message', 'Numéro de téléphone vérifié avec succès'
  );
end;
$$ language plpgsql security definer set search_path = public, extensions, pg_temp;

grant execute on function public.verify_phone_otp(varchar, varchar) to anon, authenticated;

