-- Supprimer les secteurs non désirés et leurs packs
-- On garde uniquement: Agriculture, Élevage

-- Supprimer les produits des secteurs à supprimer (avant la catégorie pour safety)
DELETE FROM products WHERE category_id IN (
  SELECT id FROM product_categories WHERE slug IN (
    'commerce',
    'industrie-transformation',
    'transport-logistique',
    'restauration',
    'energie-solaire'
  )
);

-- Supprimer les catégories non désirées
DELETE FROM product_categories WHERE slug IN (
  'commerce',
  'industrie-transformation',
  'transport-logistique',
  'restauration',
  'energie-solaire'
);