# Lot 3 — `business_configs` DB drift

## Constat

Le smoke Playwright public passait mais le webserver local signalait régulièrement une table `public.business_configs` absente pendant un refresh passif.

## Analyse code

- Modèle Prisma : `BusinessConfig` avec `@@map("business_configs")`.
- Accès runtime : `lib/config/snapshot.ts`.
- Routes d'administration : `app/api/admin/config/*`.

## Décision

La table est un store d'overrides runtime. Quand elle est absente en local ou sur environnement non migré, le code doit utiliser les valeurs statiques et classer explicitement le fallback.

## Correction

- `lib/config/snapshot.ts` détecte l'erreur Prisma `P2021` sur `business_configs`.
- Le fallback devient `static_fallback` sans `console.error` récurrent.
- `app/api/internal/health/route.ts` expose `runtime.businessConfig`.

## Tests

- `__tests__/lib/business-config.fallback.test.ts`
- `__tests__/api/internal.business-config.health.test.ts`

## Décision migration

Aucune migration n'a été lancée. Si la table est requise en production, une migration non destructive doit être validée humainement et appliquée via le process de release.
