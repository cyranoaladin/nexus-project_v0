# Lot 8 — Journal release candidate cleanup

## Baseline

- Date locale : 2026-07-03 15:51:19 CET
- Branche : `feat/lot4-accessors-runtime`
- Commit court : `db8545a19`
- Node : `v20.20.0`
- npm : `10.8.2`
- Diff `.env` : aucun chemin détecté.

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
- Diff stat : `130 files changed, 3269 insertions(+), 1258 deletions(-)`
- Fichiers non suivis initiaux : `146`
- P1 visibles : `6`

## État après création des artefacts Lot 8

- Entrées `git status --short --untracked-files=all` : `283`
- Fichiers suivis modifiés : `130`
- Fichiers non suivis : `153`
- Manifeste propre : `docs/go-live/_evidence/lot8-release-candidate-file-manifest-clean.md`
- Plan de commits propre : `docs/go-live/_evidence/lot8-release-candidate-commit-plan-clean.md`
- Include RC : `281`
- Exclude : `1`
- Needs human review : `1`

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

Statut : preuves runtime non exécutées et blocage maintenu.

## Gates finales

| Commande | Statut | Résultat |
| --- | --- | --- |
| `npm run typecheck` | OK | `tsc --noEmit` sans erreur |
| `npm run lint` | OK | Commande terminée avec code `0`; warnings existants dans le seuil configuré |
| `npm run test:unit -- --runInBand` | OK | `538` suites passées sur `539`, `1` skipped ; `6516` tests passés sur `6520`, `4` skipped |
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
- Worktree : `283` entrées classées par le manifeste Lot 8.
- Tests classés comme artefacts générés : aucun cas détecté.

## Limites

- Aucun secret lu.
- Aucun `.env` modifié.
- Aucun commit.
- Aucune PR.
- Aucune preuve Redis/Upstash staging/production.
- Aucun test `429` runtime staging/production.
- Aucun dry-run DB ContactLead non production.
