-- BISO INVEST - MIGRATION 006: CLEAN UP PRODUCT DUPLICATES & ADD UNIQUE CONSTRAINT

-- 1. Remove duplicate products, keeping the first created for each name
delete from products a using products b
where a.id > b.id and a.name = b.name;

-- 2. Add unique constraint on product name to prevent future duplication
alter table products add constraint products_name_unique unique (name);
