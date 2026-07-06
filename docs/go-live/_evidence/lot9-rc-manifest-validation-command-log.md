# Lot 9 — Journal validation manifeste RC

## Baseline

- Date locale : 2026-07-03 16:12:02 CET
- Branche : `feat/lot4-accessors-runtime`
- Commit court : `db8545a19`
- Node : `v20.20.0`
- npm : `10.8.2`
- Diff `.env` : aucune sortie.

## Commandes baseline exécutées

```bash
source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node -v
source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm -v
git rev-parse --abbrev-ref HEAD
git rev-parse --short HEAD
git status --short --untracked-files=all
git diff --name-only
git diff --stat
git ls-files --others --exclude-standard
git diff --name-only | rg '(^|/)\\.env($|\\.)' || true
```

## État initial observé

- Fichiers suivis modifiés : `130`
- Fichiers non suivis avant artefacts Lot 9 : `153`
- Entrées `git status --short --untracked-files=all` après ajout du test Lot 9 : `284`
- Entrées `git status --short --untracked-files=all` après création des preuves Lot 9 : `290`
- Diff stat suivi : `130 files changed, 3269 insertions(+), 1258 deletions(-)`
- P1 visibles : `6`

## Test ciblé Lot 9

Commande :

```bash
source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run test:unit -- --runInBand __tests__/scripts/security-audit-scripts-regression.test.ts __tests__/scripts/release-candidate-manifest-consistency.test.ts
```

Résultat : `OK`, `2` suites passées, `14` tests passés.

Note TDD : un premier run RED a échoué car le parseur initial comptait la table finale d'exclusion du plan de commits comme appartenant au dernier commit, et parce que la liste attendue P1 était volontairement incomplète. Le test a ensuite été corrigé pour ne collecter que les sections de commits numérotées et verrouiller les 6 P1.

## Runtime assisté

```bash
if [ -n "${NEXUS_HEALTH_AUTH:-}" ]; then echo "NEXUS_HEALTH_AUTH_PRESENT"; else echo "NEXUS_HEALTH_AUTH_ABSENT"; fi
if [ "${NEXUS_ALLOW_RATE_LIMIT_PROD_PROBE:-}" = "true" ]; then echo "RL_PROBE_ALLOWED"; else echo "RL_PROBE_NOT_ALLOWED"; fi
if [ -n "${DATABASE_URL:-}" ]; then echo "DATABASE_URL_PRESENT"; else echo "DATABASE_URL_ABSENT"; fi
if [ "${NEXUS_ALLOW_CONTACT_LEAD_DRY_RUN_DB:-}" = "true" ]; then echo "CONTACT_LEAD_DRY_RUN_ALLOWED"; else echo "CONTACT_LEAD_DRY_RUN_NOT_ALLOWED"; fi
```

Résultat :

- `NEXUS_HEALTH_AUTH_ABSENT`
- `RL_PROBE_NOT_ALLOWED`
- `DATABASE_URL_ABSENT`
- `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED`

## Limites

- Aucun secret lu.
- Aucun `.env` modifié.
- Aucun commit.
- Aucune PR.
- Aucune preuve Redis/Upstash staging/production.
- Aucun test `429` runtime staging/production.
- Aucun dry-run DB ContactLead non production.

## Gates finales

| Commande | Statut | Résultat |
| --- | --- | --- |
| `npm run typecheck` | OK | `tsc --noEmit` sans erreur |
| `npm run lint` | OK | Commande terminée avec code `0`; warnings existants dans le seuil configuré |
| `npm run test:unit -- --runInBand` | OK | `539` suites passées sur `540`, `1` skipped ; `6521` tests passés sur `6525`, `4` skipped |
| `npm run build` | OK | Build Next.js terminé ; `142` pages statiques générées ; assets standalone copiés |
| `node scripts/security/audit-api-guards.mjs` | OK | `178` routes écrites dans `docs/security/API_GUARD_INVENTORY.md` |
| `node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=6`, `P2=144`, `OK=28` |
| `npm run audit:site-map` | OK | `292` routes, `413` edges, `0` link finding, `13` orphan entries |
| `npm run check:no-hardcoded` | OK | `0` hardcoded values outside canonical sources |
| `npm run check:docs-archive` | OK | Aucun audit/report historique à la racine `docs/` |
| `npm run check:bundle-weight` | OK | Toutes les routes dans baseline + `5 kB` |
| `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | OK | `24` tests passés |
| `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium` | OK | `1` test passé |

## Vérifications post-gates

- Matrice API : `P0=0`, `P1=6`, `P2=144`, `OK=28`.
- P1 visibles : `/api/payments/clictopay/webhook`, `/api/assessments/submit`, `/api/bilan-gratuit`, `/api/lamis/teacher-report`, `/api/stages/[stageSlug]/inscrire`, `/api/student/activate`.
- Diff `.env` : aucune sortie.
- Aucun commit.
- Aucune PR.

## Revalidation demandée

- Date locale : 2026-07-03 16:28:39 CET
- Node : `v20.20.0`
- npm : `10.8.2`
- Branche : `feat/lot4-accessors-runtime`
- Commit court : `db8545a19`
- Entrées `git status --short --untracked-files=all` : `290`
- Diff `.env` : aucune sortie.

Résultats revalidés :

| Commande | Statut | Résultat |
| --- | --- | --- |
| `npm run test:unit -- --runInBand __tests__/scripts/security-audit-scripts-regression.test.ts __tests__/scripts/release-candidate-manifest-consistency.test.ts` | OK | `2` suites passées, `14` tests passés |
| `npm run typecheck` | OK | `tsc --noEmit` sans erreur |
| `npm run lint` | OK | Commande terminée avec code `0`; warnings existants dans le seuil configuré |
| `npm run test:unit -- --runInBand` | OK | `539` suites passées sur `540`, `1` skipped ; `6521` tests passés sur `6525`, `4` skipped |
| `npm run build` | OK | Build Next.js terminé ; `142` pages statiques générées ; assets standalone copiés |
| `node scripts/security/audit-api-guards.mjs` | OK | `178` routes écrites dans `docs/security/API_GUARD_INVENTORY.md` |
| `node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=6`, `P2=144`, `OK=28` |
| `npm run audit:site-map` | OK | `292` routes, `413` edges, `0` link finding, `13` orphan entries |
| `npm run check:no-hardcoded` | OK | `0` hardcoded values outside canonical sources |
| `npm run check:docs-archive` | OK | Aucun audit/report historique à la racine `docs/` |
| `npm run check:bundle-weight` | OK | Toutes les routes dans baseline + `5 kB` |
| `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | OK | `24` tests passés |
| `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium` | OK | `1` test passé |

Commande échouée puis corrigée :

```bash
source /home/alaeddine/.nvm/nvm use 20.20.0 >/dev/null && npm run lint
```

Résultat : `ÉCHEC` par faute de frappe locale (`/home/alaeddine/.nvm/nvm` au lieu de `nvm.sh`). La commande correcte a été relancée immédiatement et a terminé `OK`.
