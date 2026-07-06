# Lot 1-quater — Stages

## Routes traitées

| Route | Avant | Après | Preuve |
| --- | --- | --- | --- |
| `/api/stages/[stageSlug]/inscrire` | P1 | P1 | Param `stageSlug` Zod, body Zod et rate limit déjà présents ; reste public sensible |
| `/api/stages/[stageSlug]/reservations/[reservationId]/confirm` | P1 | P2 | Params Zod avant DB, staff-only conservé, test invalid params |

## Tests

- `__tests__/api/stages/confirm.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`

## Réserves

L'inscription stage publique reste P1 car elle collecte des données mineur/famille. Elle doit rester sous rate limit distribué prouvé avant campagne large.
