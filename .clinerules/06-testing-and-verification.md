# Testing and Verification

## Minimum checks after meaningful changes

Run relevant commands, not necessarily the full suite every time:

- `npx prisma validate`
- `npx prisma generate`
- `npm run typecheck`
- targeted Jest tests
- `npm run build` before deployment-sensitive changes

## Required tests for generated reports

- completeness checks;
- checksum stability;
- no duplicate job creation;
- coach RBAC;
- validation route refuses incomplete reports;
- client cannot force `VALIDATED` through draft save route;
- LaTeX escaping;
- PDF compile failure handled cleanly;
- Mistral key missing handled cleanly;
- timeout handled cleanly if implemented.

## Test reporting

Always report:
- exact command;
- result;
- if failed, whether failure is related to the current change;
- next recommended command.

## If tests fail

Do not hide failures.
Classify:
- related regression;
- pre-existing debt;
- environment issue;
- missing dependency.

Provide evidence.

## Before production-sensitive changes

At minimum:
- `npx prisma validate`
- `npx prisma generate`
- `npm run typecheck`
- relevant unit/API tests
- build if the affected area is Next.js runtime-sensitive
