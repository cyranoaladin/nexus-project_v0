# Lot 2 — Décision stage inscription

## Route

`/api/stages/[stageSlug]/inscrire`

## Décision

Route publique assumée, avec consentement explicite API.

## Changements Lot 2

- `stageTermsAccepted: true` requis.
- `dataProcessingAccepted: true` requis.
- Le formulaire public transmet les deux consentements.
- Les notes internes enregistrent uniquement les consentements oui/non, sans payload brut.

## Contrat

- Pas de création de compte.
- Pas de token d'activation.
- Pas d'ID interne en réponse.
- Déduplication email/stage sans exposer `reservationId`.
- Rate limit async.
- Zod strict.

## Tests

- `__tests__/api/stages.inscrire.product-rgpd.test.ts`
- `__tests__/api/stages.inscrire.security.test.ts`
- `__tests__/api/stages/inscriptions.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`

## Verdict

Décision produit/RGPD claire. Route encore P1 tant que Redis/Upstash runtime n'est pas prouvé pour campagne large.
