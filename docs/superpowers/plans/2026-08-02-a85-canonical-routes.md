# A85 Canonical Routes Implementation Plan

> **For agentic workers:** Execute in the current branch with strict red-green-refactor. No subagent is used for this repository session.

**Goal:** Implement exactly the six public Canonical assessment routes ratified by SPEC-04, all unavailable unless their individual validated pack flag is explicitly enabled.

**Architecture:** Thin Next.js route files delegate to server-only handlers. Shared access, pack resolution, idempotency and error translation live under `lib/bilans/api/`. Persistence is additive: one optimistic revision column and one request-idempotency table. Tests use a fixture `ValidatedPack` under `__tests__/` and a disposable pgvector database created only from this branch's migrations.

**Tech Stack:** Next.js route handlers, NextAuth `auth()`, Prisma/PostgreSQL 15, Zod, Jest.

---

### Task 1: A85.1 foundations

**Files:**
- Create: `lib/bilans/api/errors.ts`
- Create: `lib/bilans/api/access.ts`
- Create: `lib/bilans/api/pack-access.ts`
- Create: `lib/bilans/api/idempotency.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260802140000_add_canonical_api_idempotency/migration.sql`
- Test: `__tests__/bilans/canonical-api-foundations.test.ts`

- [ ] Write and run failing tests for default-off independent flags, DRAFT refusal, Student lookup by `userId` only, error status mapping, TTL and database constraints.
- [ ] Implement the minimal shared modules and additive migration.
- [ ] Run focused tests, Prisma validation, and a clean ephemeral migration deployment.
- [ ] Run all gates and commit the coherent foundation block.

### Task 2: Create attempt

**Files:**
- Create: `lib/bilans/api/create-attempt.ts`
- Create: `app/api/bilans/attempts/route.ts`
- Test: `__tests__/api/bilans-canonical-create.route.test.ts`

- [ ] Prove body minimization, session-only Student ownership, provenance, server seed, idempotent replay and default-off 404 in red.
- [ ] Implement only `POST /api/bilans/attempts` and make the tests green.
- [ ] Run gates and commit.

### Task 3: Read the sanitized attempt

**Files:**
- Create: `lib/bilans/api/get-attempt.ts`
- Create: `app/api/bilans/attempts/[id]/route.ts`
- Test: `__tests__/api/bilans-canonical-get.route.test.ts`
- Test: `__tests__/architecture/bilan-canonical-client-disclosure.test.ts`

- [ ] Prove ownership-first lookup, expiry 404, deterministic permutation and recursive sentinel exclusion in red.
- [ ] Implement the sanitized DTO without importing any pack from client code.
- [ ] Run gates and commit.

### Task 4: Save answers

**Files:**
- Create: `lib/bilans/api/patch-answers.ts`
- Create: `app/api/bilans/attempts/[id]/answers/route.ts`
- Test: `__tests__/api/bilans-canonical-answers.route.test.ts`

- [ ] Prove partial merge, confidence validation, idempotent replay, optimistic conflict and expired-attempt behavior in red.
- [ ] Implement atomic compare-and-increment without scoring.
- [ ] Run gates and commit.

### Task 5: Submit atomically

**Files:**
- Create: `lib/bilans/api/submit-attempt.ts`
- Create: `app/api/bilans/attempts/[id]/submit/route.ts`
- Test: `__tests__/integration/bilans-canonical-submit.test.ts`

- [ ] Prove explicit row locking, completeness, one transition and one outbox job under concurrent submissions in red against the disposable database.
- [ ] Implement the transaction without a worker.
- [ ] Run focused integration tests and all gates, then commit.

### Task 6: Status and published report

**Files:**
- Create: `lib/bilans/api/get-status.ts`
- Create: `lib/bilans/api/get-report.ts`
- Create: `app/api/bilans/attempts/[id]/status/route.ts`
- Create: `app/api/bilans/attempts/[id]/report/route.ts`
- Test: `__tests__/api/bilans-canonical-status.route.test.ts`
- Test: `__tests__/integration/bilans-canonical-report.test.ts`

- [ ] Prove status minimization and owner 404 in red.
- [ ] Prove published-only access, empty validation failures, session-derived ELEVE/PARENTS/NEXUS audiences and no public raw scores in red.
- [ ] Implement both read handlers, run integration tests and all gates, then commit.

### Task 7: Final branch proof

- [ ] Recreate the disposable PostgreSQL 15 pgvector database from this branch's migrations.
- [ ] Run targeted integration, full lint, typecheck, Jest and `build:base`.
- [ ] Verify every pack flag is absent from committed environments and therefore off.
- [ ] Push `docs/bilans-kit-integration` without merge or deployment.
