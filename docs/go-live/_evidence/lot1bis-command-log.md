# Lot 1-bis — Journal de commandes

Date locale : 2026-07-02 22:14:54 CET.

## État initial

- Branche : `feat/lot4-accessors-runtime`
- Commit court : `db8545a19`
- Runtime Node : `v20.20.0`
- npm : `10.8.2`
- État Git : worktree déjà modifié par Lots 0-bis/Lot 1, plus ajouts Lot 1-bis.

## Fichiers hérités déjà modifiés avant Lot 1-bis

Voir `git status --short` : documents go-live non suivis, inventaire API modifié, routes Lot 1 documents/factures/activation/Lamis/stages/automatismes, tests publics et Playwright issus des lots précédents.

## Commandes baseline

| Commande | Statut | Résultat |
| --- | --- | --- |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node -v` | OK | `v20.20.0` |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm -v` | OK | `10.8.2` |
| `git rev-parse --abbrev-ref HEAD` | OK | `feat/lot4-accessors-runtime` |
| `git rev-parse --short HEAD` | OK | `db8545a19` |
| `git status --short --untracked-files=all` | OK | worktree sale, aucun `.env` modifié |

## Commandes ciblées exécutées

| Commande | Statut | Résultat |
| --- | --- | --- |
| `npm run test:unit -- --runInBand __tests__/scripts/audit-api-guards.classification.test.ts` | ÉCHEC attendu puis OK | Rouge avant correction rate limit commentaire, vert après patch |
| `npm run test:unit -- --runInBand __tests__/api/sessions.video.route.test.ts` | ÉCHEC attendu puis OK | Rouge avant rate limit/Zod, vert après patch |
| `npm run test:unit -- --runInBand __tests__/api/bilan-gratuit.test.ts __tests__/api/bilan-gratuit.security.test.ts` | OK | 13 tests passés |
| `npm run test:unit -- --runInBand __tests__/api/payments.clictopay.init.route.test.ts __tests__/api/payments.clictopay.webhook.route.test.ts` | OK | 5 tests passés |
| `npm run test:unit -- --runInBand __tests__/api/student.activate.route.test.ts __tests__/api/security/no-sensitive-fields-in-api-responses.test.ts` | OK | 16 tests passés |
| `npm run test:unit -- --runInBand __tests__/api/npc.files.route.test.ts __tests__/api/npc.documents.route.test.ts` | OK | 15 tests passés |
| `npm run test:unit -- --runInBand __tests__/api/admin.documents.route.test.ts` | ÉCHEC attendu puis OK | Rouge avant validation/projection, vert après patch |
| `node scripts/security/audit-api-guards.mjs && node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=54`, `P2=95`, `OK=27` |

## Commandes finales complètes

Exécutées sous Node `v20.20.0`, finalisées le 2026-07-02 22:25:00 CET.

| Commande | Statut | Résultat |
| --- | --- | --- |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run typecheck` | ÉCHEC puis OK | Premier passage rouge après ajout de tests (`process.env.NODE_ENV` readonly, typage `safeErrorSummary`), corrigé. Passage final OK. |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run lint` | OK | Lint passé avec avertissements existants sous seuil. |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run test:unit -- --runInBand` | OK | 509 suites passées, 1 ignorée ; 6383 tests passés, 4 ignorés ; 7 snapshots passés. |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run build` | OK | Build Next.js réussi ; 143 pages statiques générées ; assets standalone copiés. |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node scripts/security/audit-api-guards.mjs` | OK | `docs/security/API_GUARD_INVENTORY.md` régénéré, 176 routes. |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=54`, `P2=95`, `OK=27`. |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run audit:site-map` | OK | 290 routes, 412 edges, 0 link finding, 13 public orphan entries ; docs architecture régénérées. |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:no-hardcoded` | OK | 0 hardcoded values outside canonical sources. |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:docs-archive` | OK | Aucun ancien audit/report à la racine de `docs/`. |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:bundle-weight` | OK | Toutes les routes contrôlées restent dans baseline + 5 kB. |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | OK | 24 tests passés. Avertissement runtime local : table `business_configs` absente pendant le refresh passif de config. |

## Limites

- Aucune valeur secrète lue ou affichée.
- Aucun fichier `.env` modifié.
- Aucune migration lancée.
- Rate limiting distribué production non vérifié localement : `À vérifier en production`.
- `/api/bilan-gratuit` reste à arbitrer produit/RGPD : création de comptes inactifs maintenue mais réponse API durcie.
- ClicToPay reste désactivé/non complet : routes maintenues en statut non actif.
