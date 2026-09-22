-- Migration 029 : Passage de la durée par défaut des investissements de 12 mois à 3 mois

-- 1. Mettre à jour la table products
ALTER TABLE public.products ALTER COLUMN duration_months SET DEFAULT 3;
UPDATE public.products 
SET duration_months = 3, 
    total_returns = monthly_return * 3;

-- 2. Mettre à jour la table investments
ALTER TABLE public.investments ALTER COLUMN duration_months SET DEFAULT 3;
ALTER TABLE public.investments ALTER COLUMN remaining_installments SET DEFAULT 3;

-- Mettre à jour les investissements existants (si la durée était 12)
UPDATE public.investments 
SET duration_months = 3, 
    remaining_installments = GREATEST(0, 3 - paid_installments)
WHERE duration_months = 12;

-- 3. Mettre à jour les contraintes de vérification (Check Constraints) pour investment_payments et investment_cycles
ALTER TABLE public.investment_payments DROP CONSTRAINT IF EXISTS investment_payments_installment_number_check;
ALTER TABLE public.investment_payments ADD CONSTRAINT investment_payments_installment_number_check CHECK (installment_number BETWEEN 1 AND 3);

ALTER TABLE public.investment_cycles DROP CONSTRAINT IF EXISTS investment_cycles_cycle_number_check;
ALTER TABLE public.investment_cycles ADD CONSTRAINT investment_cycles_cycle_number_check CHECK (cycle_number BETWEEN 1 AND 3);

-- 4. Rendre dynamique la fonction accrual_investment_yields pour utiliser investment.duration_months
CREATE OR REPLACE FUNCTION public.accrual_investment_yields(p_investment_id uuid)
RETURNS void AS $$
DECLARE
  v_inv record;
  v_cycle record;
  v_now timestamp with time zone := now();
  v_days_diff int;
  v_max_cycles int := 3;
begin
  select * into v_inv from investments where id = p_investment_id for update;
  if not found or v_inv.status != 'ACTIVE' then
    return;
  end if;

  v_max_cycles := coalesce(v_inv.duration_months, 3);

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Mettre à jour les textes des leçons de l'Academy en base
UPDATE public.academy_lessons 
SET content = REPLACE(REPLACE(REPLACE(content, '12 mois', '3 mois'), '12 cycles', '3 cycles'), 'multiplié par 12', 'multiplié par 3')
WHERE content LIKE '%12 mois%' OR content LIKE '%12 cycles%' OR content LIKE '%multiplié par 12%';

-- 6. Mettre à jour la FAQ si présente
UPDATE public.faq 
SET answer = REPLACE(REPLACE(answer, '12 mois', '3 mois'), '12 cycles', '3 cycles')
WHERE answer LIKE '%12 mois%' OR answer LIKE '%12 cycles%';
