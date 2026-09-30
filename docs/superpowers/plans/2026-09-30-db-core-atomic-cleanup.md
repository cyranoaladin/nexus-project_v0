# DB-core atomic cleanup implementation plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make disposable DB-core preparation atomic, bounded, fail-closed and observable without changing application behavior.

**Architecture:** Keep `setupTestDatabase` as the existing entry point. Validate its disposable target, inventory only allowed `public` tables, reject unsafe descendants/triggers, and execute one schema-qualified `TRUNCATE ... RESTART IDENTITY RESTRICT` inside a bounded PostgreSQL transaction. Add real-DB countertests to the existing db-core lane and capture the lane's console/JSON evidence in CI.

**Tech Stack:** PostgreSQL 16, Prisma, Jest, GitHub Actions.

---

## Chunk 1: Baseline and cleanup

### Task 1: Preserve baseline measurements

**Files:** `__tests__/setup/test-database.ts`, `docs/audits/2026-09-30-db-core-cleanup.md`

- [ ] Run the two payment suites on a freshly migrated disposable database, recording real outcome and duration.
- [ ] Run their preceding db-core sequence if feasible and record PostgreSQL waits without inferring causality from checkpoints alone.
- [ ] Write the observed pre-change command count and hook phase timing in the audit.

### Task 2: Prove unsafe behavior and write countertests

**Files:** `__tests__/db/test-database-cleanup.db.test.ts`

- [ ] Add real-DB tests for grouped atomic cleanup, FK enforcement, migration preservation, sequence reset and identifier quoting.
- [ ] Add countertests for a non-disposable target, an external FK/partition or ON TRUNCATE trigger, and a blocking lock.
- [ ] Run the new suite against the old helper and preserve its failures as red evidence.

### Task 3: Implement minimum cleanup

**Files:** `__tests__/setup/test-database.ts`

- [ ] Validate local disposable URL and effective database before writes.
- [ ] Inventory and sort qualified `public` tables; reject out-of-scope inherited tables and user ON TRUNCATE triggers.
- [ ] Use `SET LOCAL` lock and statement timeouts in a transaction, then one quoted `TRUNCATE ... RESTART IDENTITY RESTRICT`.
- [ ] Remove replica role changes, per-table CASCADE and swallowed fallback errors.
- [ ] Emit monotonic structured timings without URLs, rows or personal data.
- [ ] Run countertests and two payment suites green.

## Chunk 2: CI evidence and qualification

### Task 4: Retain actual db-core evidence

**Files:** `.github/workflows/ci.yml`, `__tests__/ci/*` if needed

- [ ] Capture db-core stdout/stderr with `tee` and preserve Jest's exit code.
- [ ] Save Jest JSON when available, upload mandatory log and metadata under `if: always()` with run/head/attempt identity.
- [ ] Test workflow guards and artifact behavior; do not treat an optional crash file as required.

### Task 5: Full verification and review

**Files:** `docs/audits/2026-09-30-db-core-cleanup.md`

- [ ] Run helper, payment suites, full db-core lane and the Real DB Integration phase order on disposable infrastructure.
- [ ] Compare before/after commands, durations, data scope and assertions; document limitations honestly.
- [ ] Run typecheck/lint and relevant CI tests; request technical review.
- [ ] Commit, push one focused PR and obtain green CI before requesting @abenrhouma approval on the final head.
