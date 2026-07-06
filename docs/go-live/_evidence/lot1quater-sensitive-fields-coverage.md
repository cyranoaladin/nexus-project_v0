# Lot 1-quater — Couverture champs sensibles

## Test global

Fichier : `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`.

## Couverture

| Route | Couvert globalement | Test dédié | Raison si non couvert |
| --- | --- | --- | --- |
| `/api/bilan-gratuit` | Oui | Oui | - |
| `/api/admin/invoices` | Oui | Oui | - |
| `/api/bilans/generate` | Oui | Oui | - |
| `/api/npc/submissions/[submissionId]/documents` | Oui | Oui | - |
| `/api/payments/clictopay/init` | Oui | Oui | - |
| `/api/payments/clictopay/webhook` | Oui | Oui | - |
| `/api/student/activate` | Oui | Oui | - |
| `/api/lamis/teacher-report` | Oui | Oui | - |
| `/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate` | Oui | Oui | - |
| `/api/parent/children` | Oui | Oui | - |
| `/api/stages/[stageSlug]/reservations/[reservationId]/confirm` | Oui | Oui | - |
| `/api/coach/trajectory` | Oui | Oui | - |
| `/api/assessments/submit` | Non | Partiel | Route publique sensible complexe ; couverte par validation/rate limit, no-leak global à ajouter après décision token/session |
| `/api/stages/[stageSlug]/inscrire` | Non | Oui partiel | Route publique avec emails/notifications ; test no-leak global à ajouter sans déclencher side effects mail/telegram |
| Routes admin P1 restantes | Non | Partiel | Hors priorité Lot 1-quater |

## Champs interdits

`password`, `activationToken`, `activationUrl`, `tokenHash`, `totpSecret`, `totpBackupCodes`, `localPath`, `filePath`, `pdfPath`, `originalFilePath`, `contextJson`, `llmJson`, `validatedJson`, `latexSource`, `stack`, `errorDetails`, `metadata`, `bankReference`, `rawWebhook`, `rawPayload`.

## Décision

La couverture globale s'élargit de 9 à 12 routes mockables. Elle reste insuffisante pour go-live large mais progresse sur les routes Lot 1-quater traitées.
