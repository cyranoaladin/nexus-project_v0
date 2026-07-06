# Lot 2 — Journal de commandes

Date locale initiale : 2026-07-03 07:41:49 CET.

## Baseline

- Répertoire : `/home/alaeddine/Bureau/nexus-project_v0`
- Branche : `feat/lot4-accessors-runtime`
- Commit court : `db8545a19`
- Node : `v20.20.0`
- npm : `10.8.2`
- État Git initial : worktree déjà chargé par les lots précédents ; aucun fichier `.env` listé comme modifié.
- P1 initiaux extraits de `docs/go-live/api-security-matrix.full.md` : 6 routes.

## P1 initiaux

- `/api/payments/clictopay/webhook`
- `/api/assessments/submit`
- `/api/bilan-gratuit`
- `/api/lamis/teacher-report`
- `/api/stages/[stageSlug]/inscrire`
- `/api/student/activate`

## Commandes baseline exécutées

| Commande | Statut | Résultat |
| --- | --- | --- |
| `node -v` sous Node 20 | OK | `v20.20.0` |
| `npm -v` sous Node 20 | OK | `10.8.2` |
| `git rev-parse --abbrev-ref HEAD` | OK | `feat/lot4-accessors-runtime` |
| `git rev-parse --short HEAD` | OK | `db8545a19` |
| `git status --short --untracked-files=all` | OK | Worktree dirty hérité ; aucun `.env` modifié |
| `rg -n "^\\| P1 \\|" docs/go-live/api-security-matrix.full.md` | OK | 6 P1 confirmés |

## Commandes ciblées

| Commande | Statut | Résultat |
| --- | --- | --- |
| Tests Lot 2 initiaux | ÉCHEC puis OK | RED : `bilan-gratuit` créait encore des comptes ; stage consent non accepté par API. Après correction : 5 suites, 12 tests passés |
| Tests routes impactées | OK | 16 suites, 99 tests passés |
| `npx tsx -e "import { getRateLimitProductionGate } ..."` | OK | Local `memory`, décision `blocked` |
| `curl -sS -i --max-time 10 https://nexusreussite.academy/api/internal/health` | PARTIEL | Production répond `401 Unauthorized`; Redis/Upstash non prouvé |

## Commandes finales

| Commande | Statut | Résultat |
| --- | --- | --- |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run typecheck` | ÉCHEC puis OK | Premier échec TypeScript sur le type UI des consentements stage (`boolean` vs `true`) ; corrigé par `Omit<...>` dans `StageInscriptionForm`. Relance OK |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run lint` | OK | `next lint --max-warnings 300` OK, warnings existants |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run test:unit -- --runInBand` | OK | 522 suites passées, 1 ignorée ; 6466 tests passés, 4 ignorés |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run build` | OK | Next build OK ; 143 pages statiques générées ; assets standalone copiés |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node scripts/security/audit-api-guards.mjs` | OK | `docs/security/API_GUARD_INVENTORY.md` régénéré, 176 routes |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=6`, `P2=143`, `OK=27` |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run audit:site-map` | OK | Routes 290 ; edges 412 ; link findings 0 ; public orphan entries 13 |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:no-hardcoded` | OK | 0 valeur hardcodée hors sources canoniques |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:docs-archive` | OK | Aucun audit/report historique au root docs |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:bundle-weight` | OK | Toutes les routes suivies dans baseline + 5 kB |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | OK | 24 tests passés |

Commande non retenue comme gate mais exécutée par erreur de saisie : `source /home/alaeddine/.nvm/nvm use 20.20.0 >/dev/null && npm run check:bundle-weight` a échoué car le chemin `nvm` était invalide. La commande correcte a été relancée et est OK.

## Limites

- Aucun secret lu.
- Aucun `.env` modifié.
- Aucun déploiement.
- Aucune migration destructive.
- Healthcheck production authentifié non accessible sans credential ; mode Redis/Upstash production non prouvé.
- Le smoke Playwright public affiche un warning webserver préexistant : table locale `public.business_configs` absente lors du refresh passif. Les tests publics passent néanmoins.
