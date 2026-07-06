# Lot 1-bis — Fermeture P1 critiques

## Synthèse

Après correction et régénération :

- Lot 1 : `P0=0`, `P1=56`, `P2=93`, `OK=27`.
- Lot 1-bis : `P0=0`, `P1=54`, `P2=95`, `OK=27`.

Deux P1 ont été fermés en P2 : `/api/sessions/video` et `/api/admin/documents`.

## P1 traités

| Route | Avant | Après | Traitement | Test |
| --- | --- | --- | --- | --- |
| `/api/sessions/video` | P1 | P2 | Zod strict, rate limit async, projection DB explicite, rejet champs inattendus | `__tests__/api/sessions.video.route.test.ts` |
| `/api/admin/documents` | P1 | P2 | MIME/taille, Zod `userId`, projection sans `localPath`, pas d’écriture fichier invalide | `__tests__/api/admin.documents.route.test.ts` |
| `/api/bilan-gratuit` | P1 | P1 | Réponse neutre, pas d’énumération email, pas d’IDs, payload public strict sans `parentPassword` | `__tests__/api/bilan-gratuit.security.test.ts` |
| `/api/payments/clictopay/init` | P1 | P1 | Maintenue 501 non configurée | `__tests__/api/payments.clictopay.init.route.test.ts` |
| `/api/payments/clictopay/webhook` | P1 | P1 | Signature invalide 401 si secret ; signature valide reste 501 | `__tests__/api/payments.clictopay.webhook.route.test.ts` |
| `/api/npc/files/[...path]` | P2 | P2 | Test coach non assigné sans lecture disque ajouté | `__tests__/api/npc.files.route.test.ts` |
| `/api/npc/submissions/[submissionId]/documents*` | P1 | P1 | Tests coach non assigné GET/POST/DELETE ajoutés ; reste P1 faute de Zod complet | `__tests__/api/npc.documents.route.test.ts` |
| `/api/student/activate` | P1 | P1 | 400 public sans `details.password` | `__tests__/api/student.activate.route.test.ts`, `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts` |
| `/api/lamis/teacher-report` | P1 | P1 | Déjà durcie Lot 1 ; couverte par non-exposition globale | `__tests__/api/lamis.teacher-report.route.test.ts` |
| `/api/assessments/submit` | P1 | P1 | Revue : Zod + rate limit présents, mais réponse et modèle public à traiter séparément | À créer Lot suivant |
| `/api/admin/invoices` | P1 | P1 | Revue : staff-only, mais schéma/projection GET/POST insuffisants pour fermeture | À créer Lot suivant |
| `/api/bilans*` | P1 | P1 | Revue : ownership helpers présents, mais mutations/exports sans Zod complet | À créer Lot suivant |
| routes coach generated reports | P1 | P1 | Revue : assignment détecté, mais routes generate/regenerate restent P1 | Tests existants partiels |
| `/api/sessions/cancel` | P1 | P1 | Revue : Zod via `parseBody`, rate limit facade, ownership tests existants ; script reste P1 par heuristique | `__tests__/api/sessions.cancel.route.test.ts` |

## P1 fermés

- `/api/sessions/video`
- `/api/admin/documents`

## P1 requalifiés

Aucune route paiement ou ClicToPay n’a été requalifiée en OK. Les routes 501 restent P1.

## P1 restants

54 P1 restent ouverts. Les plus critiques sont :

- `/api/payments/clictopay/init`
- `/api/payments/clictopay/webhook`
- `/api/admin/invoices`
- `/api/assessments/submit`
- `/api/bilan-gratuit`
- `/api/bilans`, `/api/bilans/[id]`, `/api/bilans/[id]/export`
- routes coach generate/regenerate report
- `/api/npc/submissions/[submissionId]/documents*`
- `/api/assistante/quotes/pdf`

## Tests associés

- `__tests__/scripts/audit-api-guards.classification.test.ts`
- `__tests__/api/admin.documents.route.test.ts`
- `__tests__/api/bilan-gratuit.security.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`
- `__tests__/api/sessions.video.route.test.ts`
- `__tests__/api/npc.files.route.test.ts`
- `__tests__/api/npc.documents.route.test.ts`
- tests Lot 1 existants documents/factures/activation/Lamis.

## Risques résiduels

La baisse P1 est réelle mais limitée. Les P1 restants touchent paiement, facturation, bilans, documents NPC, reports coach et flux public bilan gratuit. Ils interdisent bêta élargie et go-live large.
