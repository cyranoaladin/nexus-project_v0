# PR #317 Diagnostics Queue Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the candidat-libre operational queue current-version-only, PII-minimal, database-bounded, cursor-stable, and covered by a real ADMIN Playwright journey.

**Architecture:** A parameterized PostgreSQL CTE in the Core v2 query repository selects the latest non-rejected submission per assignment, projects the canonical queue state, filters, keyset-pages, and limits in the database. The HTTP/client contract carries an opaque cursor plus an explicit list-change signal; the client replaces stale pages and deduplicates defensively.

**Tech Stack:** Next.js App Router, TypeScript, Prisma Core v2/PostgreSQL, Zod, Jest/Testing Library, Playwright.

---

## Chunk 1: Red proofs, server semantics, and bounded pagination

### Task 1: Write the browser counter-example before implementation

**Files:**
- Create: `e2e/auth/core-v2-diagnostics-queue.spec.ts`
- No shared fixture helper exists: seed and clean the disposable Core v2 rows directly in this spec with its own `PrismaClient`, following `e2e/auth/diagnostics-candidat-libre-bilan-journey.spec.ts`

- [ ] In the spec's `beforeAll/afterAll`, seed and clean directly through its own Core v2 `PrismaClient`: one ADMIN-visible assignment with usable v1/v2 ids retained, plus a later-rejected case and a unique confidential sentinel in a real draft/internal field.
- [ ] Use `loginViaSigninForm(page, 'admin')`, click navigation “Diagnostics candidats libres”, wait for `GET /api/v2/staff/diagnostics/submissions`, click “Action requise”, then click “Ouvrir”.
- [ ] Assert the response omits `v1Id`, the DOM has no `href` ending in `/${v1Id}`, the row shows `v2`, “Ouvrir” targets `v2Id`, and the detail URL/heading load.
- [ ] Assert serialized queue JSON contains neither confidential keys nor the seeded sentinel.
- [ ] Prepare the established auth harness explicitly: start disposable Core v1 Postgres/Redis; run Core v1 migrations plus `NEXUS_DISPOSABLE_POSTGRES=1 DATABASE_URL="$DATABASE_URL" npx tsx scripts/seed-e2e-db.ts` for real ADMIN credentials; create a separate disposable host-reachable Core v2 database; run `CORE_V2_DATABASE_URL="$CORE_V2_DATABASE_URL" npx prisma migrate reset --force --skip-seed --schema=core-v2/prisma/schema.prisma`; then run `DATABASE_URL="$DATABASE_URL" CORE_V2_DATABASE_URL="$CORE_V2_DATABASE_URL" npx tsx scripts/core-v2/seed-e2e-staff-actors.ts` to mirror the ADMIN actor. Build/start the standalone with both database URLs, Core v2 organization env, and `CORE_V2_AUTH_MODE=HYBRID`.
- [ ] With that harness running, execute `CI=1 BASE_URL=http://localhost:3002 CORE_V2_DATABASE_URL="$CORE_V2_DATABASE_URL" npx playwright test e2e/auth/core-v2-diagnostics-queue.spec.ts --config=playwright.auth.config.ts --project=chromium --reporter=line`. The CI equivalent is the auth-chromium lane in `.github/workflows/ci.yml`, which performs migrations/seeding/server startup before the same Playwright command.
- [ ] Expected RED: both versions are currently returned/actionable and the PII payload contains fields beyond the minimal contract.

### Task 2: Lock current-submission, FAILED-state, and PII contracts with failing tests

**Files:**
- Modify: `__tests__/core-v2/http/diagnostics-submissions-queue.test.ts`
- Modify: `__tests__/core-v2/queries/diagnostics-queue.test.ts`
- Create: `lib/core-v2/diagnostics/current-submission.ts`
- Modify: `lib/core-v2/diagnostics/submission-pipeline.ts`
- Modify: `components/dashboard/core-v2/DiagnosticsLibresWorkspace.tsx`
- Modify: `components/dashboard/core-v2/DiagnosticsPanel.tsx`
- Modify: `__tests__/core-v2/services/submission-pipeline.test.ts`
- Modify: `__tests__/components/dashboard/core-v2/diagnostics-panel.test.tsx`
- Modify: `lib/core-v2/queries/diagnostics-queue.ts`

