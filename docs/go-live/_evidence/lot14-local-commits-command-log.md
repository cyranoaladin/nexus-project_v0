# Lot 14 — Local commits command log

## Baseline

- Date locale : 2026-07-06 21:46:09 CET
- Branche : `feat/lot4-accessors-runtime`
- Commit initial : `db8545a19`
- Node : `v20.20.0`
- npm : `10.8.2`
- Staging initial : vide
- Diff `.env` initial : aucune sortie
- Entrées `git status --short --untracked-files=all` : `320`
- Fichiers suivis modifiés : `130`
- Fichiers non suivis : `190`

## P1 confirmés avant commits

- `/api/payments/clictopay/webhook`
- `/api/assessments/submit`
- `/api/bilan-gratuit`
- `/api/lamis/teacher-report`
- `/api/stages/[stageSlug]/inscrire`
- `/api/student/activate`

## Fichiers interdits / exclus

- `rapport_audit_2_07_2026.md` : exclu du staging.
- `docs/audits/audit-nexus-reussite.md` : exclu du staging.
- `.env*` : exclu du staging.
- `.next/**`, `node_modules/**`, `test-results/**`, `playwright-report/**` : exclus du staging.

## Commits exécutés

| # | Message | Hash | Tests du bloc | Notes |
|---:|---|---|---|---|
| 1 | `chore(go-live): update security inventory and matrices` | `48d64a4fd` | `node scripts/security/audit-api-guards.mjs`; `node scripts/go-live/generate-api-security-matrix.mjs`; `npm run check:bundle-weight` | Générateurs relancés, `P0=0`, `P1=6`, staging vide après commit. |
| 2 | `fix(api-security): close admin and role guard gaps` | `eb0d6630f` | `npm run test:unit -- --runInBand __tests__/api/admin.config.route.test.ts __tests__/api/admin.documents.route.test.ts __tests__/api/bilans.id.route.test.ts` | 3 suites passées, 27 tests passés, staging exact 61 fichiers, staging vide après commit. |
| 3 | `fix(public-funnel): lead-only bilan and assessment token binding` | `798f712ae` | `npm run test:unit -- --runInBand __tests__/api/bilan-gratuit.product-rgpd.test.ts __tests__/api/assessments.submit.token-binding.test.ts __tests__/app/bilan-gratuit.assessment-page-token.test.tsx` | 3 suites passées, 13 tests passés, staging exact 12 fichiers, staging vide après commit. |
| 4 | `fix(runtime): rate-limit probe and business-config gate` | `b03d0c37b` | `npm run test:unit -- --runInBand __tests__/api/internal.rate-limit-probe.test.ts __tests__/api/internal.business-config.health.test.ts __tests__/lib/rate-limit.production-gate.test.ts` | 3 suites passées, 8 tests passés, staging exact 4 fichiers, staging vide après commit. |
| 5 | `fix(payments): keep clictopay disabled and fail closed` | `43be9787b` | `npm run test:unit -- --runInBand __tests__/api/payments.clictopay.disabled-contract.test.ts __tests__/api/payments.clictopay.feature-flag-consistency.test.ts __tests__/ui/payment-methods.clictopay-disabled.test.tsx` | 3 suites passées, 5 tests passés, staging exact 3 fichiers, staging vide après commit. |
| 6 | `chore(maintenance): add contact-lead retention dry-run` | `b7d94cf7a` | `npm run test:unit -- --runInBand __tests__/scripts/contact-leads-retention.test.ts __tests__/lib/crm/contact-leads.retention.test.ts` | 2 suites passées, 4 tests passés, staging exact 1 fichier, staging vide après commit. |
| 7 | `test(security): add no-leak, idor, token and audit regressions` | `eec8430ed` | `npm run test:unit -- --runInBand` | 541 suites passées, 1 suite skipped, 6531 tests passés, 4 tests skipped, staging exact 81 fichiers, staging vide après commit. |
| 8 | `test(e2e): protect public assessment route` | `5b7fe4def` | `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium` | 1 test Chromium passé, staging exact 5 fichiers, staging vide après commit. |
| 9 | `docs(go-live): add evidence and go-no-go registers` | `e92f9f546` | `npm run check:docs-archive` | Check archive OK, staging exact 109 fichiers, staging vide après commit. |

## Tests exécutés

- Commit 1 : inventaire API OK (`178` routes), matrice OK (`P0=0`, `P1=6`, `P2=144`, `OK=28`), bundle weight OK.
- Commit 2 : tests ciblés API admin/documents/bilans OK (`3` suites, `27` tests).
- Commit 3 : tests ciblés bilan/token/page assessment OK (`3` suites, `13` tests). Un `console.error` attendu apparaît sur un chemin de validation simulé sans échec.
- Commit 4 : tests ciblés runtime/probe/business config OK (`3` suites, `8` tests).
- Commit 5 : tests ciblés ClicToPay disabled OK (`3` suites, `5` tests).
- Commit 6 : tests ciblés rétention ContactLead OK (`2` suites, `4` tests).
- Commit 7 : suite unitaire complète OK (`541` suites passées, `1` suite skipped, `6531` tests passés, `4` tests skipped).
- Commit 8 : Playwright assessment token OK (`1` test passé). Avertissements serveur observés sans échec : `NO_COLOR` ignoré avec `FORCE_COLOR`, refresh passif Prisma non bloquant.
- Commit 9 : `check:docs-archive` OK.

## Gates finales après les 9 commits

| Commande | Statut | Résultat |
|---|---|---|
| `npm run typecheck` | PASSED | `tsc --noEmit` OK |
| `npm run lint` | PASSED | Next lint OK sous seuil `--max-warnings 300` |
| `npm run test:unit -- --runInBand` | PASSED | 541 suites passées, 1 skipped ; 6531 tests passés, 4 skipped |
| `npm run build` | PASSED | Next build OK, 142 pages statiques générées |
| `node scripts/security/audit-api-guards.mjs` | PASSED | `178` routes |
| `node scripts/go-live/generate-api-security-matrix.mjs` | PASSED | `P0=0`, `P1=6`, `P2=144`, `OK=28` |
| `npm run audit:site-map` | PASSED | 292 routes, 413 edges, 0 link finding |
| `npm run check:no-hardcoded` | PASSED | 0 valeur hardcodée hors sources canoniques |
| `npm run check:docs-archive` | PASSED | OK |
| `npm run check:bundle-weight` | PASSED | Toutes les routes dans baseline + 5 kB |
| Playwright public homepage/offres/bilan | PASSED | 24 tests passés |
| Playwright assessment token | PASSED | 1 test passé |

## État final

- Les 9 commits du runbook Lot 11 ont été exécutés localement.
- Aucun push, aucune PR, aucun déploiement, aucune migration.
- `git diff --cached --name-only` vide après les 9 commits et après les gates finales.
- Les 6 P1 restent visibles.
- `docs/audits/audit-nexus-reussite.md` et `rapport_audit_2_07_2026.md` restent hors staging.
- Les générateurs de gates finales ont modifié uniquement les timestamps de `docs/security/API_GUARD_INVENTORY.md` et `docs/go-live/api-security-matrix.full.md`.
- Documentation Lot 14 préparée pour commit documentaire local additionnel.
