-- Migration 029 : Passage de la durée par défaut des investissements de 12 mois à 3 mois
-- La règle financière reste : 10% du capital snapshot par jour, à 2 décimales.
-- Les produits ne sont plus consultés pour calculer un bénéfice.

-- 1. Mettre à jour la table products
-- total_returns reste une valeur de catalogue/affichage : l'estimation à
-- 90 jours éligibles est 10% × 90.  Elle n'est jamais utilisée comme source
-- de vérité par une réclamation; investment.daily_profit est le snapshot.
ALTER TABLE public.products ALTER COLUMN duration_months SET DEFAULT 3;
UPDATE public.products
SET duration_months = 3,
    total_returns = round(price * 0.10 * 90, 2);

-- 2. Mettre à jour la table investments
ALTER TABLE public.investments ALTER COLUMN duration_months SET DEFAULT 3;
ALTER TABLE public.investments ALTER COLUMN remaining_installments SET DEFAULT 3;

-- Mettre à jour les investissements existants (si la durée était 12)
UPDATE public.investments
SET duration_months = 3,
    remaining_installments = GREATEST(0, 3 - paid_installments)
WHERE duration_months = 12;

-- 3. Mettre à jour les contraintes de vérification (Check Constraints)
-- NOT VALID préserve les éventuelles anciennes lignes 4..12 déjà présentes
-- dans une base déployée, tout en interdisant les nouvelles lignes hors des
-- trois cycles de la politique 3 mois.  La validation historique est traitée
-- par la migration 030.
ALTER TABLE public.investment_payments
  DROP CONSTRAINT IF EXISTS investment_payments_installment_number_check;
ALTER TABLE public.investment_payments
  ADD CONSTRAINT investment_payments_installment_number_check
  CHECK (installment_number BETWEEN 1 AND 3) NOT VALID;

ALTER TABLE public.investment_cycles
  DROP CONSTRAINT IF EXISTS investment_cycles_cycle_number_check;
ALTER TABLE public.investment_cycles
  ADD CONSTRAINT investment_cycles_cycle_number_check
  CHECK (cycle_number BETWEEN 1 AND 3) NOT VALID;

-- 4. Rendre l'accrual interne dynamique et dépendre du snapshot du cycle.
--    Le calcul historique est un complément de bookkeeping : il ne crédite
--    jamais un wallet et n'est jamais une source du montant de la claim RPC.
CREATE OR REPLACE FUNCTION public.accrual_investment_yields(p_investment_id uuid)
RETURNS void AS $$
DECLARE
  v_inv record;
  v_cycle record;
  v_now timestamp with time zone := now();
  v_accrual_until timestamp with time zone;
  v_next_end timestamp with time zone;
  v_contract_end timestamp with time zone;
  v_days_diff int;
  v_max_cycles int := 3;
BEGIN
  SELECT * INTO v_inv
  FROM public.investments
  WHERE id = p_investment_id
  FOR UPDATE;

  IF NOT FOUND OR v_inv.status <> 'ACTIVE' THEN
    RETURN;
  END IF;

  -- La politique reste à trois mois, même si une ancienne ligne porte une
  -- durée supérieure : on ne crée jamais un quatrième cycle.
  v_max_cycles := LEAST(GREATEST(COALESCE(v_inv.duration_months, 3), 1), 3);
  v_contract_end := v_inv.created_at + (v_max_cycles * interval '1 month');

  LOOP
    SELECT * INTO v_cycle
    FROM public.investment_cycles
    WHERE investment_id = p_investment_id
      AND status = 'ACTIVE'
    ORDER BY cycle_number ASC
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND OR v_cycle.cycle_number > v_max_cycles THEN
      EXIT;
    END IF;

    IF v_now >= v_cycle.cycle_end_date THEN
      v_accrual_until := LEAST(v_now, v_cycle.cycle_end_date);
      v_days_diff := GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM (v_accrual_until - v_cycle.last_accrual_date)) / 86400)::int
      );

      IF v_days_diff > 0 THEN
        UPDATE public.investment_cycles
        SET accumulated_profit = accumulated_profit
              + (v_days_diff * v_cycle.daily_profit),
            last_accrual_date = v_accrual_until
        WHERE id = v_cycle.id;
      END IF;

      UPDATE public.investment_cycles
      SET status = 'COMPLETED'
      WHERE id = v_cycle.id;

      EXIT WHEN v_cycle.cycle_number >= v_max_cycles
        OR v_cycle.cycle_end_date >= v_contract_end;

      v_next_end := v_inv.created_at
        + ((v_cycle.cycle_number + 1) * interval '1 month');
      IF v_next_end > v_contract_end THEN
        v_next_end := v_contract_end;
      END IF;

      IF v_next_end > v_cycle.cycle_end_date THEN
        INSERT INTO public.investment_cycles (
          investment_id, cycle_number, cycle_start_date, cycle_end_date,
          daily_profit, accumulated_profit, withdrawn_profit,
          last_accrual_date, status
        )
        VALUES (
          p_investment_id,
          v_cycle.cycle_number + 1,
          v_cycle.cycle_end_date,
          v_next_end,
          v_cycle.daily_profit,
          0.00,
          0.00,
          v_cycle.cycle_end_date,
          'ACTIVE'
        )
        ON CONFLICT (investment_id, cycle_number) DO NOTHING;
      END IF;
    ELSE
      v_days_diff := GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM (v_now - v_cycle.last_accrual_date)) / 86400)::int
      );

      IF v_days_diff > 0 THEN
        UPDATE public.investment_cycles
        SET accumulated_profit = accumulated_profit
              + (v_days_diff * v_cycle.daily_profit),
            last_accrual_date = v_now
        WHERE id = v_cycle.id;
      END IF;
      EXIT;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Cette fonction est un helper interne : seul le code serveur SECURITY DEFINER
-- peut l'appeler, jamais un client via PostgREST.
REVOKE EXECUTE ON FUNCTION public.accrual_investment_yields(uuid)
  FROM public, anon, authenticated;

-- 5. Mettre à jour les textes des leçons de l'Academy en base
UPDATE public.academy_lessons
SET content = REPLACE(REPLACE(REPLACE(content, '12 mois', '3 mois'), '12 cycles', '3 cycles'), 'multiplié par 12', 'multiplié par 3')
WHERE content LIKE '%12 mois%' OR content LIKE '%12 cycles%' OR content LIKE '%multiplié par 12%';

-- 6. Mettre à jour la FAQ si présente
UPDATE public.faq
SET answer = REPLACE(REPLACE(answer, '12 mois', '3 mois'), '12 cycles', '3 cycles')
WHERE answer LIKE '%12 mois%' OR answer LIKE '%12 cycles%';
