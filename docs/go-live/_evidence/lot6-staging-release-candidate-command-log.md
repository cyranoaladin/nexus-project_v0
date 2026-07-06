# Lot 6 — Command log staging/release candidate

## Baseline

- Date locale : 2026-07-03 14:14:02 CET
- Branche : `feat/lot4-accessors-runtime`
- Commit court : `db8545a19`
- Node : `v20.20.0`
- npm : `10.8.2`
- État initial : worktree chargé, `261` entrées `git status --porcelain`, `130` fichiers suivis modifiés, `131` fichiers non suivis.
- Diff `.env` : aucun.
- Rapport racine `rapport_audit_2_07_2026.md` : non suivi, à exclure de la release candidate sauf décision humaine explicite.

## P1 initiaux

| Route | Statut Lot 6 |
| --- | --- |
| `/api/payments/clictopay/webhook` | P1 maintenu |
| `/api/assessments/submit` | P1 maintenu |
| `/api/bilan-gratuit` | P1 maintenu |
| `/api/lamis/teacher-report` | P1 maintenu |
| `/api/stages/[stageSlug]/inscrire` | P1 maintenu |
| `/api/student/activate` | P1 maintenu |

## Commandes baseline exécutées

| Commande | Résultat | Statut |
| --- | --- | --- |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node -v` | `v20.20.0` | OK |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm -v` | `10.8.2` | OK |
| `git rev-parse --abbrev-ref HEAD` | `feat/lot4-accessors-runtime` | OK |
| `git rev-parse --short HEAD` | `db8545a19` | OK |
| `git status --short --untracked-files=all` | worktree chargé, détails dans audit worktree | OK |
| `git diff --name-only \| rg '(^\|/)\\.env($\|\\.)' \|\| true` | aucune sortie | OK |
| `rg -n "^\\| P1 \\|" docs/go-live/api-security-matrix.full.md` | 6 P1 confirmés | OK |

## Commandes avec secrets absents

| Commande | Résultat | Décision |
| --- | --- | --- |
| `if [ -n "${NEXUS_HEALTH_AUTH:-}" ]; then echo "NEXUS_HEALTH_AUTH_PRESENT"; else echo "NEXUS_HEALTH_AUTH_ABSENT"; fi` | `NEXUS_HEALTH_AUTH_ABSENT` | Healthcheck authentifié non exécuté |
| `if [ -n "${NEXUS_HEALTH_AUTH:-}" ]; then echo "AUTH_PRESENT"; else echo "AUTH_ABSENT"; fi` | `AUTH_ABSENT` | Probe 429 runtime non exécutée |
| `if [ "${NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE:-}" = "true" ]; then echo "RL_PROBE_ALLOWED"; else echo "RL_PROBE_NOT_ALLOWED"; fi` | `RL_PROBE_NOT_ALLOWED` | Probe 429 production/staging non autorisée |
| `if [ -n "${DATABASE_URL:-}" ]; then echo "DATABASE_URL_PRESENT"; else echo "DATABASE_URL_ABSENT"; fi` | `DATABASE_URL_ABSENT` | Dry-run DB ContactLead non exécuté |
| `if [ "${NEXUS_ALLOW_CONTACT_LEAD_DRY_RUN_DB:-}" = "true" ]; then echo "CONTACT_LEAD_DRY_RUN_ALLOWED"; else echo "CONTACT_LEAD_DRY_RUN_NOT_ALLOWED"; fi` | `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED` | Dry-run DB ContactLead non autorisé |

## Commandes runtime sûres

| Commande | Résultat | Statut |
| --- | --- | --- |
| `curl -sS -o /tmp/nexus-health-unauth-lot6.json -w "%{http_code}\\n" https://nexusreussite.academy/api/internal/health` | `401` | OK : endpoint protégé, pas de preuve Redis/Upstash |

## Commandes release candidate

| Commande | Résultat | Statut |
| --- | --- | --- |
| `git diff --name-only` | `130` fichiers suivis modifiés | OK |
| `git diff --stat` | `130 files changed, 3269 insertions(+), 1258 deletions(-)` | OK |
| `git diff --name-only \| rg 'rapport_audit_2_07_2026.md\|build-output.log\|test-results\|playwright-report\|\\.next\|node_modules' \|\| true` | aucune sortie | OK |
| `git ls-files --others --exclude-standard \| rg '(^\|/)\\.env($\|\\.)\|rapport_audit_2_07_2026.md\|build-output.log\|test-results\|playwright-report\|\\.next\|node_modules' \|\| true` | `rapport_audit_2_07_2026.md` | OK : à exclure |

## Gates finales

| Commande | Résultat | Statut |
| --- | --- | --- |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run typecheck` | `tsc --noEmit`, code `0` | OK |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run lint` | code `0`, warnings ESLint sous `--max-warnings 300` | OK |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run test:unit -- --runInBand` | `537` suites passées, `1` skipped, `6507` tests passés, `4` skipped | OK |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run build` | build Next.js code `0`, `142` pages générées, assets standalone copiés | OK |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node scripts/security/audit-api-guards.mjs` | `Wrote docs/security/API_GUARD_INVENTORY.md (178 routes)` | OK |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node scripts/go-live/generate-api-security-matrix.mjs` | `P0: 0, P1: 6, P2: 144, OK: 28` | OK |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run audit:site-map` | `Routes: 292; edges: 413; link findings: 0; public orphan entries: 13` | OK |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:no-hardcoded` | `OK: 0 hardcoded values outside canonical sources` | OK |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:docs-archive` | `OK: no historical audit/report files at docs/ root` | OK |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:bundle-weight` | toutes routes dans baseline + `5 kB` | OK |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | `24 passed` | OK |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium` | `1 passed` | OK |

## Commandes non exécutées

| Commande | Statut | Raison |
| --- | --- | --- |
| Healthcheck authentifié production avec `NEXUS_HEALTH_AUTH` | NON EXÉCUTÉ | `NEXUS_HEALTH_AUTH_ABSENT` |
| Test 429 runtime production/staging via `/api/internal/rate-limit-probe` | NON EXÉCUTÉ | `AUTH_ABSENT`, `RL_PROBE_NOT_ALLOWED` |
| ContactLead dry-run DB non production | NON EXÉCUTÉ | `DATABASE_URL_ABSENT`, `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED` |

## Limites

- Aucun secret lu ou affiché.
- Aucun `.env` modifié.
- Aucun déploiement.
- Aucune migration.
- Aucun test 429 production exécuté.
- Aucun dry-run ContactLead DB exécuté faute de `DATABASE_URL` et d'autorisation explicite.
