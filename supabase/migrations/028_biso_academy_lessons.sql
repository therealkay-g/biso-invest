-- Leçons pédagogiques pour BISO Academy
-- Idempotent : n'insère une leçon que si elle n'existe pas déjà.

INSERT INTO public.academy_lessons (course_id, title, content, duration_minutes, order_index)
SELECT c.id, 'Leçon 1 - C''est quoi investir sur BISO INVEST ?', $content$
## L'investissement, simplement

Investir, c'est placer votre argent dans un projet concret qui le fait travailler pour vous. Sur BISO INVEST, votre capital finance de vraies activités économiques dans **3 secteurs** : l'Agriculture, l'Élevage et la Pisciculture.

## Pourquoi ça fonctionne

- Votre argent participe au financement de fermes, de bassins piscicoles et d'élevages.
- Ces activités produisent et génèrent des revenus réels.
- Les revenus sont partagés avec vous, chaque jour, sur la durée de votre pack.

## Les packs en un coup d'œil

Chaque secteur propose des packs de **20 000, 50 000, 100 000 et 250 000 FC**, pour une durée de **12 mois**.

Le principe est simple : votre revenu mensuel est **égal à votre investissement**. Par exemple, un pack de 50 000 FC vous rapporte 50 000 FC par mois pendant 12 mois, soit 600 000 FC au total.

## Ce que vous devez retenir

- Choisissez un secteur qui vous inspire confiance.
- Commencez à votre rythme, même petit.
- Votre bénéfice se crée jour après jour : pensez à venir le récupérer.

Investir petit et régulier vaut mieux que ne jamais commencer.
$content$, 6, 0
FROM public.academy_courses c
WHERE c.title = 'Bases de l''Investissement'
AND NOT EXISTS (SELECT 1 FROM public.academy_lessons l WHERE l.course_id = c.id AND l.order_index = 0);

INSERT INTO public.academy_lessons (course_id, title, content, duration_minutes, order_index)
SELECT c.id, 'Leçon 2 - Créer et sécuriser votre compte', $content$
## Une inscription en 3 étapes

1. **Téléphone** : saisissez votre numéro. C'est votre identifiant de connexion.
2. **Mot de passe** : choisissez-le fort (8 caractères minimum, mélangez lettres et chiffres) et ne le partagez avec personne.
3. **Code de parrainage (optionnel)** : si un proche vous a invité, saisissez son code pour rejoindre son équipe.

## La sécurité, c'est sérieux

- Ne communiquez jamais votre mot de passe ni votre code PIN, même à un prétendu conseiller.
- BISO INVEST ne vous demandera jamais votre mot de passe par téléphone ou sur les réseaux sociaux.
- Méfiez-vous des faux profils : notre équipe officielle est joignable uniquement via le service client de l'application.

## Et ensuite ?

Dès votre inscription, votre profil et votre porte-monnaie (wallet) sont créés automatiquement. Vous êtes prêt pour la prochaine étape : recharger votre compte.
$content$, 7, 1
FROM public.academy_courses c
WHERE c.title = 'Bases de l''Investissement'
AND NOT EXISTS (SELECT 1 FROM public.academy_lessons l WHERE l.course_id = c.id AND l.order_index = 1);

INSERT INTO public.academy_lessons (course_id, title, content, duration_minutes, order_index)
SELECT c.id, 'Leçon 3 - Recharger votre porte-monnaie', $content$
## Le dépôt pas à pas

1. Ouvrez l''onglet **Wallet**.
2. Choisissez votre opérateur Mobile Money : **Airtel Money**, **Orange Money** ou **M-Pesa**.
3. Envoyez votre argent sur le numéro officiel affiché (montant minimum : **1 000 FC**).
4. Prenez une **capture d'écran du SMS de confirmation** que vous recevez.
5. Téléversez la capture dans l'application et soumettez votre demande.

## Et après ?

Un administrateur vérifie votre paiement. Dès validation, le montant est crédité sur votre solde de recharge, et vous pouvez l'utiliser pour investir.

## Les bons réflexes

- Vérifiez bien le numéro officiel avant d'envoyer la moindre somme.
- Gardez toujours votre reçu SMS jusqu'à la validation.
- Un seul dépôt par demande, avec un montant clair et complet.

