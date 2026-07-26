# PR #79 — CI evidence design

## Date

2026-07-26 (Africa/Tunis)

## Scope

This stacked change is a CI qualification aid for PR #79. It does not change
the Stage candidate, application code, campaign content, dependencies, release
status, or Bilan files. The stacked pull request targets
`release/pre-rentree-2026-public-ready`, remains Draft, and must not be merged
as part of this mission.

Baseline Stage candidate:

```text
d857160381b26b82ff52901cbdc8d8062975cbba
```

## Problem

The baseline workflow makes functional evidence jobs transitively depend on
`dependency-integrity`. The known development-dependency audit failure
therefore prevents lint, type checking, unit tests, integration tests, E2E,
security scanning, and the production build from executing.

The final status job also permits a cancelled E2E result. This is incompatible
with fail-closed release evidence: every required result must be exactly
`success`.

## Design

The evidence workflow uses independent root jobs:

```text
Dependency Integrity ─┐
Lint ─────────────────┤
TypeScript ───────────┤
Unit Tests ───────────┤
Integration Tests ────┤
Real DB Integration ──┤
E2E ──────────────────┤
Security Scan ────────┤
Production Build ─────┤
Documents ────────────┤
                      └→ CI Success
```

`dependency-integrity` remains unchanged and blocking. It keeps both production
and complete audits at `--audit-level=high`, without `continue-on-error` or an
error-masking shell construct.

`ci-success` runs with `always()`, declares every required job in `needs`, and
accepts only the literal result `success`. Failure, cancellation, skip, or an
empty/unrepresented result therefore fails the aggregator.

The pull-request trigger includes the PR #79 source branch as a base so the
stacked evidence pull request actually runs the workflow.

## PostgreSQL boundary

The baseline no-database reproduction produced four failed suites and sixteen
failed tests:

| Suite | DB-dependent failures | Protected Bilan territory | Evidence job |
| --- | ---: | --- | --- |
| `__tests__/integration/activate-student.real.test.ts` | 2 | No | Included |
| `__tests__/integration/predict-ownership.real.test.ts` | 5 | No | Included |
| `__tests__/security/idor-real.test.ts` | 3 | No | Included |
| `__tests__/lib/bilan/bilan-schema.real.test.ts` | 6 of 9 assertions | Yes | Excluded |

The dedicated PostgreSQL job runs the three non-protected suites (10 tests)
against an ephemeral `pgvector/pgvector:pg16` service after
`prisma migrate deploy`. It uses only fixed test credentials and no production
secret. GitHub destroys the service with the runner.

The general integration job also excludes the protected Bilan test directory
from this mission while continuing to execute the non-protected integration and
security suites.

## Documents boundary

The `documents` job verifies the seven already-frozen public PDFs. It does not
regenerate or rewrite campaign content. The separate full document-generation
workflow remains intact.

## Rollback

The complete change can be rolled back by closing the unmerged stacked Draft PR
and deleting its isolated branch after owner approval. PR #79 and its Stage SHA
remain unchanged.
