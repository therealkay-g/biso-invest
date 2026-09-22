-- ============================================================================
-- BISO INVEST — MIGRATION 015 : TÂCHES D'INVITATION
-- REMPLACEMENT DU SYSTÈME DE PARRAINAGE A/B/C/D
-- ============================================================================
-- Objectif : une invitation ne rapporte que si le filleul investit réellement
-- (investissement validé côté serveur). Récompenses par paliers, réclamées
-- UNE SEULE FOIS chacun, créditées atomiquement dans le ledger.
--
--   - L'ancien parrainage A/B/C/D est DÉSACTIVÉ (distribute_commissions no-op).
--   - L'historique des anciennes commissions reste consultable (jamais supprimé).
--   - Le décompte des invités valides est 100% serveur (RPC security definer).
--   - Le frontend ne peut ni décider, ni modifier le nombre d'invitations,
--     ni créditer le wallet manuellement.
-- ============================================================================

-- ============================================================================
-- 0. DÉSACTIVATION DE L'ANCIEN SYSTÈME A/B/C/D (COMMISSIONS AUTOMATIQUES)
-- ============================================================================
-- purchase_investment() appelle toujours distribute_commissions(), mais la
-- fonction ne crédite désormais PLUS rien. Les interventions A/B/C/D déjà
-- enregistrées dans `commissions` et le ledger restent intacts.
create or replace function public.distribute_commissions(
  p_user_id uuid,
  p_base_amount numeric,
  p_source_tx_id uuid
)
returns void as $$
begin
  -- DÉSACTIVÉ : l'ancien parrainage A/B/C/D ne génère plus de commissions.
  -- L'historique des commissions déjà créditées reste consultable.
  return;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.distribute_commissions(uuid, numeric, uuid) to authenticated;

-- ============================================================================
-- 1. TABLES « TÂCHES D'INVITATION »
-- ============================================================================
create table if not exists referral_tasks (
  id uuid default gen_random_uuid() primary key,
  required_invites int not null unique,
  reward_amount numeric(15,2) not null,
  display_order int not null default 0,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists referral_task_rewards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  task_id uuid references referral_tasks(id) on delete cascade not null,
  required_invites int not null,
  reward_amount numeric(15,2) not null,
  transaction_id uuid references wallet_transactions(id) on delete set null,
  claimed_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint referral_task_rewards_one_claim unique (user_id, task_id)
);

create index if not exists idx_referral_task_rewards_user on referral_task_rewards (user_id, claimed_at desc);

-- 1.1 Paliers officiels (idempotent)
insert into referral_tasks (required_invites, reward_amount, display_order)
values
  (1, 3000, 1),
  (5, 15000, 2),
  (10, 30000, 3),
  (20, 60000, 4),
  (50, 200000, 5),
  (100, 500000, 6)
on conflict (required_invites) do update
  set reward_amount = excluded.reward_amount,
      display_order = excluded.display_order,
      is_active = true;

-- 1.2 RLS — la liste des tâches est publique ; chaque utilisateur ne voit que
-- ses propres récompenses (les INSERT passent exclusivement par la RPC).
alter table referral_tasks enable row level security;
drop policy if exists "Public can view referral tasks" on referral_tasks;
create policy "Public can view referral tasks" on referral_tasks for select using (true);

alter table referral_task_rewards enable row level security;
drop policy if exists "Users view own task rewards" on referral_task_rewards;
create policy "Users view own task rewards"
  on referral_task_rewards for select
  using (auth.uid() = user_id or public.is_admin());

grant select on referral_tasks to anon, authenticated;
grant select on referral_task_rewards to authenticated;

-- ============================================================================
-- 2. LEDGER : NOUVEAU TYPE DE TRANSACTION
-- ============================================================================
alter table wallet_transactions drop constraint if exists wallet_transactions_type_check;
alter table wallet_transactions
  add constraint wallet_transactions_type_check
  check (type in ('DEPOSIT', 'INVESTMENT', 'INVESTMENT_PAYMENT', 'DAILY_PROFIT', 'WITHDRAWAL', 'COMMISSION', 'REFERRAL_TASK_REWARD', 'COUPON', 'ADJUSTMENT'));

-- ============================================================================
-- 3. SERVEUR : COMPTEUR DES INVITATIONS VALIDES
-- ============================================================================
-- Une invitation est VALIDE si et seulement si le filleul (enfant référencé
-- dans `referrals`) possède au moins UN investissement validé
-- (status ACTIVE ou COMPLETED). Aucune directive frontend n'intervient.
create or replace function public.count_valid_invitations(p_parent_id uuid)
returns int as $$
declare
  v_count int;
