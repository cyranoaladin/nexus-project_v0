# Lot 4 — BusinessConfig production gate

## Problème

Le fallback `business_configs` ne doit pas masquer une production non migrée.

## Décision

- local/test : fallback statique autorisé et explicite.
- production : table absente = dégradé sauf opt-in explicite `BUSINESS_CONFIG_STATIC_FALLBACK_ALLOWED=true`.

## Modes

- `database` : table disponible.
- `static_fallback_allowed` : table absente mais fallback autorisé.
- `static_fallback_unexpected` : table absente en production sans opt-in, `ok=false`.
- `static_fallback_error` : erreur non liée à table manquante.

## Healthcheck

`/api/internal/health` expose `runtime.businessConfig` et `checks.businessConfig`.

## Tests

- `__tests__/lib/business-config.production-gate.test.ts`
- `__tests__/api/internal.business-config.health.test.ts`
- `__tests__/lib/business-config.fallback.test.ts`

## Migration

Aucune migration automatique. Si la table est requise en production, appliquer une migration non destructive via le processus de release validé humainement.