Ne transférez jamais d'argent sur un numéro non officiel : les dépôts sont uniquement ceux affichés dans l'application.
$content$, 8, 2
FROM public.academy_courses c
WHERE c.title = 'Bases de l''Investissement'
AND NOT EXISTS (SELECT 1 FROM public.academy_lessons l WHERE l.course_id = c.id AND l.order_index = 2);

INSERT INTO public.academy_lessons (course_id, title, content, duration_minutes, order_index)
SELECT c.id, 'Leçon 4 - Choisir votre premier pack', $content$
## Où trouver votre pack ?

Dans l''onglet **Investir**, vous découvrez les **3 secteurs** : Agriculture, Élevage et Pisciculture. Chacun propose ses propres packs.

## Les 4 paliers disponibles

| Investissement | Revenu mensuel | Sur 12 mois |
|----------------|----------------|-------------|
| 20 000 FC      | 20 000 FC      | 240 000 FC  |
| 50 000 FC      | 50 000 FC      | 600 000 FC  |
| 100 000 FC     | 100 000 FC     | 1 200 000 FC|
| 250 000 FC     | 250 000 FC     | 3 000 000 FC|

## Comment bien choisir

- **Débutant** : commencez par le pack le plus accessible que vous pouvez confortablement financer.
- **Objectif régularité** : investissez des montants que vous pouvez maintenir sur les 12 mois.
- **Niveau VIP** : chaque palier vous fait aussi progresser en niveau VIP, ce qui augmente votre plafond de packs actifs.

## Bonus

Chaque pack finance un projet réel : Tilapia et Carpe pour la pisciculture, Poulets et Œufs pour l'élevage, Maïs et Soja pour l'agriculture. Vous investissez dans l'économie congolaise, pas dans du vent.
$content$, 8, 3
FROM public.academy_courses c
WHERE c.title = 'Bases de l''Investissement'
AND NOT EXISTS (SELECT 1 FROM public.academy_lessons l WHERE l.course_id = c.id AND l.order_index = 3);

INSERT INTO public.academy_lessons (course_id, title, content, duration_minutes, order_index)
SELECT c.id, 'Leçon 5 - Comprendre les bénéfices quotidiens', $content$
## Comment votre bénéfice est calculé

Votre revenu mensuel est distribué **chaque jour**, en divisant le revenu mensuel par le nombre de jours réels du mois (28, 29, 30 ou 31).

Exemple avec un pack de 50 000 FC sur un mois de 30 jours :
- 50 000 ÷ 30 = environ **1 666 FC par jour**.

## Le bouton VENDRE

Chaque jour, votre bénéfice du jour devient disponible. Vous devez cliquer sur **VENDRE** pour le récupérer sur votre solde.

Règle d'or : **un bénéfice non réclamé est perdu** ? Il ne se reporte jamais le lendemain. Pensez à venir chaque jour, ou au minimum enchaînez vos visites sans laisser passer plusieurs jours.

## Vos gains mensuels cumulés

Chaque pack affiche ce que vous avez déjà gagné depuis l'ouverture. Petit à petit, le total grandit : à la fin des 12 mois, vous aurez récupéré votre investissement multiplié par 12.

## Les 3 règles à retenir

1. Vendez votre jour J pour ne rien perdre.
2. Vous pouvez vendre plusieurs packs le même jour.
3. Vos gains vont dans votre solde, prêts pour le retrait ou le réinvestissement.
$content$, 9, 4
FROM public.academy_courses c
WHERE c.title = 'Bases de l''Investissement'
AND NOT EXISTS (SELECT 1 FROM public.academy_lessons l WHERE l.course_id = c.id AND l.order_index = 4);

INSERT INTO public.academy_lessons (course_id, title, content, duration_minutes, order_index)
SELECT c.id, 'Leçon 1 - Optimiser vos investissements', $content$
## Penser en portefeuille

Ne mettez pas tous vos œufs dans le même panier. Un bon investisseur répartit son capital entre plusieurs packs pour lisser les risques.

## La stratégie multi-packs

