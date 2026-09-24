-- ============================================================================
-- BISO INVEST — MIGRATION 013 : VALIDATION QUOTIDIENNE DU BÉNÉFICE (VENDRE)
-- ============================================================================
-- Règle financière officielle : le bénéfice d'une journée est exactement
-- 10 % du capital total de l'investissement, arrondi à deux décimales.
-- Le capital est lu dans le snapshot investments.total_amount ; aucune valeur
-- mutable du produit n'est utilisée pour calculer le crédit.
--
-- La date métier est la date calendaire à Africa/Kinshasa.  Une réclamation
-- porte sur un seul investissement et ne peut être faite qu'une fois pour
-- cette date.  Un jour non réclamé est perdu : il n'est jamais reporté.
-- La propriété, le calcul, le wallet et le ledger sont contrôlés par cette
-- RPC SECURITY DEFINER ; le client ne fournit ni montant ni date.
-- ============================================================================

-- 1. TABLE profit_claims (historique des bénéfices réclamés)
create table if not exists profit_claims (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  investment_id uuid references investments(id) on delete cascade not null,
  cycle_id uuid references investment_cycles(id) on delete set null,
  -- Cette date est toujours calculée en Africa/Kinshasa par la RPC.
  profit_date date not null,
  amount numeric(15,2) not null check (amount >= 0),
  claimed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  transaction_id uuid references wallet_transactions(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint profit_claims_one_per_day unique (investment_id, profit_date)
);

create index if not exists idx_profit_claims_user_date
  on profit_claims (user_id, profit_date desc);
create index if not exists idx_profit_claims_inv_date
  on profit_claims (investment_id, profit_date desc);

comment on table public.profit_claims is
  'Une ligne par investissement et par date métier Africa/Kinshasa; le bénéfice est 10% du capital snapshot.';

-- 2. RLS : un utilisateur ne voit QUE ses propres réclamations
alter table profit_claims enable row level security;

drop policy if exists "Users can view own profit claims" on profit_claims;
create policy "Users can view own profit claims"
  on profit_claims for select
  using (auth.uid() = user_id);

-- Les INSERT / UPDATE transitent exclusivement par la RPC security definer
-- ci-dessous (qui contourne la RLS en tant que propriétaire) — aucun accès
-- direct n'est accordé.
grant select on profit_claims to authenticated;

-- 3. Le ledger doit accepter le nouveau type DAILY_PROFIT (contrainte mise à jour)
alter table wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table wallet_transactions
  add constraint wallet_transactions_type_check
  check (type in (
    'DEPOSIT', 'INVESTMENT', 'INVESTMENT_PAYMENT', 'DAILY_PROFIT',
    'WITHDRAWAL', 'COMMISSION', 'REFERRAL_TASK_REWARD', 'COUPON', 'ADJUSTMENT'
  ));

-- 4. RPC sécurisée, par investissement : claim_daily_profit(uuid)
-- La signature par carte est intentionnelle : un appel ne peut jamais créditer
-- tous les investissements d'un utilisateur, et le requested investment_id est
-- filtré par user_id avant toute écriture.
create or replace function public.claim_daily_profit(p_investment_id uuid)
returns jsonb as $$
declare
  v_user_id uuid;
  v_now timestamp with time zone;
  v_business_date date;
  v_inv record;
  v_wallet record;
  v_cycle_id uuid;
  v_amount numeric;
  v_new_balance numeric;
  v_claim_id uuid;
  v_tx_id uuid;
  v_reference varchar;
begin
  -- 1. Utilisateur connecté uniquement.
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  v_now := now();
  v_business_date := (v_now at time zone 'Africa/Kinshasa')::date;

  -- 2. Verrouiller l'investissement ET vérifier la propriété.  Cette requête
  --    rend impossible la réclamation directe d'un investissement d'un tiers.
  select *
    into v_inv
  from public.investments
  where id = p_investment_id
    and user_id = v_user_id
  for update;

  if not found then
    raise exception 'Investissement introuvable ou accès refusé';
  end if;

  if v_inv.status <> 'ACTIVE' then
    raise exception 'Investissement non actif';
  end if;

  if v_now < v_inv.created_at then
    raise exception 'Investissement pas encore actif';
  end if;

  -- 3. La période contractuelle est une fenêtre de dates, pas une durée
  --    dépendant du mois courant.  La migration 030 remplacera cette fenêtre
  --    par le snapshot ends_at; cette garde reste nécessaire pour le replay
  --    historique et les bases déployées avant 030.
  if v_now >= v_inv.created_at
     + (coalesce(v_inv.duration_months, 3) * interval '1 month')
     or v_business_date >= (
       (v_inv.created_at
        + (coalesce(v_inv.duration_months, 3) * interval '1 month'))
       at time zone 'Africa/Kinshasa'
     )::date then
    raise exception 'Investissement terminé';
  end if;

  -- 4. Verrou du wallet : sérialise les crédits et permet d'écrire des
  --    balances avant/après exactes dans le ledger.
  select * into v_wallet
  from public.wallets
  where user_id = v_user_id
  for update;
  if not found then
    raise exception 'Wallet introuvable';
  end if;

  -- 5. Snapshot du capital de l'investissement, jamais le produit courant.
  v_amount := round(v_inv.total_amount * 0.10, 2);
  if v_amount <= 0 then
    raise exception 'Bénéfice journalier nul';
  end if;

  -- 6. Cycle correspondant, uniquement pour l'historique.  Le montant crédité
  --    reste celui du capital snapshot, même si un cycle a une ancienne valeur.
  select c.id into v_cycle_id
  from public.investment_cycles c
  where c.investment_id = v_inv.id
    and c.status = 'ACTIVE'
    and c.cycle_start_date <= v_now
    and c.cycle_end_date > v_now
  order by c.cycle_number asc
  limit 1;

  -- 7. La contrainte unique (investment_id, profit_date) est l'atomicité de
  --    l'idempotence.  Si la ligne existe déjà, aucun wallet/ledger n'est touché.
  insert into public.profit_claims (
    user_id, investment_id, cycle_id, profit_date, amount, claimed_at
  )
  values (
    v_user_id, v_inv.id, v_cycle_id, v_business_date, v_amount, v_now
  )
  on conflict (investment_id, profit_date) do nothing
  returning id into v_claim_id;

  if v_claim_id is null then
    return json_build_object(
      'success', true,
      'investment_id', p_investment_id,
      'claimed_amount', 0,
      'already_claimed_today', true,
      'new_balance', v_wallet.balance,
      'business_date', v_business_date,
      'message', 'Bénéfice déjà réclamé pour cette date métier'
    );
  end if;

  -- 8. Crédit atomique du wallet, avec le montant exact de la réclamation.
  v_new_balance := round(v_wallet.balance + v_amount, 2);
  update public.wallets
  set balance = v_new_balance,
      total_earned = total_earned + v_amount,
      today_earned = today_earned + v_amount,
      updated_at = now()
  where user_id = v_user_id;

  -- 9. Une écriture ledger déterministe : une seule entrée par investissement
  --    et par business_date, en plus de la contrainte de profit_claims.
  v_reference := 'DAILY-'
    || upper(substring(replace(p_investment_id::text, '-', '') from 1 for 32))
    || '-' || to_char(v_business_date, 'YYYYMMDD');

  insert into public.wallet_transactions (
    user_id, type, amount, balance_before, balance_after,
    reference, description, status
  )
  values (
    v_user_id,
    'DAILY_PROFIT',
    v_amount,
    v_wallet.balance,
    v_new_balance,
    v_reference,
    'Bénéfice quotidien 10% du capital — ' || to_char(v_business_date, 'DD/MM/YYYY'),
    'COMPLETED'
  )
  returning id into v_tx_id;

  update public.profit_claims
  set transaction_id = v_tx_id
  where id = v_claim_id;

  insert into public.admin_logs (admin_id, action, target_object, new_value)
  values (
    null,
    'DAILY_PROFIT_CLAIM',
    'profit_claims',
    'User ' || v_user_id || ' a vendu ' || v_amount
      || ' FC pour l''investissement ' || p_investment_id
      || ' (date métier ' || v_business_date || ')'
  );

  return json_build_object(
    'success', true,
    'investment_id', p_investment_id,
    'claimed_amount', v_amount,
    'already_claimed_today', false,
    'new_balance', v_new_balance,
    'transaction_id', v_tx_id,
    'business_date', v_business_date
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

revoke execute on function public.claim_daily_profit(uuid) from public, anon;
grant execute on function public.claim_daily_profit(uuid) to authenticated;

comment on function public.claim_daily_profit(uuid) is
  'Réclame exactement 10% du capital snapshot, une fois par date métier Africa/Kinshasa, pour un investissement appartenant à auth.uid().';
