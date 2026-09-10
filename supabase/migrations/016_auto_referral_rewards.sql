-- ============================================================================
-- MIGRATION 016 : ATTRIBUTION AUTOMATIQUE DES RÉCOMPENSES D'INVITATION
-- ----------------------------------------------------------------------------
-- Dès qu'un filleul (inscrit avec le code de parrainage) voit un de ses
-- investissements devenir ACTIVE ou COMPLETED, la récompense du (ou des)
-- palier(s) atteint(s) est créditée AUTOMATIQUEMENT dans le wallet du parrain.
--
-- Fiabilité :
--  * Le nombre d'invitations valides est TOUJOURS recalculé côté serveur.
--  * L'insertion dans referral_task_rewards est protégée par une contrainte
--    unique (user_id, task_id) + ON CONFLICT DO NOTHING :
--    chaque palier ne peut être crédité qu'une seule fois, quoi qu'il arrive
--    (investissements multiples du même filleul, doublons, relectures).
--  * Le crédit est atomique (FOR UPDATE) et tracé dans wallet_transactions.
-- ============================================================================

-- ============================================================================
-- 1. TRACABILITÉ : marquage « attribution automatique »
-- ============================================================================
alter table referral_task_rewards
  add column if not exists auto_granted boolean default false not null;

-- ============================================================================
-- 2. SERVEUR : attribution de TOUTES les récompenses éligibles (idempotente)
-- ============================================================================
create or replace function public.grant_referral_task_rewards(p_parent_id uuid)
returns void as $$
declare
  v_valid int;
  v_task record;
  v_reward_id uuid;
  v_wallet record;
  v_new_balance numeric;
  v_ref varchar;
  v_tx_id uuid;
begin
  if p_parent_id is null then
    return;
  end if;

  v_valid := public.count_valid_invitations(p_parent_id);
  if v_valid = 0 then
    return;
  end if;

  -- On ne traite QUE les paliers franchis et non encore crédités, par ordre croissant
  for v_task in
    select t.id, t.required_invites, t.reward_amount
    from referral_tasks t
    where t.is_active = true
      and t.required_invites <= v_valid
      and not exists (
        select 1 from referral_task_rewards r
        where r.user_id = p_parent_id and r.task_id = t.id
      )
    order by t.required_invites asc
  loop
    v_reward_id := null;
    insert into referral_task_rewards (user_id, task_id, required_invites, reward_amount, transaction_id, auto_granted)
    values (p_parent_id, v_task.id, v_task.required_invites, v_task.reward_amount, null, true)
    on conflict (user_id, task_id) do nothing
    returning id into v_reward_id;

    -- La ligne existe déjà → palier déjà crédité → on ne fait RIEN (idempotence)
    if v_reward_id is not null then
      select * into v_wallet from wallets where user_id = p_parent_id for update;
      if not found then
        continue;
      end if;

      v_new_balance := v_wallet.balance + v_task.reward_amount;
      v_ref := 'RWR-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));

      update wallets set
        balance = v_new_balance,
        team_earned = team_earned + v_task.reward_amount,
        total_earned = total_earned + v_task.reward_amount,
        today_earned = today_earned + v_task.reward_amount,
        updated_at = now()
      where user_id = p_parent_id;

      insert into wallet_transactions (
        user_id, type, amount, balance_before, balance_after,
        reference, description, status
      )
      values (
        p_parent_id,
        'REFERRAL_TASK_REWARD',
        v_task.reward_amount,
        v_wallet.balance,
        v_new_balance,
        v_ref,
        'Récompense automatique tâche d''invitation : ' || v_task.required_invites || ' invitation(s) valide(s) — ' || v_task.reward_amount || ' FC',
        'COMPLETED'
      )
      returning id into v_tx_id;

      -- Traçabilité : liaison récompense <-> transaction ledger
      update referral_task_rewards set transaction_id = v_tx_id where id = v_reward_id;

      insert into admin_logs (admin_id, action, target_object, new_value)
      values (
        null,
        'REFERRAL_TASK_REWARD_AUTO',
        'referral_task_rewards',
        'Attribution automatique : ' || v_task.reward_amount || ' FC à l''utilisateur ' || p_parent_id || ' pour ' || v_task.required_invites || ' invitation(s) valide(s)'
      );
    end if;
  end loop;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

grant execute on function public.grant_referral_task_rewards(uuid) to authenticated, service_role;

-- ============================================================================
-- 3. TRIGGER : crédit automatique dès qu'un investissement est validé
--    (INSERT direct en ACTIVE par purchase_investment, ou UPDATE vers
--    ACTIVE/COMPLETED par l'admin depuis un statut PENDING)
-- ============================================================================
create or replace function public.on_investment_validated()
returns trigger as $$
declare
  v_parent_id uuid;
begin
  select parent_id into v_parent_id
  from referrals
  where child_id = new.user_id;

  if v_parent_id is not null then
    perform public.grant_referral_task_rewards(v_parent_id);
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_referral_tasks_on_investment on investments;
create trigger trg_referral_tasks_on_investment
  after insert or update of status on investments
  for each row
  when (new.status in ('ACTIVE', 'COMPLETED'))
  execute function public.on_investment_validated();

-- ============================================================================
-- 4. RÉGULARISATION : créditer automatiquement les invitations déjà valides
--    (à lancer après déploiement pour les parrains ayant déjà des filleuls
--    investis, sans jamais doubler une attribution existante)
-- ============================================================================
do $$
declare
  v_parent record;
begin
  for v_parent in
    select distinct r.parent_id
    from referrals r
    join investments i on i.user_id = r.child_id
    where i.status in ('ACTIVE', 'COMPLETED')
  loop
    perform public.grant_referral_task_rewards(v_parent.parent_id);
  end loop;
end;
$$;