- [ ] Add a real-DB counter-example with one assignment containing v1 `RECEIVED` and v2 `RECEIVED`; assert only v2 is returned and exposed as an operational queue action. Direct historical/detail access to v1 remains out of scope and must not be prohibited.
- [ ] Add the canonical rejection case: a later `REJECTED` version does not supplant the latest non-rejected usable version.
- [ ] Replace the contradictory “REJECTED submission → FAILED row” fixture with a current usable submission whose processing is `EXTRACTION_FAILED`; an assignment containing only REJECTED history is absent.
- [ ] Add an exact candidate payload assertion equal to `{ id: studentId, firstName, lastName }`, including negative assertions for nested `user`, email, phone, account status, activation, and timestamps.
- [ ] Run `CORE_V2_DATABASE_URL="$CORE_V2_DATABASE_URL" npx jest --config jest.core-v2.config.js --runInBand __tests__/core-v2/queries/diagnostics-queue.test.ts __tests__/core-v2/http/diagnostics-submissions-queue.test.ts`.
- [ ] Expected RED: v1 and v2 both appear; rejected-only assignment appears; extra PublicUser fields are present.
- [ ] Add the shared pure current-submission contract and reuse it from `DiagnosticsLibresWorkspace`, `DiagnosticsPanel`, and `submission-pipeline` instead of keeping local `filter/reduce/findFirst` status definitions; add parity tests in their named test files.
- [ ] Add and export `queueCandidateSelect` as a dedicated minimal Student/User projection; return the flat candidate DTO and remove `PublicUser`.
- [ ] Re-run the focused tests and keep them red until the current-submission query is implemented.

### Task 3: Replace in-memory history loading with a bounded SQL repository query

**Files:**
- Modify: `lib/core-v2/queries/diagnostics-queue.ts`
- Modify: `__tests__/core-v2/http/diagnostics-submissions-queue.test.ts`

- [ ] Add a repository seam test that spies on `$queryRaw`/the page-row mapper and asserts no `diagnosticSubmission.findMany`, a parameterized `LIMIT = query.limit + 1`, and at most `limit + 1` materialized page rows. Seeding more rows alone is not accepted as proof.
- [ ] Run the focused command from Task 2; expected RED is the observed unrestricted `diagnosticSubmission.findMany` call.
- [ ] Implement parameterized Prisma SQL CTEs for latest usable submission (using the shared status constant), latest draft, queue state/rank, filter, deterministic order, and `LIMIT + 1`.
- [ ] Keep all academic/confidential columns outside the SELECT list.
- [ ] Do not compute or return `totalCount`; it is unused and would add an unbounded scan.
- [ ] Generate the SQL state `CASE` from one reusable fragment and add real-DB parity rows covering every significant input combination already covered by `projectDiagnosticQueueState`.
- [ ] Map raw scalars/dates to `DiagnosticQueueRow` in one focused mapper.
- [ ] Run the exact focused command to green, then refactor duplicated SQL fragments without changing behavior.
- [ ] Commit: `fix(diagnostics): bound queue to current submissions`

### Task 4: Implement an opaque keyset cursor and explicit stale-list contract

**Files:**
- Modify: `lib/core-v2/queries/diagnostics-queue.ts`
- Modify: `app/api/v2/staff/diagnostics/submissions/route.ts` if response typing requires it
- Modify: `__tests__/core-v2/http/diagnostics-submissions-queue.test.ts`

