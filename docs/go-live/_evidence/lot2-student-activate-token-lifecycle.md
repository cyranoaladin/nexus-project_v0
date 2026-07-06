# Lot 2 — Student activation token lifecycle

## Route

`/api/student/activate`

## Décision

Route publique par token assumée.

## Preuves code

- Le token brut est hashé SHA-256 avant lookup.
- Les recherches imposent expiration future.
- Les comptes déjà activés sont exclus.
- Après activation, `activationToken` et `activationExpiry` sont remis à `null`.
- GET et POST sont rate-limited.
- Réponses sobres.

## Tests

- `__tests__/api/student.activate.lifecycle-security.test.ts`
- `__tests__/api/student.activate.route.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`

## Verdict

Cycle token défendable pour bêta contrôlée. La route reste P1 par nature publique et doit être surveillée en production.
