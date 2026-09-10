-- ============================================================================
-- BISO INVEST — MIGRATION 014 : SEUIL VIP1 ABAISSÉ À 20 000 FC
-- ============================================================================
-- Objectif : le palier VIP1 s'atteint désormais dès 20 000 FC investis
-- (au lieu de 30 000 FC). Le seuil est relu côté serveur par
-- evaluate_and_update_user_vip() depuis la table vip_levels.
-- Les autres paliers restent inchangés : VIP2=50 000, VIP3=100 000, VIP4=250 000.
-- ============================================================================

UPDATE vip_levels
SET min_investment = 20000,
    benefits = 'Pack VIP1 (20 000 FC) — Maximum 3 packs'
WHERE level_name = 'VIP1'
  AND min_investment = 30000;

-- Recalcule le palier VIP de chaque profil existant selon le nouveau seuil
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.id AS user_id, w.total_invested
    FROM profiles p
    LEFT JOIN wallets w ON w.user_id = p.id
  LOOP
    PERFORM public.evaluate_and_update_user_vip(r.user_id);
  END LOOP;
END $$;