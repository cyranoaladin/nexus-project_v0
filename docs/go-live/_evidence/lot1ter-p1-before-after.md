# Lot 1-ter — P1 avant / après

Date locale : 2026-07-02.

## Synthèse

| Priorité | Avant Lot 1-ter | Après Lot 1-ter | Delta |
| --- | ---: | ---: | ---: |
| P0 | 0 | 0 | 0 |
| P1 | 54 | 37 | -17 |
| P2 | 95 | 112 | +17 |
| OK | 27 | 27 | 0 |
| Total | 176 | 176 | 0 |

Sources :

- Avant : état confirmé Lot 1-bis dans `docs/go-live/12_LOT1BIS_SECURITY_VERIFICATION.md`.
- Après : `node scripts/security/audit-api-guards.mjs` puis `node scripts/go-live/generate-api-security-matrix.mjs`.

## P1 fermés

| Route | Avant | Après | Preuve |
| --- | --- | --- | --- |
| `/api/admin/invoices` | P1 | P2 | Zod GET/POST, pagination bornée, projection explicite, tests admin invoices |
| `/api/payments/clictopay/init` | P1 | P2 | Zod, rôles explicites, `501` conservé, tests ClicToPay init |
| `/api/sessions/cancel` | P1 | P2 | Body Zod strict |
| `/api/bilans` | P1 | P2 | Query/body Zod, tests bilans IDOR |
| `/api/bilans/[id]` | P1 | P2 | Param/body Zod, tests ownership |
| `/api/bilans/[id]/export` | P1 | P2 | Param/query/body Zod, tests audience/export |
| `/api/bilans/generate` | P1 | P2 | Body/query Zod, test refus avant DB |
| `/api/npc/submissions` | P1 | P2 | Body/query Zod, tests refus unsafe |
| `/api/npc/submissions/[submissionId]/documents` | P1 | P2 | Params Zod, tests traversal |
| `/api/npc/submissions/[submissionId]/documents/[documentId]` | P1 | P2 | Params/body Zod, tests documentId unsafe |
| `/api/npc/submissions/[submissionId]/generate` | P1 | P2 | Params Zod, tests refus avant DB |
| `/api/npc/uploads` | P1 | P2 | Metadata Zod, tests MIME/metadata |
| `/api/coach/students/[studentId]/generated-reports/[reportId]/generate` | P1 | P2 | Réexport regenerate, params testés |
| `/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate` | P1 | P2 | Params Zod, tests no-leak |
| `/api/coach/students/[studentId]/eaf-preparation-report/validate` | P1 | P2 | Params Zod, test avant assignment |
| `/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale` | P1 | P2 | Params/body Zod, tests GET/PATCH |
| `/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate` | P1 | P2 | Params Zod, test avant assignment |

## P1 restants structurants

- `/api/payments/clictopay/webhook` reste P1/501 par décision de sécurité.
- `/api/assessments/submit`, `/api/bilan-gratuit`, `/api/stages/[stageSlug]/inscrire`, `/api/student/activate` restent publics sensibles.
- `/api/assistante/quotes/pdf` reste P1 document.
- Routes assistante/parent/student/coach restantes requièrent durcissement rate limit, Zod ou qualification rôle/ownership.

## Décision

Le delta est réel et provient de corrections de code/tests, pas d'une modification du script d'audit. La bêta élargie reste interdite avec 37 P1.
