# Lot 1-quinquies — Couverture champs sensibles

Test global : `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`.

Le test couvre désormais 20 réponses mockables, dont les 12 P1 de départ ou leurs réponses d'erreur/validation.

| Route | Couvert globalement | Test dédié | Raison si non couvert |
| --- | --- | --- | --- |
| `/api/payments/clictopay/webhook` | Oui | Oui | N/A |
| `/api/assessments/submit` | Oui | Oui | N/A |
| `/api/bilan-gratuit` | Oui | Oui | N/A |
| `/api/lamis/teacher-report` | Oui | Oui | N/A |
| `/api/stages/[stageSlug]/inscrire` | Oui | Oui | N/A |
| `/api/student/activate` | Oui | Oui | N/A |
| `/api/admin/config` | Oui | Oui | N/A |
| `/api/admin/config/rollback` | Oui | Oui | N/A |
| `/api/admin/directeur/stats` | Oui | Oui | N/A |
| `/api/admin/recompute-ssn` | Oui | Oui | N/A |
| `/api/admin/subscriptions` | Oui | Oui | N/A |
| `/api/admin/test-email` | Oui | Oui | N/A |

Champs interdits vérifiés : `password`, `activationToken`, `activationUrl`, `tokenHash`, `totpSecret`, `totpBackupCodes`, `localPath`, `filePath`, `pdfPath`, `originalFilePath`, `contextJson`, `llmJson`, `validatedJson`, `latexSource`, `stack`, `errorDetails`, `metadata`, `bankReference`, `rawWebhook`, `rawPayload`.
