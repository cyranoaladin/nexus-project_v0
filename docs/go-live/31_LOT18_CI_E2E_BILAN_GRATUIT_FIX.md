# Lot 18 — Correction CI E2E bilan gratuit

## Date

2026-07-07.

## Contexte

La PR GitHub `#58` est une draft sur la branche `feat/lot4-accessors-runtime`.

Le check GitHub `E2E Tests` echouait sur le fichier CI `e2e/real/pages/04-bilan-gratuit.spec.ts`, test `Soumission complète — crée parent + élève en DB`.

Le rapport Playwright montrait que l'API publique `/api/bilan-gratuit` retournait le contrat securise attendu :

```json
{
  "success": true,
  "message": "Votre demande a bien été enregistrée. Notre équipe vous recontactera pour la suite."
}
```

Le test attendait encore `parentId` et `studentId`, ce qui contredit la decision RGPD/securite Lot 2-3 : une API publique ne doit pas exposer d'identifiants internes parent/eleve.

## Correction

Le test E2E a ete aligne sur le contrat public :

- `success === true`.
- `message` present.
- absence de `parentId`.
- absence de `studentId`.
- absence de `token`.
- absence de `assessmentToken`.
- absence de `leadEmailHash`.
- regression anti-leak via recherche globale sur le JSON.
- verification de la redirection vers `/bilan-gratuit/confirmation`.
- verification du H1 de confirmation.

## Decision securite

Ne pas modifier l'API publique pour reintroduire `parentId` ou `studentId`.

La verification de persistance reste cote serveur/test integration. Le test unitaire `__tests__/api/bilan-gratuit.product-rgpd.test.ts` confirme :

- creation CRM lead-only ;
- aucune creation de compte parent/eleve inactive ;
- cookie assessment HttpOnly ;
- aucun token ou ID interne dans le JSON public.

## Verifications locales

- `npm run typecheck` : PASSED.
- `npm run lint` : PASSED avec warnings existants sous seuil.
- `npm run test:unit -- --runInBand __tests__/api/bilan-gratuit.product-rgpd.test.ts` : PASSED, 8 tests.
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium --reporter=line` : PASSED, 1 test.
- `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:3012 npx playwright test e2e/04-bilan-gratuit.spec.ts --project=chromium --reporter=line` : FAILED, `No tests found`, car ce chemin n'existe pas dans le repo.
- `NEXTAUTH_URL=http://127.0.0.1:3012 REUSE_EXISTING_SERVER=true npx playwright test --config=playwright.ci.config.ts e2e/real/pages/04-bilan-gratuit.spec.ts --project=chromium --reporter=line` : 6 passed, 1 failed localement car la DB E2E `127.0.0.1:5435` est absente. L'echec n'est plus l'assertion `parentId/studentId`.

## Limite locale

Aucune migration n'a ete lancee et aucune DB n'a ete creee. Le run local complet du test de soumission reste dependant d'une DB E2E disponible, comme en CI GitHub.

## Decisions

- `READY_FOR_PR_RECHECK`.
- `BETA_CONTROLEE_ALLOWED_WITH_RESERVES`.
- `BETA_ELARGIE_BLOCKED`.
- `GO_LIVE_LARGE_BLOCKED`.
