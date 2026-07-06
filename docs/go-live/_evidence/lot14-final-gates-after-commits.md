# Lot 14 — Gates finales après commits locaux

Date : 2026-07-06.

## Résultats

| Commande | Statut | Résultat |
|---|---|---|
| `npm run typecheck` | PASSED | `tsc --noEmit` OK |
| `npm run lint` | PASSED | Next lint OK sous `--max-warnings 300`; warnings existants |
| `npm run test:unit -- --runInBand` | PASSED | 541 suites passées, 1 skipped ; 6531 tests passés, 4 skipped ; 7 snapshots passés |
| `npm run build` | PASSED | Next build OK, 142 pages statiques générées |
| `node scripts/security/audit-api-guards.mjs` | PASSED | Inventaire régénéré : 178 routes |
| `node scripts/go-live/generate-api-security-matrix.mjs` | PASSED | `P0=0`, `P1=6`, `P2=144`, `OK=28`, total 178 |
| `npm run audit:site-map` | PASSED | 292 routes, 413 edges, 0 link finding, 13 public orphan entries |
| `npm run check:no-hardcoded` | PASSED | 0 valeur hardcodée hors sources canoniques |
| `npm run check:docs-archive` | PASSED | Aucun audit/rapport historique à la racine `docs/` |
| `npm run check:bundle-weight` | PASSED | Toutes les routes dans baseline + 5 kB |
| `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | PASSED | 24 tests passés |
| `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium` | PASSED | 1 test passé |

## Observations

- Les commandes Playwright ont affiché un avertissement serveur `NO_COLOR`/`FORCE_COLOR` et un refresh passif Prisma non bloquant.
- Les tests unitaires complets affichent des logs d'erreurs simulées attendues ; aucun échec.
- `audit-api-guards` et `generate-api-security-matrix` ont régénéré uniquement les timestamps des documents générés.

## Décision

`LOCAL_COMMITS_EXECUTED`.

`READY_FOR_PUSH_REVIEW`.

`BETA_CONTROLEE_ALLOWED_WITH_RESERVES`.

`BETA_ELARGIE_BLOCKED`.

`GO_LIVE_LARGE_BLOCKED`.
