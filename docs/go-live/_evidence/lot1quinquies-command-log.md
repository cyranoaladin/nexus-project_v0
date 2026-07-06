# Lot 1-quinquies — Journal de commandes

Date locale initiale : 2026-07-03 06:48:44 CET.

## Baseline

- Branche : `feat/lot4-accessors-runtime`
- Commit court : `db8545a19`
- Node : `v20.20.0`
- npm : `10.8.2`
- Répertoire : `/home/alaeddine/Bureau/nexus-project_v0`
- État Git initial : worktree déjà chargé par les lots 0-bis, 1, 1-bis, 1-ter et 1-quater ; nombreux fichiers modifiés/non suivis hérités. Aucun fichier `.env` listé comme modifié.
- Périmètre P1 initial extrait de `docs/go-live/api-security-matrix.full.md` : `P0=0`, `P1=12`, `P2=137`, `OK=27`, total 176 routes.

## Commandes baseline exécutées

| Commande | Statut | Résultat |
| --- | --- | --- |
| `pwd` | OK | `/home/alaeddine/Bureau/nexus-project_v0` |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node -v` | OK | `v20.20.0` |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm -v` | OK | `10.8.2` |
| `git rev-parse --abbrev-ref HEAD` | OK | `feat/lot4-accessors-runtime` |
| `git rev-parse --short HEAD` | OK | `db8545a19` |
| `git status --short --untracked-files=all` | OK | Worktree dirty hérité ; aucun `.env` listé comme modifié |

## Commandes ciblées

| Commande | Statut | Résultat |
| --- | --- | --- |
| `npm run test:unit -- __tests__/api/payments.clictopay.webhook.security.test.ts __tests__/api/admin.config.route.test.ts __tests__/api/admin.directeur.stats.route.test.ts __tests__/api/admin.recompute-ssn.route.test.ts __tests__/api/admin.subscriptions.route.test.ts __tests__/api/admin.test-email.route.test.ts --runInBand` | ÉCHEC puis OK | RED initial : 10 échecs attendus ; après corrections : 46 tests passés |
| `npm run test:unit -- __tests__/api/security/no-sensitive-fields-in-api-responses.test.ts __tests__/api/assessments-submit.test.ts __tests__/api/student.activate.route.test.ts __tests__/api/stages.inscrire.security.test.ts __tests__/api/payments.clictopay.webhook.route.test.ts __tests__/api/payments.clictopay.webhook.security.test.ts __tests__/api/admin.config.route.test.ts __tests__/api/admin.directeur.stats.route.test.ts __tests__/api/admin.recompute-ssn.route.test.ts __tests__/api/admin.subscriptions.route.test.ts __tests__/api/admin.test-email.route.test.ts --runInBand` | OK | 11 suites passées, 96 tests passés |
| `npm run test:unit -- __tests__/api/admin.directeur.stats.route.test.ts __tests__/api/admin.recompute-ssn.route.test.ts __tests__/api/security/no-sensitive-fields-in-api-responses.test.ts --runInBand` | OK | 3 suites passées, 37 tests passés |
| `npm run typecheck` | OK | `tsc --noEmit` OK après correction du typage `admin/test-email` |
| `node scripts/security/audit-api-guards.mjs` | OK | `docs/security/API_GUARD_INVENTORY.md` régénéré, 176 routes |
| `node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=6`, `P2=143`, `OK=27` |
| `curl -sS -i --max-time 10 https://nexusreussite.academy/api/internal/health` | PARTIEL | Production répond `401 Unauthorized` sans secret ; mode Redis/Upstash non prouvé |
| `npx tsx -e "import { getRateLimitProductionGate } from './lib/rate-limit/index.ts'; console.log(JSON.stringify(getRateLimitProductionGate()))"` | OK | Local : `memory`, décision `blocked` |
| `node -e "const { getRateLimitProductionGate } = require('./dist-does-not-exist')"` | ÉCHEC | Commande exploratoire erronée, module inexistant ; aucun effet produit |

## Commandes finales

| Commande | Statut | Résultat |
| --- | --- | --- |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run typecheck` | OK | `tsc --noEmit` terminé sans erreur |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run lint` | OK | ESLint terminé avec avertissements sous le seuil configuré |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run test:unit -- --runInBand` | OK | 517 suites passées, 1 ignorée ; 6449 tests passés, 4 ignorés |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run build` | OK | Build Next.js réussi ; 143 pages statiques générées |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node scripts/security/audit-api-guards.mjs` | OK | `docs/security/API_GUARD_INVENTORY.md` régénéré, 176 routes |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=6`, `P2=143`, `OK=27`, 176 routes |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run audit:site-map` | OK | Cartes d'architecture régénérées ; 290 routes, 412 edges, 0 link findings, 13 public orphan entries |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:no-hardcoded` | OK | `0 hardcoded values outside canonical sources` |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:docs-archive` | OK | Aucun rapport historique à la racine de `docs/` |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:bundle-weight` | OK | Toutes les routes suivies restent dans la baseline + 5 kB |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | OK | 24 tests Playwright passés |

## Commandes échouées

| Commande | Statut | Résultat |
| --- | --- | --- |
| `npm run test:unit -- --runInBand` | ÉCHEC puis OK | Premier passage final : 4 échecs dans `__tests__/api/assessments-rbac.test.ts` dus à des attentes obsolètes après durcissement `requireRole`; test corrigé puis suite complète verte |
| `node -e "const { getRateLimitProductionGate } = require('./dist-does-not-exist')"` | ÉCHEC | Commande exploratoire erronée, module inexistant ; aucun effet produit |

## Résultat final matrice

- `P0=0`
- `P1=6`
- `P2=143`
- `OK=27`
- Total : 176 routes

## Limites initiales

- Aucun secret lu.
- Aucun `.env` modifié.
- Aucun déploiement.
- Aucune migration destructive.
- Accès production limité à une requête HTTP non authentifiée sur `/api/internal/health`, sans secret ; résultat `401`, runtime distribué non prouvé.
- Le build charge les fichiers d'environnement Next.js disponibles sans afficher leurs valeurs ; aucune valeur secrète n'a été lue ni copiée.
