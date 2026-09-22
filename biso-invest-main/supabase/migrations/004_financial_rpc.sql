-- BISO INVEST - MIGRATION 004: SECURE FINANCIAL RPC FUNCTIONS (ATOMIC & IDEMPOTENT)

-- 1. COMMISSION DISTRIBUTION HELPER FUNCTION (IDEMPOTENT & ANTI-SELF-REFERRAL)
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
begin
  -- Idempotency check: prevent duplicate commission for same transaction
  if exists (select 1 from commissions where source_transaction_id = p_source_tx_id) then
    return;
  end if;

  -- Find upline chain A, B, C, D with anti-self-referral
  curr_parent := p_user_id;
  
  -- Level A (Direct parent)
  select parent_id into curr_parent from referrals where child_id = curr_parent and level = 'A';
  if curr_parent is not null and curr_parent != p_user_id then
    comm_rate := 10.0;
    comm_amt := (p_base_amount * comm_rate) / 100.0;
    
    insert into commissions (beneficiary_id, source_user_id, level, base_amount, rate, commission_amount, source_transaction_id, status)
    values (curr_parent, p_user_id, 'A', p_base_amount, comm_rate, comm_amt, p_source_tx_id, 'PAID');
    
    update wallets set balance = balance + comm_amt, team_earned = team_earned + comm_amt, total_earned = total_earned + comm_amt
    where user_id = curr_parent;
    
    -- Level B
    select parent_id into curr_parent from referrals where child_id = curr_parent and level = 'A';
    if curr_parent is not null and curr_parent != p_user_id then
      comm_rate := 3.0;
      comm_amt := (p_base_amount * comm_rate) / 100.0;
      
      insert into commissions (beneficiary_id, source_user_id, level, base_amount, rate, commission_amount, source_transaction_id, status)
      values (curr_parent, p_user_id, 'B', p_base_amount, comm_rate, comm_amt, p_source_tx_id, 'PAID');
      
      update wallets set balance = balance + comm_amt, team_earned = team_earned + comm_amt, total_earned = total_earned + comm_amt
      where user_id = curr_parent;

      -- Level C
      select parent_id into curr_parent from referrals where child_id = curr_parent and level = 'A';
      if curr_parent is not null and curr_parent != p_user_id then
        comm_rate := 1.0;
        comm_amt := (p_base_amount * comm_rate) / 100.0;
        
        insert into commissions (beneficiary_id, source_user_id, level, base_amount, rate, commission_amount, source_transaction_id, status)
        values (curr_parent, p_user_id, 'C', p_base_amount, comm_rate, comm_amt, p_source_tx_id, 'PAID');
        
        update wallets set balance = balance + comm_amt, team_earned = team_earned + comm_amt, total_earned = total_earned + comm_amt
        where user_id = curr_parent;

        -- Level D
        select parent_id into curr_parent from referrals where child_id = curr_parent and level = 'A';
        if curr_parent is not null and curr_parent != p_user_id then
          comm_rate := 1.0;
          comm_amt := (p_base_amount * comm_rate) / 100.0;
          
          insert into commissions (beneficiary_id, source_user_id, level, base_amount, rate, commission_amount, source_transaction_id, status)
          values (curr_parent, p_user_id, 'D', p_base_amount, comm_rate, comm_amt, p_source_tx_id, 'PAID');
          
          update wallets set balance = balance + comm_amt, team_earned = team_earned + comm_amt, total_earned = total_earned + comm_amt
          where user_id = curr_parent;
        end if;
      end if;
    end if;
  end if;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- 2. PURCHASE INVESTMENT RPC (Calls distribute_commissions)