- **Échelonnez** vos départs : ouvrez des packs à des dates différentes pour avoir des bénéfices quotidiens réguliers.
- **Diversifiez les secteurs** : agriculture un jour, élevage et pisciculture ensuite.
- **Montez en palier** : dès que vous êtes à l''aise, passez de 20 000 à 50 000 FC par pack.

## Saisir les bons moments

Votre capital disponible se lit sur le wallet. Le bon réflexe est de ne pas tout engager d'un coup : gardez une réserve pour ne jamais manquer un jour de vente et pour saisir une opportunité.

## Le réinvestissement intelligent

Chaque vente vous donne du solde disponible. Vous pouvez le réutiliser pour ouvrir de nouveaux packs : c'est le pouvoir des intérêts composés, votre argent génère à son tour.
$content$, 10, 0
FROM public.academy_courses c
WHERE c.title = 'Stratégies Avancées'
AND NOT EXISTS (SELECT 1 FROM public.academy_lessons l WHERE l.course_id = c.id AND l.order_index = 0);

INSERT INTO public.academy_lessons (course_id, title, content, duration_minutes, order_index)
SELECT c.id, 'Leçon 2 - Le pouvoir du réinvestissement', $content$
## Qu'est-ce que réinvestir ?

Réinvestir, c'est utiliser vos bénéfices vendus pour ouvrir de nouveaux packs au lieu de tout retirer.

## L'exemple chiffré

- Mois 1 : vous ouvrez un pack de 50 000 FC.
- Chaque jour, vous vendez et cumulez.
- Petit à petit, vous reconstituer 50 000 FC : vous ouvrez un **2e pack**.
- Vos 2 packs génèrent désormais le double de bénéfices quotidiens.

## La règle des 50 %

Une méthode prudente : retirez 50 % de vos gains pour sécuriser, et réinvestissez les 50 % restants. Votre capital s'accroît sans augmenter votre risque personnel.

## Attention à la discipline

- Un plan strict vaut mieux qu'une stratégie improvisée.
- Ne réinvestissez jamais de l'argent dont vous pourriez avoir besoin à court terme.
- Respectez toujours le minimum de retrait de **5 000 FC** et les **15 % de frais** prévus.

Le réinvestissement est l'outil n°1 des investisseurs qui font grossir leur capital rapidement.
$content$, 8, 1
FROM public.academy_courses c
WHERE c.title = 'Stratégies Avancées'
AND NOT EXISTS (SELECT 1 FROM public.academy_lessons l WHERE l.course_id = c.id AND l.order_index = 1);

INSERT INTO public.academy_lessons (course_id, title, content, duration_minutes, order_index)
SELECT c.id, 'Leçon 3 - Diversifier entre les secteurs', $content$
## Pourquoi diversifier ?

L'Agriculture, l'Élevage et la Pisciculture suivent des rythmes différents. En répartissant vos packs, vous lissez naturellement vos revenus.

## Les 3 secteurs disponibles

- **Agriculture** : Maïs, Soja, Manioc et autres cultures.
- **Élevage** : Poulets, Œufs, Porcs, Chèvres.
- **Pisciculture** : Tilapia, Silure, Anguille, Carpe.

## La règle de répartition

En début de parcours, une méthode simple : **un tiers dans chaque secteur** dès que vous pouvez ouvrir 3 packs. Sinon, commencez par le secteur que vous comprenez le mieux.

## Ce qui ne change pas

Quel que soit le secteur, tous les packs suivent les mêmes règles : 12 mois, revenu mensuel égal à l'investissement, bénéfices quotidiens, vente obligatoire chaque jour.

La diversification est la première protection d'un investisseur sérieux.
$content$, 9, 2
FROM public.academy_courses c
WHERE c.title = 'Stratégies Avancées'
AND NOT EXISTS (SELECT 1 FROM public.academy_lessons l WHERE l.course_id = c.id AND l.order_index = 2);

INSERT INTO public.academy_lessons (course_id, title, content, duration_minutes, order_index)
SELECT c.id, 'Leçon 4 - Comprendre le niveau VIP', $content$
## Un statut qui grandit avec vous

Votre niveau VIP reflète votre total investi. Il monte automatiquement :

