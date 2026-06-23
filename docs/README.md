# Docs README (Anti-drift)

## Sources actives

- Index documentaire : `docs/00_INDEX.md`
- Catalogue prix : `data/pricing.canonical.json`
- Loader catalogue : `lib/pricing.ts`
- Procédure catalogue : `docs/PROCEDURE_Integration_pricing_canonical.md`
- Audits et décisions datés : `docs/audits/`
- Archives historiques : `docs/archive/README.md`

## Règles de nettoyage

- `docs/` contient de la documentation, pas de mini-application autonome.
- Les dépendances, builds, rapports Playwright et sorties générées ne doivent pas être versionnés dans `docs/`.
- Les anciens supports tarifaires ou de campagne doivent être supprimés ou remplacés par un audit daté qui pointe vers le catalogue canonique.
- Les rapports d'audit historiques doivent être regroupés dans `docs/archive/` quand ils ne sont plus des documents actifs.

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
