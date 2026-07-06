# Lot 5 — BusinessConfig runtime decision

## Objectif

Éviter qu'un fallback statique masque une production non migrée.

## Tests exécutés

Commande :

```bash
npm run test:unit -- --runInBand \
__tests__/lib/business-config.production-gate.test.ts \
__tests__/api/internal.business-config.health.test.ts \
__tests__/lib/business-config.fallback.test.ts
```

Résultat : OK, `3` suites, `6` tests.

## Décision

- local/test : `static_fallback_allowed` acceptable ;
- production : `static_fallback_unexpected`, `ok=false`, sauf opt-in explicite `BUSINESS_CONFIG_STATIC_FALLBACK_ALLOWED=true` ;
- aucune migration automatique ;
- si la table est requise en production, migration non destructive à valider humainement.

## Healthcheck production

Non vérifié authentifié : `NEXUS_HEALTH_AUTH_ABSENT`.

Procédure attendue :

```bash
curl -sS \
  -H "Authorization: Bearer ${NEXUS_HEALTH_AUTH}" \
  https://nexusreussite.academy/api/internal/health \
  | jq '{businessConfig: .runtime.businessConfig, check: .checks.businessConfig}'
```

Ne jamais afficher la valeur du token.

