# Docs README (Anti-drift)

## Régénérer les inventaires
```bash
node scripts/docs/route_inventory.js
```

Fichiers générés:
- `docs/_generated/routes.json`
- `docs/_generated/rbac_matrix.json`
- `docs/_generated/rbac_coverage.json`

## Quand régénérer
- Après ajout/suppression de page `app/**/page.tsx`
- Après ajout/suppression d’API `app/api/**/route.ts`
- Après modification guard/policy (`lib/guards.ts`, `lib/rbac.ts`, `lib/access/*`)

## Contrôle rapide
```bash
jq '.counts' docs/_generated/routes.json
jq '.policyCount' docs/_generated/rbac_matrix.json
jq '.adminSensitive' docs/_generated/rbac_coverage.json
```
