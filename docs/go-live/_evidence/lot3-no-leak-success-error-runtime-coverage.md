# Lot 3 — No-leak succès/erreurs runtime coverage

## Synthèse

Le test no-leak couvre les chemins succès et erreurs principaux des routes sensibles mockables, avec ajout du succès assessment sous token court.

| Route | Success covered | Error covered | Mocked | Limite |
|---|---:|---:|---:|---|
| `/api/assessments/submit` | Oui | Oui | Oui | Succès mock Prisma/scoring ; route exige maintenant token court |
| `/api/bilan-gratuit` | Oui | Oui | Oui | Lead CRM mocké, pas de DB réelle |
| `/api/stages/[stageSlug]/inscrire` | Oui | Oui | Oui | Prisma stage/reservation mocké |
| `/api/student/activate` | Oui | Oui | Oui | Service activation mocké |
| `/api/payments/clictopay/init` | Oui, disabled `501` | Oui | Oui | Paiement carte non actif |
| `/api/payments/clictopay/webhook` | Oui, disabled `501` | Oui | Oui | Aucun succès paiement actif |
| `/api/lamis/teacher-report` | Oui | Oui | Oui | Route publique anonyme/minimisée |

## Champs interdits couverts

`password`, `activationToken`, `activationUrl`, `tokenHash`, `totpSecret`, `totpBackupCodes`, `localPath`, `pdfPath`, `filePath`, `originalFilePath`, `contextJson`, `llmJson`, `validatedJson`, `latexSource`, `stack`, `errorDetails`, `metadata`, `bankReference`, `rawWebhook`, `rawPayload`.

## Tests

- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`

Résultat ciblé Lot 3 : inclus dans `14` suites passées, `99` tests passés.
