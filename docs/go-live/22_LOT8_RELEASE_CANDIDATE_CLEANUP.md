# Lot 8 — Release candidate cleanup

## Verdict

`ACCEPTÉ AVEC RÉSERVES`

## Synthèse

Lot 8 ne modifie pas de fonctionnalité produit. Il corrige la préparation release candidate : manifeste ligne par ligne, plan de commits exploitable, regression scripts renforcée, preuves runtime retentées sans secret et registres de décision.

## Manifeste et plan

- Manifeste propre : `283` entrées.
- Include RC : `281`.
- Exclude : `1` (`rapport_audit_2_07_2026.md`).
- Needs human review : `1` (`docs/audits/audit-nexus-reussite.md`).
- Tous les chemins `__tests__/**` sont classés `Tests unitaires`.
- Plan de commits : `9` commits proposés, aucun commit exécuté.

## Décisions

- `P0=0` maintenu.
- `P1=6` maintenus et visibles.
- ClicToPay reste `DISABLED`.
- Bêta contrôlée possible avec réserves.
- Bêta élargie bloquée.
- Go-live large bloqué.

## Gates finales

| Gate | Statut | Résultat |
| --- | --- | --- |
| `npm run typecheck` | OK | TypeScript sans erreur bloquante |
| `npm run lint` | OK | Warnings existants dans le seuil configuré |
| `npm run test:unit -- --runInBand` | OK | `538` suites passées sur `539`, `1` skipped ; `6516` tests passés sur `6520`, `4` skipped |
| `npm run build` | OK | Build Next.js complet, `142` pages statiques générées, assets standalone copiés |
| `node scripts/security/audit-api-guards.mjs` | OK | `178` routes écrites dans `docs/security/API_GUARD_INVENTORY.md` |
| `node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=6`, `P2=144`, `OK=28` |
| `npm run audit:site-map` | OK | `292` routes, `413` edges, `0` link finding, `13` orphan entries |
| `npm run check:no-hardcoded` | OK | `0` hardcoded values outside canonical sources |
| `npm run check:docs-archive` | OK | Aucun audit/report historique à la racine `docs/` |
| `npm run check:bundle-weight` | OK | Toutes les routes dans baseline + `5 kB` |
| Playwright public | OK | `24` tests passés |
| Playwright assessment token | OK | `1` test passé |

## Réserves maintenues

- Redis/Upstash non prouvé : `NEXUS_HEALTH_AUTH_ABSENT`.
- Test `429` runtime non exécuté : `RL_PROBE_NOT_ALLOWED`.
- Dry-run DB ContactLead non exécuté : `DATABASE_URL_ABSENT`, `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED`.
- Les `6` P1 publics/paiement restent visibles et non requalifiés.
