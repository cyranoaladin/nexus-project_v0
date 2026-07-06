# Lot 1-ter — Coach reports

## Routes traitées

| Route | Après | Preuve |
| --- | --- | --- |
| `/api/coach/students/[studentId]/generated-reports/[reportId]/generate` | P2 | Réexport de regenerate couvert par test params |
| `/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate` | P2 | Params Zod, no-leak test |
| `/api/coach/students/[studentId]/eaf-preparation-report/validate` | P2 | Param Zod, test avant assignment |
| `/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale` | P2 | Param/body Zod, tests GET/PATCH |
| `/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate` | P2 | Param Zod, test avant assignment |

## Tests

- `__tests__/api/coach.generated-reports.route.test.ts`
- `__tests__/api/coach.eaf-preparation-report.validate.test.ts`
- `__tests__/api/coach.eaf-stage-regenerate.security.test.ts`
- `__tests__/api/coach.bilan-diagnostic-maths-terminale.security.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`

## P1 coach restants

- `/api/coach/students/[studentId]/notes`
- `/api/coach/students/[studentId]/survival-mode`
- `/api/coach/trajectory`
- `/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-parent`
- `/api/coach/maths-premiere-stage-printemps/students/[studentId]/regenerate-student`

## Décision

Les routes coach reports traitées sont acceptables pour bêta contrôlée. Les P1 coach restants doivent être traités avant bêta élargie.