1. **VIP1** dès **20 000 FC** d'investissement.
2. **VIP2** dès **50 000 FC**.
3. **VIP3** dès **100 000 FC**.
4. **VIP4** dès **250 000 FC**.

## Les avantages concrets

- **Un plafond plus haut** : plus votre VIP est élevé, plus vous pouvez détenir de packs actifs en même temps.
- **Un profil valorisé** : votre niveau s'affiche fièrement sur votre profil.
- **Une progression motivante** : chaque pack ouvert vous rapproche du niveau suivant.

## Comment progresser vite ?

- Ouvrez des packs de manière régulière, pas seulement en une fois.
- Réinvestissez une partie de vos bénéfices pour augmenter votre capital investi.
- Suivez votre progression dans l''onglet **Profil** ou **VIP** de l'application.

La régularité bat toujours la précipitation.
$content$, 7, 3
FROM public.academy_courses c
WHERE c.title = 'Stratégies Avancées'
AND NOT EXISTS (SELECT 1 FROM public.academy_lessons l WHERE l.course_id = c.id AND l.order_index = 3);

INSERT INTO public.academy_lessons (course_id, title, content, duration_minutes, order_index)
SELECT c.id, 'Leçon 5 - Suivre vos performances', $content$
## Les indicateurs à surveiller

- **Solde disponible** : votre argent récupérable sur le wallet.
- **Mes investissements** : liste de vos packs et leur bénéfice du jour.
- **Mes gains** : l'historique de ce que vous avez vendu au fil du temps.

## Vérifier chaque jour

Prenez 2 minutes par jour pour :
1. Vendre les bénéfices disponibles.
2. Vérifier que vos packs restent actifs.
3. Consulter les **annonces** et les notifications pour rester informé.

## Comprendre vos statistiques

Plus vos ventes quotidiennes tournent sans interruption, plus votre rendement total approche le maximum prévu. Une seule journée oubliée peut coûter de l'argent : l''assiduité est votre meilleure alliée.

## Le rôle des notifications

La plateforme vous prévient : bénéfices à vendre, nouveaux filleuls, retraits validés. Activez les notifications pour ne jamais manquer une échéance.

Un bon investisseur est un investisseur informé.
$content$, 8, 4
FROM public.academy_courses c
WHERE c.title = 'Stratégies Avancées'
AND NOT EXISTS (SELECT 1 FROM public.academy_lessons l WHERE l.course_id = c.id AND l.order_index = 4);

INSERT INTO public.academy_lessons (course_id, title, content, duration_minutes, order_index)
SELECT c.id, 'Leçon 1 - Le pouvoir du parrainage', $content$
## Une équipe qui travaille pour vous

Le parrainage, c'est inviter d'autres personnes à investir sur BISO INVEST. En échange, vous êtes récompensé : c'est le système de revenus le plus puissant de la plateforme.

## Comment ça marche ?

- Vous partagez votre **code de parrainage**.
- Chaque filleul inscrit avec votre code et qui **investit** vous fait gagner **3 000 FC** automatiquement.
- Le bonus est crédité dès que votre filleul commence à investir.

## C'est gagnant-gagnant

Votre filleul commence son propre parcours d'investissement, et vous êtes récompensé pour l'avoir accompagné. Chacun profite du système, personne n'est lésé.

## Les chiffres à connaître

- **3 000 FC** par filleul qui investit.
- Des **bonus de palier** dès que votre équipe grandit (5, 10, 20, 50, 100 filleuls).
- Récompenses allant de **15 000 à 500 000 FC**.

Le parrainage transforme une action simple (partager un lien) en revenus réguliers.
$content$, 8, 0
FROM public.academy_courses c
WHERE c.title = 'Maîtriser le Parrainage'
AND NOT EXISTS (SELECT 1 FROM public.academy_lessons l WHERE l.course_id = c.id AND l.order_index = 0);

INSERT INTO public.academy_lessons (course_id, title, content, duration_minutes, order_index)
SELECT c.id, 'Leçon 2 - Votre code et votre lien de parrainage', $content$
## Où trouver votre code ?

Dans l''onglet **Tâche** de l'application. Votre code a le format **BISO + 6 caractères** (exemple : BISO ABC123).

## Comment le partager ?