begin
  select count(distinct r.child_id)
  into v_count
  from referrals r
  join investments i on i.user_id = r.child_id
  where r.parent_id = p_parent_id
    and i.status in ('ACTIVE', 'COMPLETED');

  return coalesce(v_count, 0);
end;
$$ language plpgsql stable security definer set search_path = public, pg_temp;

grant execute on function public.count_valid_invitations(uuid) to authenticated;

-- ============================================================================
-- 4. SERVEUR : DONNÉES COMPLÈTES DE LA PAGE TÂCHE
-- ============================================================================
create or replace function public.get_referral_task_data()
returns jsonb as $$
declare
  v_user_id uuid;
  v_total_team int;
  v_valid int;
  v_total_rewards numeric;
  v_next jsonb;
  v_tasks jsonb := '[]';
  v_task record;
  v_claimed boolean;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  -- Mon équipe = personne inscrite avec mon code (directs uniquement)
  select count(*) into v_total_team from referrals where parent_id = v_user_id;
  v_total_team := coalesce(v_total_team, 0);

  -- Invitations valides = filleuls avec au moins un investissement validé
  v_valid := public.count_valid_invitations(v_user_id);

  -- Total des récompenses déjà réclamées
  select coalesce(sum(reward_amount), 0) into v_total_rewards
  from referral_task_rewards
  where user_id = v_user_id;

  -- Liste des paliers avec état de progression + réclamation
  for v_task in
    select t.id, t.required_invites, t.reward_amount, t.display_order
    from referral_tasks t
    where t.is_active = true
    order by t.display_order asc
  loop
    select exists (
      select 1 from referral_task_rewards r
      where r.user_id = v_user_id and r.task_id = v_task.id
    ) into v_claimed;

    v_tasks := v_tasks || jsonb_build_object(
      'id', v_task.id,
      'required_invites', v_task.required_invites,
      'reward_amount', v_task.reward_amount,
      'display_order', v_task.display_order,
      'progress', least(v_valid, v_task.required_invites),
      'claimed', v_claimed
    );
  end loop;

  -- Prochaine récompense non encore réclamée (la plus proche)
  select jsonb_build_object(
    'id', t.id,
    'required_invites', t.required_invites,
    'reward_amount', t.reward_amount
  )
  into v_next
  from referral_tasks t
  where t.is_active = true
    and t.required_invites > v_valid
    and not exists (
      select 1 from referral_task_rewards r
      where r.user_id = v_user_id and r.task_id = t.id
    )
  order by t.required_invites asc
  limit 1;

  return json_build_object(
    'total_team', v_total_team,
    'valid_invites', v_valid,
    'pending_invites', greatest(v_total_team - v_valid, 0),
    'total_rewards', v_total_rewards,
    'tasks', v_tasks,
    'next_reward', v_next
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.get_referral_task_data() to authenticated;

-- ============================================================================
-- 5. SERVEUR : RÉCLAMATION D'UNE RÉCOMPENSE (unique + atomique)
-- ============================================================================
create or replace function public.claim_referral_task_reward(p_task_id uuid)
returns jsonb as $$
declare
  v_user_id uuid;
  v_task record;
  v_valid int;
  v_wallet record;
  v_new_balance numeric;
  v_ref varchar;
  v_tx_id uuid;
  v_reward_id uuid;
  v_reward_amount numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Non authentifié';
  end if;

  select * into v_task
  from referral_tasks
  where id = p_task_id and is_active = true;
  if not found then
    raise exception 'Tâche introuvable ou désactivée';
  end if;

  -- Le nombre d'invitations valides est TOUJOURS calculé côté serveur
  v_valid := public.count_valid_invitations(v_user_id);
  if v_valid < v_task.required_invites then
    raise exception 'Invitations insuffisantes : %/%', v_valid, v_task.required_invites;
  end if;

  v_reward_amount := v_task.reward_amount;

  -- Idempotence : une seule réclamation par palier et par utilisateur
  v_reward_id := null;
  insert into referral_task_rewards (user_id, task_id, required_invites, reward_amount, transaction_id)
  values (v_user_id, p_task_id, v_task.required_invites, v_reward_amount, null)
  on conflict (user_id, task_id) do nothing
  returning id into v_reward_id;

  if v_reward_id is null then
    return json_build_object(
      'success', true,
      'already_claimed', true,
      'reward_amount', 0,
      'message', 'Cette récompense a déjà été réclamée'
    );
  end if;

  -- Crédit atomique du wallet
  select * into v_wallet from wallets where user_id = v_user_id for update;
  if not found then
    raise exception 'Wallet introuvable';
  end if;

  v_new_balance := v_wallet.balance + v_reward_amount;
  v_ref := 'RWR-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));

  update wallets set
    balance = v_new_balance,
    team_earned = team_earned + v_reward_amount,
    total_earned = total_earned + v_reward_amount,
    today_earned = today_earned + v_reward_amount,
    updated_at = now()
  where user_id = v_user_id;

  -- Écriture ledger unique, type identifiable
  insert into wallet_transactions (
    user_id, type, amount, balance_before, balance_after,
    reference, description, status
  )
  values (
    v_user_id,
    'REFERRAL_TASK_REWARD',
    v_reward_amount,
    v_wallet.balance,
    v_new_balance,
    v_ref,
    'Récompense tâche d''invitation : ' || v_task.required_invites || ' invitation(s) valide(s) — ' || v_reward_amount || ' FC',
    'COMPLETED'
  )
  returning id into v_tx_id;

  -- Liaison de la récompense à la transaction (traçabilité)
  update referral_task_rewards set transaction_id = v_tx_id where id = v_reward_id;

  insert into admin_logs (admin_id, action, target_object, new_value)
  values (
    null,
    'REFERRAL_TASK_REWARD',
    'referral_task_rewards',
    'User ' || v_user_id || ' a réclamé la récompense de ' || v_task.required_invites || ' invitation(s) valide(s) : ' || v_reward_amount || ' FC'
  );

  return json_build_object(
    'success', true,
    'already_claimed', false,
    'reward_amount', v_reward_amount,
    'transaction_id', v_tx_id,
    'new_balance', v_new_balance
  );
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.claim_referral_task_reward(uuid) to authenticated;

-- ============================================================================
-- 6. ADMIN : VUE GLOBALE DES TÂCHES D'INVITATION
-- ============================================================================
create or replace function public.admin_referral_task_overview()
returns jsonb as $$
declare
  v_admin_id uuid;
  v_rows jsonb := '[]';
  v_p record;
  v_valid int;
  v_total_team int;
  v_total_rewards numeric;
begin
  v_admin_id := auth.uid();
  if v_admin_id is null or not public.is_admin() then
    raise exception 'Accès non autorisé';
  end if;

  for v_p in
    select p.id, p.phone, p.referral_code
    from profiles p
    order by p.created_at asc
  loop
    v_valid := public.count_valid_invitations(v_p.id);

    select count(*) into v_total_team from referrals where parent_id = v_p.id;
    v_total_team := coalesce(v_total_team, 0);

    select coalesce(sum(rw.reward_amount), 0) into v_total_rewards
    from referral_task_rewards rw
    where rw.user_id = v_p.id;

    v_rows := v_rows || jsonb_build_object(
      'user_id', v_p.id,
      'phone', v_p.phone,
      'referral_code', v_p.referral_code,
      'total_team', v_total_team,
      'valid_invites', v_valid,
      'total_rewards', v_total_rewards,
      'history', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'required_invites', h.required_invites,
              'reward_amount', h.reward_amount,
              'claimed_at', h.claimed_at
            )
          ),
          '[]'::jsonb
        )
        from (
          select required_invites, reward_amount, claimed_at
          from referral_task_rewards
          where user_id = v_p.id
          order by claimed_at desc
        ) h
      )
    );
  end loop;

  return v_rows;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.admin_referral_task_overview() to authenticated;

