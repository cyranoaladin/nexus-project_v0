# Lot 4 — Journal token binding / runtime / rétention / paiement

Date locale initiale : 2026-07-03 13:05 CET.

## Baseline

- Répertoire : `/home/alaeddine/Bureau/nexus-project_v0`
- Branche : `feat/lot4-accessors-runtime`
- Commit court : `db8545a19`
- Node : `v20.20.0`
- npm : `10.8.2`
- État Git initial : worktree déjà très chargé par les lots précédents ; fichiers modifiés et non suivis hérités des Lots 0 à 3.
- Aucun fichier `.env` ne doit être lu, affiché ou modifié.
- Aucune migration destructive, aucun `prisma migrate dev`, aucun `prisma migrate reset`, aucun `prisma db push`.
- Aucun déploiement.

## P1 initiaux confirmés

Extrait de `docs/go-live/api-security-matrix.full.md` :

- `/api/payments/clictopay/webhook`
- `/api/assessments/submit`
- `/api/bilan-gratuit`
- `/api/lamis/teacher-report`
- `/api/stages/[stageSlug]/inscrire`
- `/api/student/activate`

Compteurs initiaux : `P0=0`, `P1=6`, `P2=144`, `OK=27`, total `177`.

## Commandes baseline exécutées

| Commande | Statut | Résultat |
| --- | --- | --- |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node -v` | OK | `v20.20.0` |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm -v` | OK | `10.8.2` |
| `git rev-parse --abbrev-ref HEAD` | OK | `feat/lot4-accessors-runtime` |
| `git rev-parse --short HEAD` | OK | `db8545a19` |
| `git status --short --untracked-files=all` | OK | Worktree dirty hérité ; aucun `.env` ne doit être touché |
| `rg -n "^\\| P1 \\|" docs/go-live/api-security-matrix.full.md` | OK | 6 P1 confirmés |

## Commandes ciblées

| Commande | Statut | Résultat |
| --- | --- | --- |
| `npm run test:unit -- --runInBand __tests__/api/assessments.public-token.binding.test.ts __tests__/api/assessments.submit.token-binding.test.ts __tests__/app/bilan-gratuit.assessment-page-token.test.tsx __tests__/scripts/contact-leads-retention.test.ts __tests__/lib/business-config.production-gate.test.ts __tests__/api/payments.clictopay.feature-flag-consistency.test.ts` | ÉCHEC attendu TDD | Premier passage rouge : helpers de binding absents, page assessment génère encore depuis query params, script purge absent, BusinessConfig fallback non discriminé, flag ClicToPay public retourne encore `501` |
| `npm run test:unit -- --runInBand __tests__/api/assessments.public-token.binding.test.ts __tests__/api/assessments.submit.token-binding.test.ts __tests__/app/bilan-gratuit.assessment-page-token.test.tsx __tests__/api/bilan-gratuit.product-rgpd.test.ts __tests__/scripts/contact-leads-retention.test.ts __tests__/lib/business-config.production-gate.test.ts __tests__/api/payments.clictopay.feature-flag-consistency.test.ts` | OK | `7` suites passées, `21` tests passés |
| `npm run test:unit -- --runInBand __tests__/api/assessments.public-token.binding.test.ts __tests__/api/assessments.submit.token-binding.test.ts __tests__/app/bilan-gratuit.assessment-page-token.test.tsx __tests__/api/bilan-gratuit.product-rgpd.test.ts __tests__/scripts/contact-leads-retention.test.ts __tests__/lib/business-config.production-gate.test.ts __tests__/api/payments.clictopay.feature-flag-consistency.test.ts __tests__/api/security/no-sensitive-fields-in-api-responses.test.ts __tests__/api/internal.business-config.health.test.ts __tests__/lib/business-config.fallback.test.ts __tests__/api/payments.clictopay.disabled-contract.test.ts` | OK | `11` suites passées, `53` tests passés |
| `npm run typecheck` | ÉCHEC puis OK | Premier passage : typage enum `Grade`, union discriminée BusinessConfig, type de raison token ; second passage OK |
| `npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium` | ÉCHEC ciblé avant rebuild | Playwright servait `.next/standalone` issu du build précédent ; snapshot montrait encore l'ancien flux. À relancer après `npm run build` |
| `npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium` | ÉCHEC ciblé après rebuild | La page refusait bien l'accès, mais l'email fourni en query apparaissait dans le HTML RSC via sérialisation de l'URL Next.js. Correction : redirection canonique vers `/bilan-gratuit/assessment` dès présence de query params |
| `npx tsx -e "...getRateLimitProductionGate..."` | OK | Local : `mode=memory`, `gate.ok=false`, `decision=blocked` |
| `if [ -n "${NEXUS_HEALTH_AUTH:-}" ]; then echo 'NEXUS_HEALTH_AUTH_PRESENT'; else echo 'NEXUS_HEALTH_AUTH_ABSENT'; fi` | OK | `NEXUS_HEALTH_AUTH_ABSENT` |
| `curl -sS -o /tmp/nexus-internal-health-lot4.txt -w "%{http_code}\n" https://nexusreussite.academy/api/internal/health` | PARTIEL | Production sans secret : `401`, Redis/Upstash non prouvé |

## Commandes finales

| Commande | Statut | Résultat |
| --- | --- | --- |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run typecheck` | OK | `tsc --noEmit` vert |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run lint` | OK | Warnings existants, pas d'échec |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run test:unit -- --runInBand` | OK | `536` suites passées, `1` skipped ; `6504` tests passés, `4` skipped |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run build` | OK | Build Next standalone vert, `build-output.log` mis à jour |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node scripts/security/audit-api-guards.mjs` | OK | `docs/security/API_GUARD_INVENTORY.md` régénéré, `177` routes |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=6`, `P2=144`, `OK=27`, total `177` |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run audit:site-map` | OK | `291` routes, `413` edges, `0` link findings, `13` public orphan entries |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:no-hardcoded` | OK | `0` hardcoded values outside canonical sources |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:docs-archive` | OK | No historical audit/report files at docs root |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run check:bundle-weight` | OK | Toutes les routes dans baseline + `5 kB`; `/bilan-gratuit/assessment` reconnue dynamique `ƒ`, `420 kB` |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | OK | `24` tests passés |
| `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium` | OK | `1` test passé |

## Vérifications finales de sûreté

- Aucun fichier `.env` modifié.
- Aucune migration destructive lancée.
- Aucun `prisma migrate dev`, `prisma migrate reset` ou `prisma db push`.
- Aucun secret lu ou affiché.
- Aucun déploiement.

## Limites initiales

- Redis/Upstash staging/production non prouvé au démarrage.
- `/api/internal/health` production nécessite une authentification ; aucun token/cookie ne sera affiché.
- ClicToPay doit rester désactivé.
- Le token assessment Lot 3 est court et signé, mais la page `/bilan-gratuit/assessment` doit être contre-auditée car elle ne doit pas générer un token valide depuis de simples query params publics.
- La politique ContactLead existe, mais le mécanisme opérationnel de purge/anonymisation n'existe pas encore.
