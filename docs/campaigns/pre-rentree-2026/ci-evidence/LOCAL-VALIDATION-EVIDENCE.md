# PR #79 — local CI evidence

## Baseline reproduction

Without `DATABASE_URL`:

```text
Test Suites: 4 failed, 7 passed, 11 total
Tests:       16 failed, 109 passed, 125 total
```

The four failed suites were three non-protected real-database suites (10
failures) plus the protected Bilan suite (6 database-dependent failures).

Running the general integration command with the corrected direct Jest filter
proved that the protected suite was not selected:

```text
Test Suites: 3 failed, 7 passed, 10 total
Tests:       10 failed, 106 passed, 116 total
```

The remaining failures were exclusively the expected missing-database failures.

## Ephemeral PostgreSQL

Local parity validation used an isolated `pgvector/pgvector:pg16` container on
a task-specific port:

```text
51 existing migrations applied successfully
Test Suites: 3 passed, 3 total
Tests:       10 passed, 10 total
```

The task-specific container was removed after the command. No persistent volume,
production credential, seed, or real data was used.

## Workflow contract

```text
Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
```

The test parses `.github/workflows/ci.yml` as YAML and verifies independent
jobs, strict aggregation, the unchanged audit commands, the PostgreSQL
allowlist, Bilan exclusion, and frozen PDF verification.

## Other checks

| Check | Result |
| --- | --- |
| `npm ci` | Pass; 1,272 packages installed from the unchanged lockfile |
| `npm run typecheck` | Pass |
| Production npm audit at high | Pass |
| Complete npm audit at high | Expected failure; `brace-expansion <=5.0.7`, 36 high impacts |
| Seven frozen public PDFs | Pass |
| `package.json` / `package-lock.json` diff | Empty |
| Product/Bilan diff | Empty |
