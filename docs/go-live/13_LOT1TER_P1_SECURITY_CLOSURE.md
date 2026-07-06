# Lot 1-ter — Fermeture P1 critiques

Date locale : 2026-07-02 22:57:38 CET.

## Verdict

ACCEPTÉ AVEC RÉSERVES.

## Synthèse

Lot 1-ter a réduit les P1 critiques API de `54` à `37` sans modifier le script d'audit pour masquer des risques. Les P0 restent à `0`.

| Priorité | Avant Lot 1-ter | Après Lot 1-ter |
| --- | ---: | ---: |
| P0 | 0 | 0 |
| P1 | 54 | 37 |
| P2 | 95 | 112 |
| OK | 27 | 27 |
| Total | 176 | 176 |

La baisse correspond à des corrections de code sur validation Zod, projections, rôles explicites, refus de paramètres dangereux et tests ciblés. ClicToPay reste non actif : `init` est durci et reste `501`, `webhook` reste P1/501.

## Routes corrigées

- `/api/admin/invoices` : filtres GET bornés, body POST strict, staff-only explicite, projection sans `include` large.
- `/api/payments/clictopay/init` : rôles autorisés explicites, Zod strict, retour `501` non ambigu.
- `/api/bilans`, `/api/bilans/[id]`, `/api/bilans/[id]/export`, `/api/bilans/generate` : params/body/query Zod stricts, refus avant DB.
- `/api/npc/submissions`, `/api/npc/submissions/[submissionId]/documents`, `/api/npc/submissions/[submissionId]/documents/[documentId]`, `/api/npc/submissions/[submissionId]/generate`, `/api/npc/uploads` : params et metadata stricts, refus traversal avant DB/fichier.
- `/api/sessions/cancel` : body Zod strict.
- Routes coach reports : `generated-reports/[reportId]/generate`, `generated-reports/[reportId]/regenerate`, `eaf-preparation-report/validate`, `bilan-diagnostic-maths-terminale`, `eaf-stage-printemps/.../regenerate`.

## Routes encore P1

P1 restants principaux :

- Paiement : `/api/payments/clictopay/webhook`.
- Public sensible : `/api/assessments/submit`, `/api/bilan-gratuit`, `/api/bilan-gratuit/dismiss`, `/api/lamis/teacher-report`, `/api/stages/[stageSlug]/inscrire`, `/api/student/activate`.
- Documents : `/api/assistante/quotes/pdf`.
- Coach/élève : notes, survival-mode, trajectory, routes maths-premiere-stage-printemps.
- Assistante/parent/student : crédits, subscriptions, children, automatismes, survival, trajectory.
- Admin : config, rollback, stats directeur, recompute SSN, subscriptions, test-email.

## Paiements / ClicToPay

- `init` reste désactivée par `501 CLICTOPAY_NOT_CONFIGURED`, avec validation stricte et refus des rôles non autorisés.
- `webhook` reste désactivée par `501`; aucune activation de paiement, facture, entitlement ou crédit n'est acceptée.
- `payments/validate` n'a pas été refondu dans ce lot ; il reste couvert par les tests hérités et doit être consolidé en Lot paiement/entitlements.

## Factures / invoices

`/api/admin/invoices` passe P2 grâce à la validation stricte, aux filtres bornés et à une projection explicite. Les routes `/api/admin/invoices/[id]`, `/send`, `/api/invoices/[id]/pdf` et `/receipt/pdf` restent P2 depuis les lots précédents, avec tests ownership/no-leak hérités.

## Assessments

`/api/assessments/submit` reste P1 : route publique sensible avec données pédagogiques mineur. Elle a Zod et rate limit, mais son mode public/token/session doit être arbitrée avant bêta élargie.

## Bilans

Les routes `Bilan` critiques traitées passent P2. Le correctif a aussi évité qu'une absence de filtre `isPublished` soit interprétée comme `false` dans `GET /api/bilans`.

## NPC documents / fichiers

Les routes NPC traitées refusent les identifiants dangereux avant accès DB/fichier, valident metadata/upload, et ne renvoient pas de chemin local dans les réponses testées.

## Coach reports

Les routes coach reports traitées valident `studentId`/`reportId` avant ownership et ne renvoient pas les champs internes `contextJson`, `llmJson`, `validatedJson`, `latexSource` dans les tests ciblés.

## Bilan gratuit

`/api/bilan-gratuit` n'a pas été refondu dans Lot 1-ter. L'état durci Lot 1-bis reste : pas d'énumération email, pas d'ID/token en réponse, rate limit et no-leak testés. La dette produit/RGPD demeure : la route crée encore des comptes inactifs alors que la promesse marketing est un bilan gratuit.

## Champs sensibles / no-leak

Le test global `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts` couvre désormais 9 routes mockables : bilan gratuit, activation élève, ClicToPay init/webhook, admin invoices, bilans generate, NPC documents, coach generated report regenerate, Lamis teacher report.

## Tests ajoutés / modifiés

Tests Lot 1-ter ciblés passés : 14 suites, 94 tests.

Commandes finales passées sous Node 20 :

- `npm run typecheck`
- `npm run lint`
- `npm run test:unit -- --runInBand` : 512 suites passées, 1 ignorée ; 6411 tests passés, 4 ignorés.
- `npm run build` : 143 pages générées.
- `node scripts/security/audit-api-guards.mjs`
- `node scripts/go-live/generate-api-security-matrix.mjs` : `P0=0`, `P1=37`, `P2=112`, `OK=27`.
- `npm run audit:site-map`
- `npm run check:no-hardcoded`
- `npm run check:docs-archive`
- `npm run check:bundle-weight`
- Smoke Playwright public ciblé : 24 tests passés.

## Risques résiduels

- Rate limiting distribué production non prouvé.
- ClicToPay webhook P1/501.
- `/api/bilan-gratuit` reste ambigu produit/RGPD.
- 37 P1 restent à traiter avant bêta élargie.
- Les tests no-leak restent mockés : ils ne remplacent pas un audit dynamique production/staging.

## Décision bêta contrôlée

Autorisable seulement en périmètre limité, sans paiement carte, sans promesse go-live large, avec monitoring manuel et comptes test maîtrisés.

## Décision bêta élargie

Non autorisée tant que les P1 publics/paiement/documents restants et le rate limiting distribué production ne sont pas clos.

## Décision go-live large

Interdit.

## Prochain lot recommandé

Lot 1-quater : fermer les P1 publics/stages/assistante/parent/student restants et prouver le rate limiting distribué en environnement production ou staging.
