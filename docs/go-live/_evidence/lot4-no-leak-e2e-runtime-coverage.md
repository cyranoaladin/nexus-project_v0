# Lot 4 — No-leak et E2E runtime coverage

## No-leak unitaire

`__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts` couvre désormais le chemin succès `assessments/submit` avec token lead-bound et email assessment pseudonyme.

Champs interdits couverts : `password`, `activationToken`, `activationUrl`, `tokenHash`, `totpSecret`, `totpBackupCodes`, `localPath`, `pdfPath`, `filePath`, `originalFilePath`, `contextJson`, `llmJson`, `validatedJson`, `latexSource`, `stack`, `errorDetails`, `metadata`, `bankReference`, `rawWebhook`, `rawPayload`.

## E2E assessment

Nouveau test : `e2e/pages-public-bilan-assessment-token.spec.ts`.

Objectif :

- accès direct `/bilan-gratuit/assessment?subject=...&grade=...&email=...` refusé sans cookie de flux ;
- aucun token dans l'URL ;
- aucun token dans le HTML initial ;
- email de query non réaffiché.

## Résultat actuel

Résultat final après rebuild standalone :

- `npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium` : OK, `1` test passé.
- Accès direct avec query params publics refusé.
- URL canonique nettoyée.
- Aucun token assessment dans URL/HTML.
- L'email fourni en query n'apparaît plus dans le HTML initial.

Incident traité pendant Lot 4 : un lancement après rebuild a montré que Next.js sérialisait la query dans le HTML RSC même si la page ne l'utilisait pas. Correction appliquée : redirection serveur immédiate vers `/bilan-gratuit/assessment` si des query params sont présents.

## Limite

Le chemin E2E complet lead submission -> cookie -> assessment n'est pas exécuté contre DB réelle dans ce lot pour éviter dépendance runtime DB/staging. Il est couvert en tests API/server-component mockés.
