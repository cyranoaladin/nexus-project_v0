# PR #79 — CI DAG after evidence change

## Independent jobs

The following jobs have no job-level `needs`, so GitHub schedules each one even
when Dependency Integrity fails:

```text
dependency-integrity
lint
typecheck
unit
integration
real-db-integration
e2e
security
build
documents
```

`integration` executes the non-protected integration/security suite set and
excludes `__tests__/lib/bilan/`. `real-db-integration` separately executes the
three explicitly allowlisted real-PostgreSQL suites.

## Strict aggregation

`ci-success` declares all ten jobs above in `needs` and uses:

```yaml
if: ${{ always() }}
```

Its status loop receives one `job:result` pair for every declared requirement.
Any value other than `success`, including an empty value, `failure`,
`cancelled`, or `skipped`, sets the final failure flag. There is no E2E
cancellation exception.

Dependency Integrity is still one of those ten mandatory results and retains:

```bash
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
```

The evidence workflow therefore exposes independent failures without turning
the known dependency failure into a warning or an accepted risk.

## Pull-request trigger

The CI workflow runs for pull requests targeting either:

```text
main
release/pre-rentree-2026-public-ready
```

This allows the stacked Draft PR to collect evidence without changing PR #79.
