# Lot 2 — Couverture no-leak succès / erreur

Test global : `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`.

| Route | Success covered | Error covered | Dedicated test | Limite |
|---|---:|---:|---|---|
| `/api/payments/clictopay/webhook` | Oui, succès désactivé `501` | Oui | `payments.clictopay.webhook.*` | Pas de succès paiement actif tant que ClicToPay off |
| `/api/assessments/submit` | Oui | Oui | `assessments-submit` | Token signé court non implémenté |
| `/api/bilan-gratuit` | Oui | Oui | `bilan-gratuit.product-rgpd` | Route publique dépend du rate limit runtime |
| `/api/lamis/teacher-report` | Oui | Oui | `lamis.teacher-report` | Public anonyme assumé |
| `/api/stages/[stageSlug]/inscrire` | Oui | Oui | `stages.inscrire.product-rgpd` | Campagne large bloquée par Redis/Upstash non prouvé |
| `/api/student/activate` | Oui | Oui | `student.activate.lifecycle-security` | Route publique par token |

Champs interdits vérifiés : `password`, `activationToken`, `activationUrl`, `tokenHash`, `totpSecret`, `totpBackupCodes`, `localPath`, `filePath`, `pdfPath`, `originalFilePath`, `contextJson`, `llmJson`, `validatedJson`, `latexSource`, `stack`, `errorDetails`, `metadata`, `bankReference`, `rawWebhook`, `rawPayload`.
