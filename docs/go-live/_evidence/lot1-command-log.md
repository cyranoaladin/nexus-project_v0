# Lot 1 — Journal de commandes

Date locale initiale : 2026-07-02 21:45:22 CET.

## État initial

- Branche : `feat/lot4-accessors-runtime`
- Commit court : `db8545a19`
- Node utilisé : `v20.20.0`
- npm utilisé : `10.8.2`
- État git initial : dépôt déjà modifié par Lot 0-bis et docs go-live non suivis.

## Commandes baseline exécutées

| Commande | Statut | Résultat résumé |
| --- | --- | --- |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node -v` | OK | `v20.20.0` |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm -v` | OK | `10.8.2` |
| `git rev-parse --abbrev-ref HEAD` | OK | `feat/lot4-accessors-runtime` |
| `git rev-parse --short HEAD` | OK | `db8545a19` |
| `git status --short` | OK | Modifications Lot 0-bis existantes + docs non suivis |

## Commandes ciblées exécutées

| Commande | Statut | Résultat résumé |
| --- | --- | --- |
| `npm run test:unit -- --runInBand __tests__/api/documents.id.route.test.ts __tests__/api/documents-access.test.ts __tests__/lib/invoice/access-scope.test.ts` | ÉCHEC attendu TDD | Helper facture absent, fuite `localPath`, 403 révélateur |
| `npm run test:unit -- --runInBand __tests__/api/documents.id.route.test.ts __tests__/api/documents-access.test.ts __tests__/lib/invoice/access-scope.test.ts __tests__/api/invoices.pdf.route.test.ts __tests__/api/invoices.receipt.pdf.route.test.ts` | OK | 5 suites, 43 tests OK |
| `npm run test:unit -- --runInBand __tests__/api/student.activate.route.test.ts __tests__/api/public-rate-limit.coverage.test.ts` | OK | 2 suites, 17 tests OK |
| `npm run test:unit -- --runInBand __tests__/api/lamis.teacher-report.route.test.ts __tests__/api/public-rate-limit.coverage.test.ts __tests__/api/stages/stages-list.test.ts __tests__/api/stages.reservations.access.test.ts __tests__/api/coach.sessions.report.route.test.ts` | OK | 5 suites, 45 tests OK |
| `node scripts/security/audit-api-guards.mjs` | OK | Inventaire régénéré, 176 routes |
| `node scripts/go-live/generate-api-security-matrix.mjs` | OK | Matrice régénérée, P0=0, P1=56, P2=93, OK=27 |

## Commandes finales obligatoires

| Commande | Statut | Résultat résumé |
| --- | --- | --- |
| `npm run typecheck` | OK | `tsc --noEmit` sans erreur |
| `npm run lint` | OK | Warnings ESLint existants sous `--max-warnings 300` |
| `npm run test:unit -- --runInBand` | OK | 506 suites passées, 1 suite ignorée ; 6360 tests passés, 4 ignorés |
| `npm run build` | OK | Build Next réussi, 143 pages statiques générées, assets standalone copiés |
| `node scripts/security/audit-api-guards.mjs` | OK | `docs/security/API_GUARD_INVENTORY.md`, 176 routes |
| `node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=56`, `P2=93`, `OK=27` |
| `npm run audit:site-map` | OK | 290 routes, 412 edges, 0 link findings, 13 public orphan entries |
| `npm run check:no-hardcoded` | OK | 0 hardcoded values outside canonical sources |
| `npm run check:docs-archive` | OK | no historical audit/report files at docs root |
| `npm run check:bundle-weight` | OK | all tracked routes within baseline + 5 kB |
| `npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | OK | 24 tests passed |

## Warnings observés

- `npm run lint` : nombreux warnings préexistants `no-explicit-any`, `no-unused-vars`, hooks, sous le seuil configuré.
- `npm run test:unit` : logs de tests simulant des erreurs DB/RAG/SMTP/jsdom ; statut final OK.
- Smoke Playwright : warning WebServer `PrismaClientKnownRequestError P2021`, table `public.business_configs` absente pendant refresh passif de config. Le smoke public reste vert, mais ce point doit être vérifié dans le lot infra/DB.

## Limites

- Pas de lecture de `.env`.
- Pas de migration Prisma.
- Pas de déploiement.
- Le mode Redis/Upstash de production n’est pas prouvé localement.
