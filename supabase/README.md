# Règle financière officielle — BISO INVEST

## Gain quotidien

Pour chaque investissement, le bénéfice vendable d'une journée est calculé côté serveur selon :

```text
bénéfice quotidien = 10 % × capital total investi
```

Le montant est arrondi à deux décimales. Par exemple :

- 20 000 FC investis → 2 000 FC par jour ;
- 50 000 FC investis → 5 000 FC par jour ;
- 250 000 FC investis → 25 000 FC par jour.

Cette règle ne dépend pas du nombre de jours du mois. Ainsi, un capital de 20 000 FC vend chaque jour pendant 90 jours éligibles produit 180 000 FC de bénéfices, sous réserve que chaque jour soit effectivement réclamé.

## Durée des contrats

- Packs du secteur **Agriculture** : **15 jours** (durée courte, un seul cycle).
- Packs des autres secteurs : **3 mois**.
- Un pack Agriculture de 20 000 FC verse 2 000 FC/jour pendant 15 jours → 30 000 FC au total si chaque jour est réclamé.
- La souscription snapshot `investments.duration_days` et `investments.ends_at` : le claim, la finalisation et les notifications s'arrêtent naturellement à la fin du contrat sans réécrire les claims historiques.

## Règles de vente

- La durée d'un contrat est fixée à la souscription : 15 jours pour l'Agriculture, 3 mois pour les autres secteurs.
- La date métier est celle de `Africa/Kinshasa`.
- Un investissement ne peut être vendu qu'une seule fois par jour.
- Le bouton **VENDRE** agit sur un seul investissement.
- Un bénéfice non réclamé le jour même est perdu et n'est jamais reporté.
- Le calcul, le contrôle de propriété, le crédit du portefeuille et l'écriture du ledger sont effectués par PostgreSQL, jamais par le navigateur.

## Mise en production

Pour une base existante, appliquer les migrations dans l'ordre, en terminant par :

```text
030_daily_profit_10_percent.sql
031_vip_max_packs_fix.sql
032_agriculture_15_days.sql
```

Les anciennes migrations ont aussi été corrigées pour permettre une installation propre depuis le début. Les réclamations déjà validées ne sont jamais réécrites : la nouvelle règle s'applique à la prochaine date métier encore disponible pour chaque investissement. Ne pas exécuter une ancienne version du dépôt contre la production.

Après application de la migration 030, recharger le schéma PostgREST si le provider Supabase ne le fait pas automatiquement, puis vérifier au minimum :

1. l'existence de `public.claim_daily_profit(uuid)` ;
2. l'absence de la version sans paramètre `public.claim_daily_profit()` ;
3. l'absence d'accès utilisateur à `public.claim_investment_profit(uuid, uuid, numeric)` ;
4. qu'un capital de 20 000 FC enregistre un bénéfice de 2 000 FC pour un jour.