# Lot 1-ter — Couverture champs sensibles

## Test global

Fichier : `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`.

## Champs interdits vérifiés

`password`, `activationToken`, `activationUrl`, `tokenHash`, `totpSecret`, `totpBackupCodes`, `localPath`, `filePath`, `pdfPath`, `originalFilePath`, `contextJson`, `llmJson`, `validatedJson`, `latexSource`, `stack`, `errorDetails`, `metadata`, `bankReference`, `rawWebhook`, `rawPayload`.

## Routes couvertes

| Route | Couverture |
| --- | --- |
| `/api/bilan-gratuit` | Réponse succès minimale |
| `/api/student/activate` | Validation token/password minimale |
| `/api/payments/clictopay/init` | `501` minimal |
| `/api/payments/clictopay/webhook` | `501` minimal |
| `/api/admin/invoices` | Validation payload minimale |
| `/api/bilans/generate` | Validation `bilanId` minimale |
| `/api/npc/submissions/[submissionId]/documents` | Validation param minimale |
| `/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate` | Validation params minimale |
| `/api/lamis/teacher-report` | Validation payload minimale |

## Non couvert ou partiel

- PDF facture/reçu : couvert par tests dédiés hérités, pas par ce test global.
- Exports bilans complets : partiellement couverts par tests bilans, pas par ce test global.
- Routes assistante/parent/student P1 restantes : non couvertes par le test global.
- Logs runtime : non couverts dynamiquement en production.

## Décision

La couverture no-leak s'est élargie, mais elle reste insuffisante pour go-live large. Elle est acceptable pour réduire le risque sur les routes Lot 1-ter traitées.
