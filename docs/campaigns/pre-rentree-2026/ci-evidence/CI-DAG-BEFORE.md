# PR #79 — CI DAG before evidence change

## Baseline

```text
PR #79 head: d857160381b26b82ff52901cbdc8d8062975cbba
Observed run: 30200981173
Observed CI Success job: 89790822426
```

## Current dependency graph

| Job | `needs` | Job-level `if` | Consequence when Dependency Integrity fails |
| --- | --- | --- | --- |
| Dependency Integrity | none | default | Executes and fails on the complete npm audit |
| Lint | Dependency Integrity | default | Skipped |
| TypeScript Type Check | Dependency Integrity | default | Skipped |
| Unit Tests | Lint, TypeScript | default | Skipped transitively |
| Integration Tests | Lint, TypeScript | default | Skipped transitively |
| E2E Tests | Lint, TypeScript | default | Skipped transitively |
| Security Scan | Dependency Integrity | default | Skipped |
| Production Build | Lint, TypeScript | default | Skipped transitively |
| CI Success | all jobs above | `always() && !cancelled()` | Executes, reports the cascade, and fails |

The workflow has no dedicated real-database evidence job and no document job
represented in `CI Success`.

## Static cause

GitHub applies the implicit job condition `success()` to jobs with `needs`.
When `dependency-integrity` fails, its direct dependants do not start. Jobs
depending on those skipped jobs also do not start. This leaves no independent
functional evidence for the candidate.

The final aggregator has a second fail-open defect for release evidence: it
explicitly treats `E2E Tests=cancelled` as acceptable.

## Baseline PostgreSQL reproduction

With no `DATABASE_URL`, the integration command produced:

```text
Test Suites: 4 failed, 7 passed, 11 total
Tests:       16 failed, 109 passed, 125 total
```

Six failures belong to
`__tests__/lib/bilan/bilan-schema.real.test.ts`, which is protected and will
not be executed by the new evidence job. The remaining three suites contain ten
non-protected tests and form the allowed PostgreSQL evidence scope.