- [ ] Add named failing tests for stable page traversal, malformed cursor, filter mismatch, anchor leaving the set, state rank mutation under `ALL`, and `lastActivityAt` mutation.
- [ ] Assert an incompatible/stale cursor never silently appends a restarted page; response must say `listChanged: true` (or `staleCursor: true`).
- [ ] Implement versioned base64url encode/decode with Zod validation and the complete keyset `(stateRank, lastActivityAt, submissionId, filter)`.
- [ ] Use exact order `stateRank ASC, lastActivityAt ASC, submissionId ASC` and predicate `rank > r OR (rank = r AND activity > a) OR (rank = r AND activity = a AND id > i)`.
- [ ] Recompute the anchor tuple in the same repeatable-read snapshot as the page query; any tuple/filter mismatch returns a fresh first page with `listChanged: true`.
- [ ] Run the exact focused Jest command to green.
- [ ] Commit: `fix(diagnostics): use stable queue keyset pagination`

## Chunk 2: Client and browser proof

### Task 5: Replace stale pages and deduplicate client rows

**Files:**
- Modify: `components/dashboard/core-v2/DiagnosticsQueueWorkspace.tsx`
- Modify: `__tests__/components/dashboard/core-v2/diagnostics-queue-workspace.test.tsx`

- [ ] Add failing component tests proving `listChanged` replaces existing rows and overlapping ids are rendered once.
- [ ] Replace every fixture with the flat minimal candidate DTO; remove `PublicUser` imports and all email/phone/account/timestamp fixture data.
- [ ] Run `npx jest --config jest.config.js --runInBand __tests__/components/dashboard/core-v2/diagnostics-queue-workspace.test.tsx`; expected RED is duplicate rendering/appending on a stale page.
- [ ] Extend the queue page response type with the list-change signal.
- [ ] Add a small id-based merge helper: replace on first/stale page; otherwise append unique ids while preserving server order.
- [ ] Render a neutral “liste actualisée” notice when replacement occurred.
- [ ] Run component tests to green.
- [ ] Commit: `fix(diagnostics): reconcile changed queue pages`

### Task 6: Make the pre-written ADMIN Playwright journey green

**Files:**
- Modify: `e2e/auth/core-v2-diagnostics-queue.spec.ts`
- The spec remains self-contained for Core v2 seed/cleanup; do not invent a shared helper unless a second consumer appears

- [ ] Re-run the fully prepared auth-harness command from Task 1; expected GREEN with all explicit v1/v2, sentinel, navigation, response, URL, and heading assertions.
- [ ] Run `npm run check:e2e-ownership && npm run check:e2e-syntax`; confirm the new auth spec is collected by `playwright.auth.config.ts` and the CI ownership guard.
- [ ] Commit: `test(diagnostics): prove current queue journey end to end`

### Task 7: Verification, documentation, push, and fresh review

**Files:**
- Create or modify: `docs/audits/2026-09-23-pr317-diagnostics-queue-hardening.md`

- [ ] Run targeted Jest tests for queue query/route/component.
- [ ] Run `CORE_V2_DATABASE_URL="$CORE_V2_DATABASE_URL" npx jest --config jest.core-v2.config.js --runInBand --ci`.
- [ ] Run the CI-aligned architecture command `npx jest --config jest.unit.config.js --runInBand --ci __tests__/architecture/core-v2-legacy-guards.test.ts __tests__/architecture/core-v2-client-authority-guard.test.ts`.
- [ ] Run `npm run check:e2e-ownership`, `npm run check:e2e-syntax`, `npm run typecheck`, and `npm run lint`.
- [ ] Run the fully prepared auth-harness command from Task 1, then confirm the remote auth-chromium lane runs the same spec on the final SHA.
- [ ] Run the remaining CI-equivalent commands declared for the PR; record exact command/output for any environmental exception.
- [ ] Review `git diff origin/main...HEAD` for PII, academic content, scope, and accidental files.
- [ ] Request internal spec and code-quality reviews; resolve all Important/Critical findings.
- [ ] Push the branch; record local and remote SHA and require equality.
- [ ] Wait until every required GitHub check is green on that exact SHA.
- [ ] Only then post `@codex review`; require a fresh automated review tied to the exact SHA and resolve every applicable P1/P2 before calling it acceptable.
- [ ] Do not request or preserve human approval until the exact-head CI is green and the fresh automated review is acceptable.
- [ ] Record CI check conclusions, SHA, and review URL in the audit report.
