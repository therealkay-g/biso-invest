-- BISO INVEST - MIGRATION 011: CONFIGURATION EXCLUSIVE DES 4 PACKS & PALIERS VIP
-- 1. Packs autorisés : 30 000 FC (VIP1), 50 000 FC (VIP2), 100 000 FC (VIP3) et 250 000 FC (VIP4)
-- 2. Désactivation de tous les packs supérieurs (500 000 FC, 1 000 000 FC, 2 500 000 FC...)
-- 3. Mise à jour des seuils d'accès VIP dans vip_levels

-- 1. Désactiver tous les packs non autorisés
UPDATE products 
SET is_active = false 
WHERE price NOT IN (30000, 50000, 100000, 250000);

-- 2. Activer exclusivement les 4 packs autorisés
UPDATE products 
SET is_active = true 
WHERE price IN (30000, 50000, 100000, 250000);

-- 3. Paliers VIP officiels
UPDATE vip_levels 
SET min_investment = 0, max_packs = 1, benefits = 'Condition 0 FC — Maximum 1 pack', is_active = true 
WHERE level_name = 'VIP0';

UPDATE vip_levels 
SET min_investment = 30000, max_packs = 3, benefits = 'Pack VIP1 (30 000 FC) — Maximum 3 packs', is_active = true 
WHERE level_name = 'VIP1';

UPDATE vip_levels 
SET min_investment = 50000, max_packs = 5, benefits = 'Pack VIP2 (50 000 FC) — Maximum 5 packs', is_active = true 
WHERE level_name = 'VIP2';

UPDATE vip_levels 
SET min_investment = 100000, max_packs = 8, benefits = 'Pack VIP3 (100 000 FC) — Maximum 8 packs', is_active = true 
WHERE level_name = 'VIP3';

UPDATE vip_levels 
SET min_investment = 250000, max_packs = 10, benefits = 'Pack VIP4 (250 000 FC) — Maximum 10 packs', is_active = true 
WHERE level_name = 'VIP4';

-- 4. Désactiver les paliers supérieurs non utilisés
UPDATE vip_levels 
SET is_active = false 
WHERE level_name IN ('VIP5', 'VIP6', 'VIP7');
