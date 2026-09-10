-- ============================================================================
-- BISO INVEST — MIGRATION 013 : VALIDATION QUOTIDIENNE DU BÉNÉFICE (VENDRE)
-- ============================================================================
-- Objectif : l'investisseur doit cliquer sur « VENDRE » UNE FOIS PAR JOUR pour
-- créditer son bénéfice journalier (revenu mensuel / jours réels du mois).
--   - Un bénéfice non réclamé un jour est DÉFINITIVEMENT perdu (jamais reporté).
--   - Impossible de réclamer deux fois le bénéfice du même jour (contrainte
--     unique + FOR UPDATE + insert on conflict retournant la ligne créditée).
--   - Montant calculé et crédité côté serveur UNIQUEMENT (RPC security definer).
--   - Aucune donnée d'un autre utilisateur ne peut être lue ou créditée.
-- Aucune autre table/fonction existante n'est modifiée (wallets via RPC,
-- ledger, dépôts, retraits 15%, commissions, OTP, RLS existantes…).
-- ============================================================================

-- 1. TABLE profit_claims (historique des bénéfices réclamés)
create table if not exists profit_claims (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  investment_id uuid references investments(id) on delete cascade not null,
  cycle_id uuid references investment_cycles(id) on delete set null,
  profit_date date not null,
  amount numeric(15,2) not null,
  claimed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  transaction_id uuid references wallet_transactions(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint profit_claims_one_per_day unique (investment_id, profit_date)
);

create index if not exists idx_profit_claims_user_date on profit_claims (user_id, profit_date desc);
create index if not exists idx_profit_claims_inv_date on profit_claims (investment_id, profit_date desc);

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

-- 3. RPC sécurisée claim_daily_profit()
create or replace function public.claim_daily_profit()
returns jsonb as $$
declare
  v_user_id uuid;
  v_wallet record;
  v_days int;
  v_daily numeric;
  v_amt numeric;
  v_total numeric := 0;
  v_claim_id uuid;
  v_claim_ids uuid[] := '{}';
  v_tx_id uuid;
  v_ref varchar;
  v_new_balance numeric;
  v_cycle_id uuid;
  v_inv record;
begin
  -- 1. Utilisateur connecté uniquement
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  -- Verrou du wallet : toute réclamation concurrente attend ici (anti double-clic)
  select * into v_wallet from wallets where user_id = v_user_id for update;
  if not found then
    raise exception 'Wallet introuvable';
  end if;

  -- Nombre réel de jours du mois courant (28/29/30/31)
  v_days := public.get_days_in_month(current_date);
  v_ref := 'DAILY-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));

  -- 2/3. Investissements actifs ET encore dans leur période (durée en mois)
  for v_inv in
    select i.id, i.monthly_return, i.status
    from investments i
    where i.user_id = v_user_id
      and i.status = 'ACTIVE'
      and (i.created_at + (i.duration_months * interval '1 month')) > now()
    order by i.created_at asc
    for update of i
  loop
    -- Cycle actuel de référence (pour l'historique) s'il en existe un
    select c.id into v_cycle_id
    from investment_cycles c
    where c.investment_id = v_inv.id
      and c.status = 'ACTIVE'
    order by c.cycle_number asc
    limit 1;

    -- 4. Bénéfice journalier = revenu mensuel / jours réels du mois
    v_daily := round(v_inv.monthly_return / v_days, 2);

    -- 5/9. Insertion atomique : la contrainte unique (investment_id, profit_date)
    --      garantit qu'un même jour ne peut être crédité qu'UNE fois, même en
    --      cas d'appels simultanés. Si la ligne existe déjà, rien n'est retourné.
    v_amt := null;
    insert into profit_claims (user_id, investment_id, cycle_id, profit_date, amount, claimed_at, transaction_id)
    values (v_user_id, v_inv.id, v_cycle_id, current_date, v_daily, now(), null)
    on conflict (investment_id, profit_date) do nothing
    returning id, amount into v_claim_id, v_amt;

    if v_amt is not null then
      v_total := v_total + v_amt;
      v_claim_ids := array_append(v_claim_ids, v_claim_id);
    end if;
  end loop;

  -- 8. Rien à créditer aujourd'hui (déjà vendu ou aucun bénéfice disponible)
  if v_total <= 0 then
    return json_build_object(
      'success', true,
      'claimed_amount', 0,
      'already_claimed_today', true,
      'new_balance', v_wallet.balance,
      'message', 'Aucun bénéfice à réclamer aujourd''hui'
    );
  end if;

  -- 6. Crédit atomique du wallet
  v_new_balance := v_wallet.balance + v_total;

  update wallets set
    balance = v_new_balance,
    total_earned = total_earned + v_total,
    today_earned = today_earned + v_total,
    updated_at = now()
  where user_id = v_user_id;

  -- 7. Écriture unique dans le ledger
  insert into wallet_transactions (user_id, type, amount, balance_before, balance_after, reference, description, status)
  values (v_user_id, 'DAILY_PROFIT', v_total, v_wallet.balance, v_new_balance, v_ref, 'Bénéfice du jour (VENDRE)', 'COMPLETED')
  returning id into v_tx_id;

  -- 8. Liaison de l'historique de réclamation à la transaction
  update profit_claims set transaction_id = v_tx_id where id = any(v_claim_ids);

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (null, 'DAILY_PROFIT_CLAIM', 'profit_claims', 'User ' || v_user_id || ' a vendu son bénéfice du jour : ' || v_total || ' FC (' || array_length(v_claim_ids, 1) || ' investissement(s))');

  return json_build_object(
    'success', true,
    'claimed_amount', v_total,
    'new_balance', v_new_balance,
    'transaction_id', v_tx_id,
    'already_claimed_today', false,
    'claims_count', array_length(v_claim_ids, 1)
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.claim_daily_profit() to authenticated;