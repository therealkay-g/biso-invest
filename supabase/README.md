# Règle financière officielle — BISO INVEST

## Gain quotidien par secteur

Pour chaque investissement, le bénéfice vendable d'une journée est calculé côté serveur selon le **taux du secteur snapshoté à la souscription** :

```text
bénéfice quotidien = taux du secteur × capital total investi
```

| Secteur | Taux quotidien | Durée du contrat |
|---------|----------------|------------------|
| Agriculture | 10 % | 15 jours |
| Élevage | 15 % | 18 jours |
| Pisciculture | 20 % | 10 jours |

Le montant est arrondi à deux décimales. Exemples sur 20 000 FC investis :

- Agriculture (10 % × 15 j) → 2 000 FC par jour → 30 000 FC au total ;
- Élevage (15 % × 18 j) → 3 000 FC par jour → 54 000 FC au total ;
- Pisciculture (20 % × 10 j) → 4 000 FC par jour → 40 000 FC au total.

Cette règle ne dépend pas du nombre de jours du mois. Le même montant s'ajoute
donc au wallet chaque jour éligible, sous réserve que chaque jour soit
effectivement réclamé.

## Durée des contrats

- Packs **Agriculture** : **15 jours** (durée courte, un seul cycle).
- Packs **Élevage** : **18 jours** (durée courte, un seul cycle).
- Packs **Pisciculture** : **10 jours** (durée courte, un seul cycle).
- Toute donnée hors catalogue garde la règle legacy de 3 mois.
- La souscription snapshot `investments.duration_days`, `investments.daily_rate`,
  `investments.daily_profit` et `investments.ends_at` : le claim, la finalisation
  et les notifications s'arrêtent naturellement à la fin du contrat sans réécrire
  les claims historiques.
- Le taux est stocké sur `product_categories.daily_rate` (politique du secteur) et
  snapshoté sur `products.daily_rate` puis `investments.daily_rate` à la
  souscription. Les contrats existants ne sont jamais réécrits.

## Règles de vente

- La durée d'un contrat est fixée à la souscription : 15 jours (Agriculture),
  18 jours (Élevage) ou 10 jours (Pisciculture).
- La date métier est celle de `Africa/Kinshasa`.
- Un investissement ne peut être vendu qu'une seule fois par jour.
- Le bouton **VENDRE** agit sur un seul investissement.
- Un bénéfice non réclamé le jour même est perdu et n'est jamais reporté.
- Le calcul, le contrôle de propriété, le crédit du portefeuille et l'écriture du
  ledger sont effectués par PostgreSQL, jamais par le navigateur.

## Mise en production

Pour une base existante, appliquer les migrations dans l'ordre, en terminant par :

```text
030_daily_profit_10_percent.sql
031_vip_max_packs_fix.sql
032_agriculture_15_days.sql
033_sector_daily_rates.sql
```

Les anciennes migrations ont aussi été corrigées pour permettre une installation
propre depuis le début. Les réclamations déjà validées ne sont jamais réécrites :
la nouvelle règle s'applique à la prochaine date métier encore disponible pour
chaque investissement. Ne pas exécuter une ancienne version du dépôt contre la
production.

Après application de la migration 033, recharger le schéma PostgREST si le
provider Supabase ne le fait pas automatiquement, puis vérifier au minimum :

1. l'existence de `public.claim_daily_profit(uuid)` ;
2. l'absence de la version sans paramètre `public.claim_daily_profit()` ;
3. l'absence d'accès utilisateur à `public.claim_investment_profit(uuid, uuid, numeric)` ;
4. la grille par secteur : Agriculture 10 % / 15 j, Élevage 15 % / 18 j, Pisciculture 20 % / 10 j ;
5. un capital de 20 000 FC enregistre 2 000 FC/jour (Agriculture), 3 000 FC/jour (Élevage), 4 000 FC/jour (Pisciculture) ;

Le script `supabase/verify_daily_profit.sql` exécute ces contrôles en lecture seule.