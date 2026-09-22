-- SEED 42 PRODUCTS (6 per category) with ON CONFLICT DO NOTHING

do $$
declare
  ag_id uuid;
  el_id uuid;
  co_id uuid;
  in_id uuid;
  so_id uuid;
  tr_id uuid;
  re_id uuid;
begin
  select id into ag_id from product_categories where slug = 'agriculture';
  select id into el_id from product_categories where slug = 'elevage';
  select id into co_id from product_categories where slug = 'commerce';
  select id into in_id from product_categories where slug = 'industrie-transformation';
  select id into so_id from product_categories where slug = 'energie-solaire';
  select id into tr_id from product_categories where slug = 'transport-logistique';
  select id into re_id from product_categories where slug = 'restauration';

  -- AGRICULTURE (1 to 6)
  insert into products (category_id, name, price, monthly_return, duration_months, total_returns, purchase_limit, description, image_url)
  values
    (ag_id, 'Pack Maïs', 30000, 30000, 12, 360000, 10, 'Investissement dans la culture et la récolte de maïs local de haute qualité.', 'https://images.unsplash.com/photo-1551754655-cd9e3fb8c371?auto=format&fit=crop&w=600&q=80'),
    (ag_id, 'Pack Riz', 50000, 50000, 12, 600000, 10, 'Soutien aux rizières et à la production de riz communautaire.', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80'),
    (ag_id, 'Pack Manioc', 100000, 100000, 12, 1200000, 8, 'Culture à grande échelle de tubercules de manioc pour l’approvisionnement.', 'https://images.unsplash.com/photo-1595974482597-4f6c4f706246?auto=format&fit=crop&w=600&q=80'),
    (ag_id, 'Pack Soja', 250000, 250000, 12, 3000000, 6, 'Production de soja biologique destiné aux marchés locaux et régionaux.', 'https://images.unsplash.com/photo-1515942661994-bbf65f1f29d4?auto=format&fit=crop&w=600&q=80'),
    (ag_id, 'Pack Maraîchage', 500000, 500000, 12, 6000000, 5, 'Exploitations maraîchères intensives (légumes frais et fruits).', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80'),
    (ag_id, 'Pack Grande Culture', 1000000, 1000000, 12, 12000000, 3, 'Domaine agricole mécanisé hautement productif.', 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=600&q=80')
  on conflict (name) do nothing;

  -- ÉLEVAGE (7 to 12)
  insert into products (category_id, name, price, monthly_return, duration_months, total_returns, purchase_limit, description, image_url)
  values
    (el_id, 'Pack Poulets', 30000, 30000, 12, 360000, 10, 'Élevage avicole moderne de poulets de chair.', 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=600&q=80'),
    (el_id, 'Pack Porcs', 50000, 50000, 12, 600000, 10, 'Élevage porcin rigoureusement encadré et nourri.', 'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=600&q=80'),
    (el_id, 'Pack Chèvres', 100000, 100000, 12, 1200000, 8, 'Élevage caprin en pâturage contrôlé.', 'https://images.unsplash.com/photo-1527153857715-3908f2ae5e61?auto=format&fit=crop&w=600&q=80'),
    (el_id, 'Pack Œufs', 250000, 250000, 12, 3000000, 6, 'Centre de ponte moderne et production d’œufs frais.', 'https://images.unsplash.com/photo-1516447543603-6250781af46e?auto=format&fit=crop&w=600&q=80'),
    (el_id, 'Pack Élevage Mixte', 500000, 500000, 12, 6000000, 5, 'Complexe d’élevage diversifié (volaille et bétail).', 'https://images.unsplash.com/photo-1500595046743-cd271d694d30?auto=format&fit=crop&w=600&q=80'),
    (el_id, 'Pack Élevage Premium', 1000000, 1000000, 12, 12000000, 3, 'Ferme d’élevage industrielle hautement automatisée.', 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?auto=format&fit=crop&w=600&q=80')
  on conflict (name) do nothing;

  -- COMMERCE (13 to 18)
  insert into products (category_id, name, price, monthly_return, duration_months, total_returns, purchase_limit, description, image_url)
  values
    (co_id, 'Pack Petit Commerce', 50000, 50000, 12, 600000, 10, 'Approvisionnement de commerces de proximité.', 'https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&w=600&q=80'),
    (co_id, 'Pack Boutique', 100000, 100000, 12, 1200000, 8, 'Gestion et stock pour boutiques urbaines dynamiques.', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80'),
    (co_id, 'Pack Grossiste', 250000, 250000, 12, 3000000, 6, 'Activités de négoce et distribution en gros.', 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80'),
    (co_id, 'Pack Distribution', 500000, 500000, 12, 6000000, 5, 'Réseau de distribution de biens de grande consommation.', 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?auto=format&fit=crop&w=600&q=80'),
    (co_id, 'Pack Commerce Plus', 1000000, 1000000, 12, 12000000, 3, 'Centres commerciaux et plateformes de négoce.', 'https://images.unsplash.com/photo-1555529771-835f59fc5efe?auto=format&fit=crop&w=600&q=80'),
    (co_id, 'Pack Grand Commerce', 2500000, 2500000, 12, 30000000, 2, 'Import-export et grands stocks commerciaux.', 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=600&q=80')
  on conflict (name) do nothing;

  -- INDUSTRIE / TRANSFORMATION (19 to 24)
  insert into products (category_id, name, price, monthly_return, duration_months, total_returns, purchase_limit, description, image_url)
  values
    (in_id, 'Pack Transformation Maïs', 100000, 100000, 12, 1200000, 8, 'Unité de décorticage et transformation de maïs en farine.', 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80'),
    (in_id, 'Pack Transformation Manioc', 250000, 250000, 12, 3000000, 6, 'Production de fufu et dérivés de manioc de qualité supérieure.', 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80'),
    (in_id, 'Pack Production Alimentaire', 500000, 500000, 12, 6000000, 5, 'Ligne de conditionnement de produits alimentaires locaux.', 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80'),
    (in_id, 'Pack Mini-Usine', 1000000, 1000000, 12, 12000000, 3, 'Mini-usine de transformation agro-industrielle.', 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80'),
    (in_id, 'Pack Industrie Plus', 2500000, 2500000, 12, 30000000, 2, 'Équipements de production industrielle avancée.', 'https://images.unsplash.com/photo-1537462715879-363eeb61a3ad?auto=format&fit=crop&w=600&q=80'),
    (in_id, 'Pack Industrie Premium', 5000000, 5000000, 12, 60000000, 1, 'Complexe industriel de transformation de grande envergure.', 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=600&q=80')
  on conflict (name) do nothing;

  -- ÉNERGIE SOLAIRE (25 to 30)
  insert into products (category_id, name, price, monthly_return, duration_months, total_returns, purchase_limit, description, image_url)
  values
    (so_id, 'Pack Solaire Basic', 50000, 50000, 12, 600000, 10, 'Kits solaires pour foyers ruraux et éclairage autonome.', 'https://images.unsplash.com/photo-1509391365360-e835f37f63f4?auto=format&fit=crop&w=600&q=80'),
    (so_id, 'Pack Solaire Maison', 100000, 100000, 12, 1200000, 8, 'Systèmes solaires domestiques complets.', 'https://images.unsplash.com/photo-1558449028-b53a39d100fc?auto=format&fit=crop&w=600&q=80'),
    (so_id, 'Pack Solaire Commerce', 250000, 250000, 12, 3000000, 6, 'Alimentation solaire pour petites entreprises et boutiques.', 'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=600&q=80'),
    (so_id, 'Pack Solaire Pro', 500000, 500000, 12, 6000000, 5, 'Centrales solaires photovoltaïques de moyenne puissance.', 'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=600&q=80'),
    (so_id, 'Pack Solaire Entreprise', 1000000, 1000000, 12, 12000000, 3, 'Solutions énergétiques durables pour entreprises.', 'https://images.unsplash.com/photo-1466611653911-95081537e5b7?auto=format&fit=crop&w=600&q=80'),
    (so_id, 'Pack Solaire Premium', 2500000, 2500000, 12, 30000000, 2, 'Ferme solaire et mini-réseau électrique vert.', 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80')
  on conflict (name) do nothing;

  -- TRANSPORT / LOGISTIQUE (31 to 36)
  insert into products (category_id, name, price, monthly_return, duration_months, total_returns, purchase_limit, description, image_url)
  values
    (tr_id, 'Pack Moto', 50000, 50000, 12, 600000, 10, 'Flotte de motos taxis pour la mobilité urbaine.', 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=600&q=80'),
    (tr_id, 'Pack Transport Local', 100000, 100000, 12, 1200000, 8, 'Véhicules utilitaires pour le transport de passagers et marchandises.', 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80'),
    (tr_id, 'Pack Livraison', 250000, 250000, 12, 3000000, 6, 'Services de livraison rapide et messagerie urbaine.', 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80'),
    (tr_id, 'Pack Logistique', 500000, 500000, 12, 6000000, 5, 'Entreposage et logistique de fret interurbain.', 'https://images.unsplash.com/photo-1586528116493-a02532554ca9?auto=format&fit=crop&w=600&q=80'),
    (tr_id, 'Pack Transport Pro', 1000000, 1000000, 12, 12000000, 3, 'Camions et transports de marchandises lourdes.', 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=600&q=80'),
    (tr_id, 'Pack Transport Premium', 2500000, 2500000, 12, 30000000, 2, 'Flotte de transport logistique intégrée.', 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?auto=format&fit=crop&w=600&q=80')
  on conflict (name) do nothing;

  -- RESTAURATION (37 to 42)
  insert into products (category_id, name, price, monthly_return, duration_months, total_returns, purchase_limit, description, image_url)
  values
    (re_id, 'Pack Snack', 30000, 30000, 12, 360000, 10, 'Kiosques de restauration rapide et snacks de quartier.', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80'),
    (re_id, 'Pack Fast-Food', 50000, 50000, 12, 600000, 10, 'Établissements de vente de repas rapides.', 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=600&q=80'),
    (re_id, 'Pack Restaurant', 100000, 100000, 12, 1200000, 8, 'Restaurants chaleureux et conviviaux.', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80'),
    (re_id, 'Pack Restaurant Plus', 250000, 250000, 12, 3000000, 6, 'Restaurants à fort trafic et service traiteur.', 'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=600&q=80'),
    (re_id, 'Pack Restauration Pro', 500000, 500000, 12, 6000000, 5, 'Chaînes de restauration et cantines modernes.', 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=600&q=80'),
    (re_id, 'Pack Restauration Premium', 1000000, 1000000, 12, 12000000, 3, 'Gastronomie et complexes culinaires de standing.', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80')
  on conflict (name) do nothing;

end $$;
