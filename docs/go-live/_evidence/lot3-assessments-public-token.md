# Lot 3 — Assessment public token

## Décision

`POST /api/assessments/submit` exige désormais un token signé court pour les soumissions publiques.

## Implémentation

- Helper : `lib/assessments/public-token.ts`
- Route d'émission contrôlée staff-only : `app/api/assessments/public-token/route.ts`
- Page publique : `app/bilan-gratuit/assessment/page.tsx`
- Client assessment : `app/bilan-gratuit/assessment/AssessmentClient.tsx`
- Runner : `components/assessments/AssessmentRunner.tsx`
- Route protégée : `app/api/assessments/submit/route.ts`

## Contrat sécurité

- Signature HMAC.
- TTL court par défaut : 15 minutes.
- Scope : `usage=assessment_submit`, `subject`, `grade`, `source`, `campaignId` optionnel.
- Aucun token brut stocké.
- Pas de fallback insecure en production : un secret runtime est obligatoire.
- Le token est envoyé par header `x-assessment-public-token` ou `Authorization: Bearer`.
- Token absent, expiré, mal signé ou mal formé : `401`.
- Scope, subject ou grade mismatch : `403`.

## Tests

- `__tests__/lib/assessments/public-token.test.ts`
- `__tests__/api/assessments.public-token.route.test.ts`
- `__tests__/api/assessments.submit.token-security.test.ts`
- `__tests__/api/assessments-submit.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`

Résultat ciblé : inclus dans le pack Lot 3, `14` suites passées, `99` tests passés.

## Réserve

La route `/api/assessments/submit` reste P1 dans la matrice car elle reste une surface publique sensible manipulant des données pédagogiques mineur. Le risque d'accès public ouvert est réduit par token court, mais la décision produit finale token/session/auth reste à confirmer avant bêta élargie.
