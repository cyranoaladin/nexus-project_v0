# Lot 4 — Assessment token binding

## Problème confirmé

Avant Lot 4, `/bilan-gratuit/assessment` pouvait générer un token `assessment_submit` depuis des `searchParams` publics. Ce token était court et signé, mais ne prouvait ni lead qualifié, ni session, ni invitation.

## Décision

Option B retenue : session/cookie de flux signé.

## Contrat implémenté

- `/api/bilan-gratuit` crée/met à jour le lead CRM puis pose un cookie HttpOnly `nexus_assessment_flow`.
- Le cookie contient un token signé court `assessment_flow`.
- Le payload inclut `subject`, `grade`, `source=bilan-gratuit`, `leadEmailHash`, `issuedAt`, `expiresAt`, `nonce`.
- Aucun email brut dans le token de flux.
- `/bilan-gratuit/assessment` ne génère plus de token depuis l'URL.
- `/bilan-gratuit/assessment?...` redirige vers `/bilan-gratuit/assessment` avant rendu pour éviter la sérialisation RSC de PII en query.
- Sans cookie valide, la page affiche un refus sobre.
- Avec cookie valide, la page émet un token `assessment_submit` lié au `leadEmailHash`.
- Le submit vérifie le token et l'email assessment pseudonyme.

## Tests

- `__tests__/api/assessments.public-token.binding.test.ts`
- `__tests__/api/assessments.submit.token-binding.test.ts`
- `__tests__/app/bilan-gratuit.assessment-page-token.test.tsx`
- `__tests__/api/bilan-gratuit.product-rgpd.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`
- `e2e/pages-public-bilan-assessment-token.spec.ts`

## Résultat ciblé

Pack unitaire ciblé : `11` suites passées, `53` tests passés.

## Résultat E2E

`npx playwright test e2e/pages-public-bilan-assessment-token.spec.ts --project=chromium` : OK, `1` test passé après rebuild final.

## Limite

Le chemin complet lead submission -> cookie -> assessment n'est pas exécuté en E2E contre une DB réelle dans ce lot pour éviter une dépendance staging/production. Il est couvert par tests API/server-component mockés et par E2E du refus direct sans contexte.
