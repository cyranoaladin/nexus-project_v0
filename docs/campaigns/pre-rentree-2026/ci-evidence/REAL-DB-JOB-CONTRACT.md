# PR #79 — real database job contract

## Database

- Ephemeral service: `pgvector/pgvector:pg16`
- Database: `nexus_ci_evidence`
- User/password: fixed CI-only credentials
- Health check: `pg_isready`
- Schema setup: existing migrations through `npx prisma migrate deploy`
- Forbidden operations: `prisma db push`, production seed, production
  credentials, persistent volumes
- Lifecycle: scoped to the GitHub-hosted runner and destroyed automatically

## Test scope

The job executes only these existing, non-protected suites:

```text
__tests__/integration/activate-student.real.test.ts       2 tests
__tests__/integration/predict-ownership.real.test.ts      5 tests
__tests__/security/idor-real.test.ts                       3 tests
```

Expected total: 3 suites / 10 tests.

The fourth locally reproduced suite,
`__tests__/lib/bilan/bilan-schema.real.test.ts` (6 tests), is explicitly
excluded because it belongs to protected Bilan territory. No Bilan test or
fixture is modified or executed by the dedicated job.

## Fixtures and data

The selected tests create synthetic users, parent/student relationships,
coaching assignments, stages, bookings, and Stage bilan links. They clean their
own records before and after execution. No production data or personally
identifying information is used.

## Runtime contract

- Timeout: 15 minutes
- Node/npm: repository-pinned CI versions
- Prisma Client: generated from the unchanged schema
- Authentication values: fixed test-only values
- Logs: ordinary test output; no production secret is available to the job
- Success: all three suites and all ten tests pass after migrations
- Failure: migration, connectivity, cleanup, assertion, or timeout failure
  fails the required job and therefore `CI Success`