-- ============================================================================
-- 7. SIGNUP : VERROUS ANTI-FRAUDE SUPPLÉMENTAIRES
-- ============================================================================
-- (Ré)installe le déclencheur de création de profil avec garde-fous :
--   - auto-parrainage bloqué (ref_user_id <> new.id) ;
--   - un utilisateur ne peut être filleul qu'une seule fois (child_id unique) ;
--   - code inexistant => aucune relation, aucun privilège.
create or replace function public.on_new_user_created()
returns trigger as $$
declare
  generated_code varchar(20);
  ref_user_id uuid;
begin
  generated_code := 'BISO' || upper(substring(md5(random()::text) from 1 for 6));

  insert into public.profiles (id, phone, referral_code, current_vip, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'phone', new.email, '+243000000000'),
    generated_code,
    'VIP0',
    'ACTIVE'
  );

  insert into public.wallets (user_id, balance, total_deposited, total_withdrawn, total_invested, total_earned, today_earned, team_earned, total_assets)
  values (new.id, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00);

  if new.raw_user_meta_data->>'referral_code' is not null then
    select id into ref_user_id from public.profiles where referral_code = new.raw_user_meta_data->>'referral_code';
    if ref_user_id is not null and ref_user_id <> new.id then
      insert into public.referrals (parent_id, child_id, level)
      values (ref_user_id, new.id, 'A')
      on conflict (child_id) do nothing;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.on_new_user_created();