- Copiez le code affiché.
- Envoyez-le à un proche par WhatsApp, SMS ou réseaux sociaux.
- Votre filleul le saisira lors de son inscription (ou l''attachera à son compte).

## Les bons réflexes pour un partage réussi

- Expliquez en 2 phrases ce qu'est BISO INVEST avant d'envoyer le code : les gens adhèrent à ce qu'ils comprennent.
- Partagez votre expérience : vos gains concrets rassurent.
- Ne spammez jamais : une invitation personnalisée vaut mieux que 100 messages impersonnels.

## Vérifiez vos filleuls

Dans l''onglet Tâche, vous voyez la liste de vos filleuls et vos récompenses. Surveillez régulièrement : chaque inscription qui investit = 3 000 FC pour vous.
$content$, 6, 1
FROM public.academy_courses c
WHERE c.title = 'Maîtriser le Parrainage'
AND NOT EXISTS (SELECT 1 FROM public.academy_lessons l WHERE l.course_id = c.id AND l.order_index = 1);

INSERT INTO public.academy_lessons (course_id, title, content, duration_minutes, order_index)
SELECT c.id, 'Leçon 3 - Les récompenses par paliers', $content$
## Plus votre équipe grandit, plus vous gagnez

| Filleuls | Récompense |
|----------|------------|
| 1        | 3 000 FC   |
| 5        | 15 000 FC  |
| 10       | 30 000 FC  |
| 20       | 60 000 FC  |
| 50       | 200 000 FC |
| 100      | 500 000 FC |

## Comment lire ce tableau ?

- Chaque filleul qui investit : **3 000 FC** immédiats.
- Dès que vous atteignez **5 filleuls** investisseurs : bonus **15 000 FC**.
- À **10** : bonus **30 000 FC**.
- À **20** : bonus **60 000 FC**.
- À **50** : bonus **200 000 FC**.
- À **100** : bonus **500 000 FC**.

## La logique du système

Les paliers se cumulent au fur et à mesure de la croissance de votre équipe. Plus vous amenez de monde, plus les récompenses deviennent conséquentes : c'est votre projet d'entreprise personnel.

## Fixez-vous un objectif

Commencez par viser vos **5 premiers filleuls**. Rien de compliqué : 5 personnes de confiance qui commencent à investir, et vous êtes déjà récompensé.
$content$, 7, 2
FROM public.academy_courses c
WHERE c.title = 'Maîtriser le Parrainage'
AND NOT EXISTS (SELECT 1 FROM public.academy_lessons l WHERE l.course_id = c.id AND l.order_index = 2);

INSERT INTO public.academy_lessons (course_id, title, content, duration_minutes, order_index)
SELECT c.id, 'Leçon 4 - Construire une équipe solide', $content$
## Des filleuls, pas des numéros

Une équipe qui dure, c'est une équipe accompagnée. Votre rôle ne s'arrête pas à l'inscription de vos filleuls.

## Les 5 habitudes des bons parrains

1. **Expliquez** la promesse de BISO INVEST avec vos mots (packs, bénéfices quotidiens, retraits).
2. **Formez** vos filleuls dès le début : faites-leur comprendre la règle du bénéfice quotidien à vendre.
3. **Motivez** en montrant votre propre progression et vos gains.
4. **Restez joignable** : créez par exemple un groupe WhatsApp pour votre équipe.
5. **Célébrez** chaque victoire : premier pack, première vente, premier retrait.

## La cohérence

Un filleul qui ne comprend pas le système se décourage et arrête. Un filleul bien formé investit, vend, réinvestit, et devient peut-être une future recrue de premier plan.

## Votre héritage

Avec 100 filleuls actifs en palier maximum, vos bonus atteignent 500 000 FC. Imaginez ce que représente une équipe qui grossit encore : c'est un revenu complémentaire construit durablement.

Commencez aujourd'hui : partagez votre code dès votre prochaine conversation avec un proche.
$content$, 10, 3
FROM public.academy_courses c
WHERE c.title = 'Maîtriser le Parrainage'
AND NOT EXISTS (SELECT 1 FROM public.academy_lessons l WHERE l.course_id = c.id AND l.order_index = 3);