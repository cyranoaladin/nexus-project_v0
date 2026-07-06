# Lot 1-quater — Coach

## Routes traitées

| Route | Avant | Après | Preuve |
| --- | --- | --- | --- |
| `/api/coach/students/[studentId]/notes` | P1 | P2 | Params/body Zod strict, assignment conservé |
| `/api/coach/students/[studentId]/survival-mode` | P1 | P2 | Params/body Zod strict, assignment conservé |
| `/api/coach/trajectory` | P1 | P2 | Body Zod strict + refus coach non assigné |
| `/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent` | P1 | P2 | Params Zod strict |
| `/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student` | P1 | P2 | Params Zod strict |

## Tests

- `__tests__/api/coach.trajectory.security.test.ts`
- Tests coach reports hérités Lot 1-ter
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`

## Réserves

Les routes coach passent P2 statique, mais un audit E2E rôle coach reste requis avant bêta élargie.
