-- SEED FAQ AND ANNOUNCEMENTS WITH ON CONFLICT DO NOTHING

insert into faq (question, answer, display_order)
values
  ('Comment créer un compte ?', 'Cliquez sur Inscription, saisissez votre numéro de téléphone, choisissez un mot de passe sécurisé et entrez éventuellement le code de parrainage de votre parrain.', 1),
  ('Comment recharger ?', 'Allez dans le menu Recharger, choisissez votre réseau Mobile Money (Airtel, Orange ou M-Pesa), effectuez le transfert vers le numéro indiqué puis soumettez la référence de transaction.', 2),
  ('Quels réseaux sont disponibles ?', 'Nous acceptons Airtel Money, Orange Money et M-Pesa en République Démocratique du Congo.', 3),
  ('Comment investir ?', 'Parcourez les 7 secteurs dans l’onglet Investir, choisissez un pack selon votre niveau VIP, sélectionnez la quantité et confirmez votre investissement.', 4),
  ('Comment fonctionnent les versements ?', 'Chaque investissement génère des bénéfices journaliers et 12 cycles de 30 jours. Les bénéfices sont cumulés et réclamables à tout moment.', 5),
  ('Comment retirer ?', 'Enregistrez votre compte de retrait dans vos paramètres, puis rendez-vous sur Retirer. Le minimum est de 5 000 FC avec 0% de frais.', 6),
  ('Quel est le minimum de retrait ?', 'Le montant minimum de retrait est fixé à 5 000 FC.', 7),
  ('Comment fonctionne le VIP ?', 'Votre niveau VIP progresse selon vos investissements et vous donne accès à un nombre maximum de packs plus élevé.', 8),
  ('Comment fonctionne l’équipe ?', 'Partagez votre code ou lien de parrainage. Vous touchez des commissions sur 4 niveaux (A: 10%, B: 3%, C: 1%, D: 1%) basées sur l’activité économique.', 9),
  ('Comment contacter le support ?', 'Utilisez la section Service pour ouvrir un ticket de support en direct avec notre équipe.', 10)
on conflict (question) do nothing;

insert into announcements (title, content, is_published)
values
  ('Bienvenue sur Biso Invest !', 'Ensemble, construisons demain. Découvrez nos opportunités d’investissement dans l’agriculture, l’élevage, l’énergie solaire et bien plus encore.', true),
  ('Sécurité et Transparence', 'Vos transactions financières sont sécurisées par un ledger rigoureux. Veillez à ne jamais partager vos identifiants.', true)
on conflict (title) do nothing;
