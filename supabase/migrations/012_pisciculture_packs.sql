-- ============================================================================
-- BISO INVEST — MIGRATION 012 : PACKS OFFICIELS PISCICULTURE
-- ============================================================================
-- Objectif :
--   1. Créer le secteur « Pisciculture » s'il n'existe pas.
--   2. Remplacer les anciens packs Pisciculture par EXACTEMENT 4 packs :
--        Tilapia  (30 000 FC, VIP1)
--        Silure   (50 000 FC, VIP2)
--        Anguille (100 000 FC, VIP3)
--        Carpe    (250 000 FC, VIP4)
--   3. Désactiver (jamais supprimer) les anciens packs Pisciculture ;
--      les investissements historiques restent référencés et intacts.
--   4. Garantir qu'aucun doublon n'est actif.
--
-- Aucune autre table/fonction n'est touchée (wallets, ledger, dépôts,
-- retraits, commissions, OTP, RLS, RPC financières, cycles…).
-- ============================================================================

-- 1. S'assurer que la catégorie Pisciculture existe (rang 3, après Élevage)
insert into product_categories (name, slug, description, icon, order_index)
values
  ('Pisciculture', 'pisciculture', 'Élevage de poissons et production aquacole durable', 'Fish', 3)
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description,
      icon = excluded.icon,
      order_index = excluded.order_index;

do $$
declare
  cid uuid;
begin
  select id into cid from product_categories where slug = 'pisciculture';

  -- 2. Désactiver TOUS les packs Pisciculture existants.
  --    On ne supprime jamais : la table investments référence les packs
  --    (on delete restrict) ; les investissements historiques sont préservés.
  update products set is_active = false
  where category_id = cid;

  -- 3. Insérer les 4 packs officiels s'ils n'existent pas déjà dans le secteur.
  insert into products
    (category_id, name, price, monthly_return, duration_months, total_returns, purchase_limit, description, image_url, is_active)
  select cid, 'Tilapia', 30000, 30000, 12, 360000, 10,
         'Élevage intensif de tilapias en étangs et bassins contrôlés.',
         'https://images.unsplash.com/photo-1524704654690-b56c05c78a00?auto=format&fit=crop&w=600&q=80', true
  where not exists (select 1 from products where category_id = cid and name = 'Tilapia');

  insert into products
    (category_id, name, price, monthly_return, duration_months, total_returns, purchase_limit, description, image_url, is_active)
  select cid, 'Silure', 50000, 50000, 12, 600000, 10,
         'Production de silures (poisson-chat) en bassins à forte densité.',
         'https://images.unsplash.com/photo-1534081333815-ae5019106622?auto=format&fit=crop&w=600&q=80', true
  where not exists (select 1 from products where category_id = cid and name = 'Silure');

  insert into products
    (category_id, name, price, monthly_return, duration_months, total_returns, purchase_limit, description, image_url, is_active)
  select cid, 'Anguille', 100000, 100000, 12, 1200000, 10,
         'Élevage d''anguilles en circuits fermés maîtrisés.',
         'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=600&q=80', true
  where not exists (select 1 from products where category_id = cid and name = 'Anguille');

  insert into products
    (category_id, name, price, monthly_return, duration_months, total_returns, purchase_limit, description, image_url, is_active)
  select cid, 'Carpe', 250000, 250000, 12, 3000000, 10,
         'Élevage de carpes en étangs communautaires extensifs.',
         'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80', true
  where not exists (select 1 from products where category_id = cid and name = 'Carpe');

  -- 4. Forcer la configuration EXACTE des 4 packs + activation
  update products set
    price = 30000, monthly_return = 30000, duration_months = 12, total_returns = 360000,
    purchase_limit = 10, is_active = true, updated_at = now()
  where category_id = cid and name = 'Tilapia';

  update products set
    price = 50000, monthly_return = 50000, duration_months = 12, total_returns = 600000,
    purchase_limit = 10, is_active = true, updated_at = now()
  where category_id = cid and name = 'Silure';

  update products set
    price = 100000, monthly_return = 100000, duration_months = 12, total_returns = 1200000,
    purchase_limit = 10, is_active = true, updated_at = now()
  where category_id = cid and name = 'Anguille';

  update products set
    price = 250000, monthly_return = 250000, duration_months = 12, total_returns = 3000000,
    purchase_limit = 10, is_active = true, updated_at = now()
  where category_id = cid and name = 'Carpe';
end $$;