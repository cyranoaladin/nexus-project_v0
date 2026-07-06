# Lot 1-bis — Vérification sécurité API

## Verdict

ACCEPTÉ AVEC RÉSERVES.

## Résumé exécutif

Le contre-audit confirme que `P0=0` tient après durcissement du script d’audit. Le Lot 1-bis a identifié et corrigé un faux signal potentiel dans la détection rate limit, fermé deux P1 (`/api/sessions/video`, `/api/admin/documents`), sécurisé davantage `/api/bilan-gratuit`, renforcé NPC et ajouté un test global de non-exposition de champs sensibles.

La plateforme n’est pas go-live large : 54 P1 restent ouverts, ClicToPay reste désactivé, le rate limiting distribué production n’est pas prouvé et `/api/bilan-gratuit` crée encore des comptes inactifs sans décision produit/RGPD définitive.

## Requalifications P0 vérifiées

- Documents/factures : vérifiées par code + tests IDOR/no-leak.
- Staff-only admin/assistante : reclassification acceptable en P2/P1, pas OK.
- Routes publiques fixes : P2 seulement.
- ClicToPay 501 : P1 maintenu.
- Public sensible Zod + rate limit : P1, pas OK.

## Requalifications P0 refusées ou insuffisamment prouvées

Aucune route n’a été remise en P0 par le script après durcissement. En revanche, plusieurs requalifications restent insuffisantes pour go-live large et demeurent P1 : `/api/assessments/submit`, `/api/bilan-gratuit`, `/api/admin/invoices`, `/api/bilans*`, ClicToPay, routes coach generate/regenerate, NPC documents.

## P1 traités

Voir `docs/go-live/_evidence/lot1bis-p1-closure.md`.

## P1 fermés

- `/api/sessions/video`
- `/api/admin/documents`

## P1 restants

54 P1 restent dans `docs/go-live/api-security-matrix.full.md`.

## Corrections code appliquées

- `scripts/security/audit-api-guards.mjs` : détection rate limit stricte.
- `scripts/go-live/generate-api-security-matrix.mjs` : même détection stricte.
- `app/api/sessions/video/route.ts` : Zod strict, rate limit, projection DB.
- `app/api/bilan-gratuit/route.ts` : réponse neutre, pas d’énumération email, pas d’IDs, payload public strict.
- `app/api/student/activate/route.ts` : 400 validation sans détails `password`.
- `app/api/admin/documents/route.ts` : MIME/taille, Zod userId, projection sans `localPath`.

## Tests ajoutés

- `__tests__/scripts/audit-api-guards.classification.test.ts`
- `__tests__/api/bilan-gratuit.security.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`
- `__tests__/api/admin.documents.route.test.ts`

## Tests modifiés

- `__tests__/api/bilan-gratuit.test.ts`
- `__tests__/api/student.activate.route.test.ts`
- `__tests__/api/sessions.video.route.test.ts`
- `__tests__/api/npc.files.route.test.ts`
- `__tests__/api/npc.documents.route.test.ts`
- `__tests__/api/payments.clictopay.webhook.route.test.ts`

## Script audit-api-guards

Testé par fixtures synthétiques. Le script ne classe plus un commentaire `rateLimit` comme contrôle effectif. Une route dynamique sensible sans ownership reste P0. ClicToPay 501 reste P1.

## Rate limiting

Code/test OK localement. Production distribuée non prouvée : réserve bloquante go-live large.

## ClicToPay

`init` et `webhook` restent non actifs. Webhook signé valide retourne encore 501. Aucune activation entitlement par webhook.

## Bilan gratuit

État actuel sécurisé côté API : pas d’énumération email, pas d’IDs en réponse, pas de token brut. Dette produit/RGPD maintenue : création de comptes inactifs à trancher Lot 3.

## Documents / NPC / fichiers

Documents admin et NPC renforcés par tests. Aucun `localPath/filePath` attendu en réponse testée. Les routes NPC documents restent P1 faute de Zod complet.

## Sessions / coach / parent / élève

`/api/sessions/video` corrigée en P2. Les routes coach report ont des tests d’ownership existants mais plusieurs mutations generate/regenerate restent P1.

## Matrice API avant/après

| Source | P0 | P1 | P2 | OK |
| --- | ---: | ---: | ---: | ---: |
| Lot 1 | 0 | 56 | 93 | 27 |
| Lot 1-bis | 0 | 54 | 95 | 27 |

## Commandes exécutées

Toutes les commandes finales obligatoires ont été exécutées sous Node `v20.20.0`.

| Commande | Statut | Résultat |
| --- | --- | --- |
| `npm run typecheck` | ÉCHEC puis OK | Échec initial lié aux tests ajoutés, corrigé ; passage final OK. |
| `npm run lint` | OK | Lint passé avec avertissements existants sous seuil. |
| `npm run test:unit -- --runInBand` | OK | 509 suites passées, 1 ignorée ; 6383 tests passés, 4 ignorés. |
| `npm run build` | OK | Build Next.js réussi, 143 pages statiques générées. |
| `node scripts/security/audit-api-guards.mjs` | OK | Inventaire régénéré, 176 routes. |
| `node scripts/go-live/generate-api-security-matrix.mjs` | OK | `P0=0`, `P1=54`, `P2=95`, `OK=27`. |
| `npm run audit:site-map` | OK | 290 routes, 412 edges, 0 link finding. |
| `npm run check:no-hardcoded` | OK | 0 valeur hardcodée hors sources canoniques. |
| `npm run check:docs-archive` | OK | Aucun audit historique à la racine de `docs/`. |
| `npm run check:bundle-weight` | OK | Toutes les routes contrôlées sous baseline + 5 kB. |
| `npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | OK | 24 tests passés ; avertissement local `business_configs` absent à vérifier hors smoke. |

## Commandes échouées

Le premier `npm run typecheck` a échoué pendant le développement Lot 1-bis après ajout des tests. L’échec a été corrigé puis la commande finale est passée. Aucune commande finale obligatoire ne reste en échec.

## Décisions

- Bêta contrôlée : autorisable avec réserves, périmètre limité, ClicToPay désactivé, monitoring manuel.
- Bêta élargie : non autorisée tant que P1 critiques paiement/factures/bilans/documents restent ouverts.
- Go-live large : non autorisé.
