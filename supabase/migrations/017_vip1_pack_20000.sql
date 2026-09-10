-- ============================================================================
-- MIGRATION 017 : PACK VIP1 — PRIX RAMENÉ DE 30 000 À 20 000 FC
-- ----------------------------------------------------------------------------
-- Le seuil d'accès VIP1 est déjà à 20 000 FC (migration 014). On aligne
-- maintenant le PRIX du pack d'entrée (VIP1) : 20 000 FC d'investissement,
-- 20 000 FC de versement mensuel et 240 000 FC de rendement total sur 12 mois.
-- VIP2 (50 000), VIP3 (100 000) et VIP4 (250 000) sont inchangés.
-- ============================================================================

UPDATE products
SET price = 20000,
    monthly_return = 20000,
    total_returns = 240000,
    is_active = true
WHERE price = 30000;