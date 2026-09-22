-- BISO INVEST - MIGRATION 005 (REVISED): DAILY YIELD & 30-DAY CYCLES FOR INVESTMENTS

-- 1. INVESTMENT CYCLES TABLE
create table if not exists investment_cycles (
  id uuid default gen_random_uuid() primary key,
  investment_id uuid references investments(id) on delete cascade not null,
  cycle_number int not null check (cycle_number between 1 and 12),
  cycle_start_date timestamp with time zone not null,
  cycle_end_date timestamp with time zone not null,
  daily_profit numeric(15,2) not null,
  accumulated_profit numeric(15,2) default 0.00 not null,
  withdrawn_profit numeric(15,2) default 0.00 not null,
  last_accrual_date timestamp with time zone not null,
  status varchar(20) default 'ACTIVE' check (status in ('ACTIVE', 'COMPLETED')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (investment_id, cycle_number)
);

-- Enable RLS on investment_cycles
alter table investment_cycles enable row level security;

create policy "Users can view own investment cycles" on investment_cycles for select using (
  exists (select 1 from investments where investments.id = investment_cycles.investment_id and investments.user_id = auth.uid())
  or public.is_admin()
);

create policy "Admins can manage investment cycles" on investment_cycles for all using (public.is_admin());


-- 2. TRIGGER / HELPER TO INIT CYCLES WHEN INVESTMENT IS CREATED
create or replace function public.init_investment_cycles()
returns trigger as $$
declare
  v_daily_profit numeric;
  v_monthly_return numeric;
begin
  select monthly_return into v_monthly_return from products where id = new.product_id;
  v_daily_profit := v_monthly_return / 30.0;

  -- Insert Cycle 1 (30 days)
  insert into investment_cycles (investment_id, cycle_number, cycle_start_date, cycle_end_date, daily_profit, accumulated_profit, withdrawn_profit, last_accrual_date, status)
  values (
    new.id,
    1,
    new.created_at,
    new.created_at + interval '30 days',
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


-- 3. ACCRUAL INVESTMENT YIELDS FUNCTION (Internal helper)
create or replace function public.accrual_investment_yields(p_investment_id uuid)
returns void as $$
declare
  v_inv record;
  v_cycle record;
  v_now timestamp with time zone := now();
  v_days_diff int;
  v_max_cycles int := 12;
begin
  select * into v_inv from investments where id = p_investment_id for update;
  if not found or v_inv.status != 'ACTIVE' then
    return;
  end if;

  loop
    select * into v_cycle from investment_cycles where investment_id = p_investment_id and status = 'ACTIVE' order by cycle_number asc limit 1 for update;
    if not found or v_cycle.cycle_number > v_max_cycles then
      exit;
    end if;

    if v_now >= v_cycle.cycle_end_date then
      v_days_diff := extract(day from (v_cycle.cycle_end_date - v_cycle.last_accrual_date))::int;
      if v_days_diff > 0 then
        update investment_cycles set
          accumulated_profit = accumulated_profit + (v_days_diff * daily_profit),
          last_accrual_date = v_cycle.cycle_end_date
        where id = v_cycle.id;
      end if;

      update investment_cycles set status = 'COMPLETED' where id = v_cycle.id;

      if v_cycle.cycle_number < v_max_cycles then
        insert into investment_cycles (investment_id, cycle_number, cycle_start_date, cycle_end_date, daily_profit, accumulated_profit, withdrawn_profit, last_accrual_date, status)
        values (
          p_investment_id,
          v_cycle.cycle_number + 1,
          v_cycle.cycle_end_date,
          v_cycle.cycle_end_date + interval '30 days',
          v_cycle.daily_profit,
          0.00,
          0.00,
          v_cycle.cycle_end_date,
          'ACTIVE'
        )
        on conflict (investment_id, cycle_number) do nothing;
      else
        exit;
      end if;
    else
      v_days_diff := extract(day from (v_now - v_cycle.last_accrual_date))::int;
      if v_days_diff > 0 then
        update investment_cycles set
          accumulated_profit = accumulated_profit + (v_days_diff * daily_profit),
          last_accrual_date = v_now
        where id = v_cycle.id;
      end if;
      exit;
    end if;
  end loop;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Revoke accrual execution from anon / public for security
revoke execute on function public.accrual_investment_yields(uuid) from public, anon;


-- 4. CLAIM INVESTMENT PROFIT RPC (Atomic, partial/total, FOR UPDATE protection)
create or replace function public.claim_investment_profit(
  p_investment_id uuid,
  p_cycle_id uuid,
  p_amount numeric
)
returns jsonb as $$
declare
  v_user_id uuid;
  v_inv record;
  v_cycle record;
  v_wallet record;
  v_available_profit numeric;
  v_new_balance numeric;
  v_ref varchar;
  v_tx_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  if p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;

  -- 1. Verify investment ownership
  select * into v_inv from investments where id = p_investment_id and user_id = v_user_id for update;
  if not found then
    raise exception 'Investissement introuvable ou accès refusé';
  end if;

  -- 2. Run accrual to ensure accumulated_profit is up to date
  perform public.accrual_investment_yields(p_investment_id);

  -- 3. Lock specific cycle
  select * into v_cycle from investment_cycles where id = p_cycle_id and investment_id = p_investment_id for update;
  if not found then
    raise exception 'Cycle introuvable';
  end if;

  v_available_profit := v_cycle.accumulated_profit - v_cycle.withdrawn_profit;

  if p_amount > v_available_profit then
    raise exception 'Montant demandé supérieur au bénéfice disponible (%)', v_available_profit;
  end if;

  -- 4. Unique transaction reference for this specific claim
  v_ref := 'CLAIM-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));

  -- 5. Lock wallet with explicit check
  select * into v_wallet from wallets where user_id = v_user_id for update;
  if not found then
    raise exception 'Wallet introuvable';
  end if;

  v_new_balance := v_wallet.balance + p_amount;

  -- 6. Update cycle withdrawn profit
  update investment_cycles set
    withdrawn_profit = withdrawn_profit + p_amount
  where id = v_cycle.id;

  -- 7. Update wallet balance and total earned
  update wallets set
    balance = v_new_balance,
    total_earned = total_earned + p_amount,
    today_earned = today_earned + p_amount,
    updated_at = now()
  where user_id = v_user_id;

  -- 8. Create ledger transaction
  insert into wallet_transactions (user_id, type, amount, balance_before, balance_after, reference, description, status)
  values (v_user_id, 'INVESTMENT_PAYMENT', p_amount, v_wallet.balance, v_new_balance, v_ref, 'Retrait bénéfice cycle ' || v_cycle.cycle_number, 'COMPLETED')
  returning id into v_tx_id;

  -- 9. Audit log (admin_id is null for user actions)
  insert into admin_logs (admin_id, action, target_object, new_value)
  values (null, 'CLAIM_PROFIT', 'investment_cycles', 'User ' || v_user_id || ' claimed ' || p_amount || ' FC on cycle ' || v_cycle.cycle_number);

  return json_build_object('success', true, 'claimed_amount', p_amount, 'new_balance', v_new_balance);
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.claim_investment_profit(uuid, uuid, numeric) to authenticated;
