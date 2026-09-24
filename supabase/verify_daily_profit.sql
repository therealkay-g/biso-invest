-- Vérifications en lecture seule après application de 033_sector_daily_rates.sql
-- (et de la chaîne 030/031/032). Dans Supabase SQL Editor, toutes les
-- assertions ci-dessous doivent retourner true.

-- 1. La RPC par investissement est disponible et l'ancienne RPC sans paramètre
--    a disparu.
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

-- 2. L'ancien moteur de retrait cumulatif n'est plus exécutable par un
--    utilisateur.
select not exists (
  select 1
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'claim_investment_profit'
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
) as legacy_claim_locked;

-- 3. Taux par secteur (politique 033).
select
  (select daily_rate from public.product_categories where name = 'Agriculture')  = 0.10 as ag_rate_ok,
  (select daily_rate from public.product_categories where name = 'Élevage')      = 0.15 as el_rate_ok,
  (select daily_rate from public.product_categories where name = 'Pisciculture') = 0.20 as pi_rate_ok;

-- 4. Snapshots daily_profit conformes au taux snapshoté (10/15/20 %).
select count(*) = 0 as invalid_daily_snapshots
from public.investments
where daily_profit is distinct from round(total_amount * coalesce(daily_rate, 0.10), 2)
   or daily_rate is null
   or daily_rate <= 0
   or daily_rate > 1;

-- 5. Durées du catalogue par secteur : 15/18/10 jours, monthly plafonné à 3.
select count(*) = 0 as invalid_product_durations
from public.products p
join public.product_categories c on c.id = p.category_id
where p.duration_months <> 3
   or p.duration_days is null
   or p.duration_days not in (10, 15, 18)
   or p.daily_rate is distinct from c.daily_rate
   or p.total_returns is distinct from round(p.price * p.daily_rate * p.duration_days, 2);

-- 6. Aucun produit en défaut de taux.
select count(*) = 0 as invalid_product_rates
from public.products
where daily_rate is null or daily_rate <= 0 or daily_rate > 1;