create or replace function public.purchase_investment(
  p_product_id uuid,
  p_quantity int
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
  v_next_date timestamp with time zone;
  v_current_vip varchar;
  v_vip_limit int;
  v_user_pack_count int;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantité invalide';
  end if;

  -- Get product from DB (never trust client price)
  select * into v_product from products where id = p_product_id and is_active = true;
  if not found then
    raise exception 'Produit introuvable ou inactif';
  end if;

  if p_quantity > v_product.purchase_limit then
    raise exception 'Dépassement de la limite d''achat pour ce pack';
  end if;

  -- Get user VIP and limits
  select current_vip into v_current_vip from profiles where id = v_user_id;
  select max_packs into v_vip_limit from vip_levels where level_name = v_current_vip;

  select coalesce(sum(quantity), 0) into v_user_pack_count from investments where user_id = v_user_id and product_id = p_product_id and status = 'ACTIVE';
  if (v_user_pack_count + p_quantity) > v_vip_limit then
    raise exception 'Dépassement de la limite de packs autorisée par votre niveau VIP';
  end if;

  v_total_cost := v_product.price * p_quantity;

  -- Get wallet with row lock
  select * into v_wallet from wallets where user_id = v_user_id for update;
  if not found or v_wallet.balance < v_total_cost then
    raise exception 'Solde insuffisant dans le wallet';
  end if;

  v_new_balance := v_wallet.balance - v_total_cost;
  v_reference := 'INV-' || upper(substring(md5(random()::text) from 1 for 8));

  -- 1. Update wallet
  update wallets set
    balance = v_new_balance,
    total_invested = total_invested + v_total_cost,
    total_assets = total_assets + v_total_cost,
    updated_at = now()
  where user_id = v_user_id;

  -- 2. Create ledger transaction
  insert into wallet_transactions (user_id, type, amount, balance_before, balance_after, reference, description, status)
  values (v_user_id, 'INVESTMENT', v_total_cost, v_wallet.balance, v_new_balance, v_reference, 'Achat de ' || p_quantity || 'x ' || v_product.name, 'COMPLETED')
  returning id into v_tx_id;

  -- 3. Create investment
  v_next_date := now() + interval '1 month';
  insert into investments (user_id, product_id, quantity, total_amount, monthly_return, duration_months, paid_installments, remaining_installments, next_payment_date, total_expected, status)
  values (v_user_id, p_product_id, p_quantity, v_total_cost, v_product.monthly_return * p_quantity, v_product.duration_months, 0, v_product.duration_months, v_next_date, v_product.total_returns * p_quantity, 'ACTIVE')
  returning id into v_inv_id;

  -- 4. Create 12 installments
  for i in 1..v_product.duration_months loop
    insert into investment_payments (investment_id, installment_number, amount, scheduled_date, status)
    values (v_inv_id, i, v_product.monthly_return * p_quantity, now() + (i * interval '1 month'), 'SCHEDULED');
  end loop;

  -- 5. Distribute commissions (A:10%, B:3%, C:1%, D:1%)
  perform public.distribute_commissions(v_user_id, v_total_cost, v_tx_id);

  -- Audit log
  insert into admin_logs (admin_id, action, target_object, new_value)
  values (null, 'PURCHASE_INVESTMENT', 'investments', 'User ' || v_user_id || ' bought ' || p_quantity || 'x ' || v_product.name);

  return json_build_object('success', true, 'investment_id', v_inv_id, 'total_cost', v_total_cost);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- 3. CREATE WITHDRAWAL RPC (Minimum 5,000 FC)
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
    raise exception 'Compte de retrait introuvable';
  end if;

  select * into v_wallet from wallets where user_id = v_user_id for update;
  if not found or v_wallet.balance < p_amount then
    raise exception 'Solde insuffisant';
  end if;

  v_new_balance := v_wallet.balance - p_amount;
  v_ref := 'WIT-' || upper(substring(md5(random()::text) from 1 for 8));

  -- Deduct wallet balance immediately upon request submission
  update wallets set
    balance = v_new_balance,
    updated_at = now()
  where user_id = v_user_id;

  insert into wallet_transactions (user_id, type, amount, balance_before, balance_after, reference, description, status)
  values (v_user_id, 'WITHDRAWAL', p_amount, v_wallet.balance, v_new_balance, v_ref, 'Demande de retrait ' || p_amount || ' FC', 'PENDING');

  insert into withdrawals (user_id, withdrawal_account_id, amount, fee, net_amount, network, phone_number, status)
  values (v_user_id, p_withdrawal_account_id, p_amount, 0, p_amount, v_account.network, v_account.phone_number, 'EN_ATTENTE');

  return json_build_object('success', true);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- 4. APPROVE DEPOSIT RPC (Admin only, Idempotent)
create or replace function public.approve_deposit(
  p_deposit_id uuid
)
returns jsonb as $$
declare
  v_deposit record;
  v_wallet record;
  v_new_balance numeric;
  v_admin_id uuid;
begin
  v_admin_id := auth.uid();
  if not public.is_admin() then
    raise exception 'Accès non autorisé';
  end if;

  select * into v_deposit from deposits where id = p_deposit_id for update;
  if not found then
    raise exception 'Dépôt introuvable';
  end if;

  if v_deposit.status != 'EN_ATTENTE' then
    raise exception 'Ce dépôt a déjà été traité (idempotence)';
  end if;

  select * into v_wallet from wallets where user_id = v_deposit.user_id for update;
  v_new_balance := v_wallet.balance + v_deposit.amount;

  -- 1. Update deposit status
  update deposits set
    status = 'VALIDEE',
    admin_id = v_admin_id,
    validated_at = now()
  where id = p_deposit_id;

  -- 2. Credit wallet
  update wallets set
    balance = v_new_balance,
    total_deposited = total_deposited + v_deposit.amount,
    updated_at = now()
  where user_id = v_deposit.user_id;

  -- 3. Create ledger transaction
  insert into wallet_transactions (user_id, type, amount, balance_before, balance_after, reference, description, status)
  values (v_deposit.user_id, 'DEPOSIT', v_deposit.amount, v_wallet.balance, v_new_balance, v_deposit.reference, 'Recharge validée (' || v_deposit.network || ')', 'COMPLETED');

  -- 4. Audit log
  insert into admin_logs (admin_id, action, target_object, new_value)
  values (v_admin_id, 'APPROVE_DEPOSIT', 'deposits', 'Approved deposit ' || p_deposit_id || ' amount ' || v_deposit.amount);

  return json_build_object('success', true);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- 5. REJECT DEPOSIT RPC
create or replace function public.reject_deposit(
  p_deposit_id uuid,
  p_reason text
)
returns jsonb as $$
declare
  v_admin_id uuid;
begin
  v_admin_id := auth.uid();
  if not public.is_admin() then
    raise exception 'Accès non autorisé';
  end if;

  update deposits set
    status = 'REFUSEE',
    rejection_reason = p_reason,
    admin_id = v_admin_id
  where id = p_deposit_id and status = 'EN_ATTENTE';

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (v_admin_id, 'REJECT_DEPOSIT', 'deposits', 'Rejected deposit ' || p_deposit_id);

  return json_build_object('success', true);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- 6. APPROVE WITHDRAWAL RPC (Admin only, Idempotent)
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

  select * into v_withdrawal from withdrawals where id = p_withdrawal_id for update;
  if not found then
    raise exception 'Retrait introuvable';
  end if;

  if v_withdrawal.status != 'EN_ATTENTE' and v_withdrawal.status != 'EN_TRAITEMENT' then
    raise exception 'Ce retrait a déjà été traité (idempotence)';
  end if;

  update withdrawals set
    status = 'PAYE',
    payment_reference = p_payment_reference,
    admin_id = v_admin_id,
    processed_at = now()
  where id = p_withdrawal_id;

  -- Update wallet total withdrawn
  update wallets set
    total_withdrawn = total_withdrawn + v_withdrawal.amount,
    updated_at = now()
  where user_id = v_withdrawal.user_id;

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (v_admin_id, 'APPROVE_WITHDRAWAL', 'withdrawals', 'Approved withdrawal ' || p_withdrawal_id || ' ref ' || p_payment_reference);

  return json_build_object('success', true);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- 7. REJECT WITHDRAWAL RPC (Refunds wallet balance)
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

  select * into v_withdrawal from withdrawals where id = p_withdrawal_id for update;
  if not found or v_withdrawal.status = 'REFUSE' or v_withdrawal.status = 'PAYE' then
    raise exception 'Retrait invalide ou déjà traité';
  end if;

  -- Refund wallet
  select * into v_wallet from wallets where user_id = v_withdrawal.user_id for update;
  v_new_balance := v_wallet.balance + v_withdrawal.amount;

  update wallets set
    balance = v_new_balance,
    updated_at = now()
  where user_id = v_withdrawal.user_id;

  update withdrawals set
    status = 'REFUSE',
    rejection_reason = p_reason,
    admin_id = v_admin_id
  where id = p_withdrawal_id;

  insert into wallet_transactions (user_id, type, amount, balance_before, balance_after, reference, description, status)
  values (v_withdrawal.user_id, 'ADJUSTMENT', v_withdrawal.amount, v_wallet.balance, v_new_balance, 'REF-WIT-' || substring(p_withdrawal_id::text from 1 for 8), 'Remboursement suite au refus de retrait', 'COMPLETED');

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (v_admin_id, 'REJECT_WITHDRAWAL', 'withdrawals', 'Rejected withdrawal ' || p_withdrawal_id);

  return json_build_object('success', true);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
