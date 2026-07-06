# Lot 1-ter — Journal de commandes

Date locale : 2026-07-02 22:42:22 CET.

## État initial

- Branche : `feat/lot4-accessors-runtime`
- Commit court : `db8545a19`
- Runtime Node : `v20.20.0`
- npm : `10.8.2`
- État Git : worktree déjà modifié par Lots 0-bis, 1 et 1-bis ; aucun fichier `.env` listé comme modifié.

## Fichiers hérités des lots précédents

Le `git status --short --untracked-files=all` initial montre notamment :

- routes documents/factures/activation/Lamis/stages/automatismes modifiées par Lot 1 ;
- `app/layout.tsx`, `components/marketing/PaymentMethodsNote.tsx`, tests Playwright publics modifiés par Lot 0-bis ;
- `docs/go-live/**`, `docs/security/API_GUARD_INVENTORY.md`, `scripts/go-live/generate-api-security-matrix.mjs` issus des lots de baseline ;
- tests Lot 1-bis ajoutés : `audit-api-guards.classification`, `bilan-gratuit.security`, `no-sensitive-fields-in-api-responses`, `admin.documents`.

## Commandes baseline

| Commande | Statut | Résultat |
| --- | --- | --- |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node -v` | OK | `v20.20.0` |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm -v` | OK | `10.8.2` |
| `git rev-parse --abbrev-ref HEAD` | OK | `feat/lot4-accessors-runtime` |
| `git rev-parse --short HEAD` | OK | `db8545a19` |
| `git status --short --untracked-files=all` | OK | worktree sale hérité ; aucun `.env` modifié |

## Commandes ciblées

| Commande | Statut | Résultat |
| --- | --- | --- |
| `npm run test:unit -- --runInBand __tests__/api/admin.invoices.route.test.ts __tests__/api/payments.clictopay.init.route.test.ts __tests__/api/npc.documents.route.test.ts __tests__/api/npc.submissions.security.test.ts __tests__/api/npc.generate.test.ts __tests__/api/npc.uploads.route.test.ts __tests__/api/bilans.id.route.test.ts __tests__/api/bilans.idor.test.ts __tests__/api/bilans/generate.test.ts __tests__/api/coach.generated-reports.route.test.ts __tests__/api/coach.eaf-preparation-report.validate.test.ts __tests__/api/coach.eaf-stage-regenerate.security.test.ts __tests__/api/coach.bilan-diagnostic-maths-terminale.security.test.ts __tests__/api/security/no-sensitive-fields-in-api-responses.test.ts` | OK | 14 suites passées, 94 tests passés |
| `npm run test:unit -- --runInBand __tests__/api/bilans/crud.test.ts __tests__/api/sessions.cancel.route.test.ts` | OK après correction | 2 suites passées, 14 tests passés ; correction du fixture CUID `sessions/cancel` et du message sobre `Données invalides` pour `POST /api/bilans` |
| `node scripts/security/audit-api-guards.mjs` | OK | `docs/security/API_GUARD_INVENTORY.md` régénéré, 176 routes |
| `node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=37`, `P2=112`, `OK=27` |
| `npm run typecheck` | PARTIEL puis OK | Échec initial sur types `app/api/bilans/route.ts`, corrigé ; relances OK avant commandes finales |

## Commandes finales

| Commande | Statut | Résultat |
| --- | --- | --- |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run typecheck` | OK | `tsc --noEmit` OK |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run lint` | OK | Next lint OK avec warnings existants sous `--max-warnings 300` |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run test:unit -- --runInBand` | OK après correction | Premier run : 2 suites échouées (`bilans/crud`, `sessions.cancel`) ; correction appliquée ; relance complète : 512 suites passées, 1 ignorée, 6411 tests passés, 4 ignorés |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run build` | OK | Build Next OK, 143 pages générées, assets standalone copiés |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node scripts/security/audit-api-guards.mjs` | OK | `docs/security/API_GUARD_INVENTORY.md` régénéré, 176 routes |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=37`, `P2=112`, `OK=27` |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run audit:site-map` | OK | 290 routes, 412 edges, 0 link finding, 13 public orphan entries |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:no-hardcoded` | OK | 0 hardcoded values outside canonical sources |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:docs-archive` | OK | no historical audit/report files at docs root |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:bundle-weight` | OK | all routes within baseline + 5 kB |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | OK | 24 tests passés |

## Limites

- Aucune valeur secrète lue ou affichée.
- Aucun fichier `.env` modifié.
- Aucune migration lancée.
- ClicToPay reste non actif ; le webhook doit rester P1/501 tant que l’intégration complète n’existe pas.
- Rate limiting distribué production non vérifié localement : `À vérifier en production`.
- `/api/bilan-gratuit` reste une dette produit/RGPD tant que la création de comptes inactifs n’est pas arbitrée.
