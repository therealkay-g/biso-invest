-- Vérifications en lecture seule après application de 030_daily_profit_10_percent.sql
-- Dans Supabase SQL Editor, toutes les assertions ci-dessous doivent retourner true.

-- 1. La nouvelle RPC est disponible et l'ancienne RPC sans paramètre a disparu.
select
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'claim_daily_profit'
      and pg_get_function_identity_arguments(p.oid) = 'p_investment_id uuid'
  ) as per_investment_rpc_exists,
  not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'claim_daily_profit'
      and pg_get_function_identity_arguments(p.oid) = ''
  ) as legacy_rpc_removed;

-- 2. L'ancien moteur de retrait cumulatif n'est plus exécutable par un utilisateur.
select not exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'claim_investment_profit'
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
) as legacy_claim_locked;

-- 3. Formule officielle : 10 % du capital, arrondis à deux décimales.
select public.calculate_daily_profit(20000) = 2000.00 as gain_20k_ok,
       public.calculate_daily_profit(50000) = 5000.00 as gain_50k_ok,
       public.calculate_daily_profit(250000) = 25000.00 as gain_250k_ok;

-- 4. Les investissements existants portent un snapshot quotidien égal à 10 %.
select count(*) = 0 as invalid_daily_snapshots
from public.investments
where daily_profit is distinct from round(total_amount * 0.10, 2);

-- 5. Tous les produits actifs respectent la durée commerciale de 3 mois.
select count(*) = 0 as invalid_product_durations
from public.products
where duration_months <> 3;

-- 6. Les dates de fin sont toujours ultérieures à la date de début.
select count(*) = 0 as invalid_contract_dates
from public.investments
where ends_at is null or ends_at <= created_at;
