# C2 PDF.js Standalone and Bounded Recovery Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package and prove PDF.js extraction in the shipped standalone, guard workers before claiming jobs when the engine is unavailable, and provide one exact, audited ADMIN-only recovery attempt for an exhausted processing.

**Architecture:** A shared ESM child helper is traced into Next standalone with its locked PDF.js runtime closure. A release gate executes real extraction from an isolated artifact copy and a negative control without PDF.js. Core v2 stores a one-to-one retry authorization with immutable target snapshots, consumes it atomically under the existing queue lock, and audits it with the authorization.

**Tech Stack:** Next.js standalone output tracing, Node ESM child process, Prisma/PostgreSQL transactions and migrations, Core v2 capability RBAC, Jest, GitHub Actions.

---

## Chunk 1: Reproduce and fix standalone extraction

### Task 1: Add an executable standalone extraction probe and show it fails on the current artifact

**Files:**
- Create: `scripts/release/smoke-standalone-pdf-extraction.mjs`
- Create: `scripts/release/fixtures/synthetic-pdf.mjs` (or a test fixture module)
- Test: `__tests__/scripts/standalone-pdf-extraction.test.ts`

- [ ] Build a tiny valid PDF fixture independently of PDF.js (PDFKit/source-side fixture builder is acceptable), with fixed ASCII sentinel fragments and no real/student content.
- [ ] Run the current `release-5aad...` artifact from a disposable copy outside the workspace; assert the exact `ERR_MODULE_NOT_FOUND` and record release SHA/BUILD_ID without touching the release.
- [ ] Add a unit test for probe success/failure semantics and run it to see the intended failure.

### Task 2: Share the production child helper and trace the locked PDF.js closure

**Files:**
- Create: `lib/bilans/render/pdf-text-extractor.mjs`
- Modify: `lib/bilans/render/pdf.ts`
- Modify: `next.config.mjs`
- Modify: `package.json`
- Test: `__tests__/bilans/render-pdf-timeout.test.ts`

- [ ] Move only the child ESM extraction logic into a helper invoked by `extractPdfText`; preserve stdin, timeout, bounded stderr, process termination, and output behavior.
- [ ] Add targeted `outputFileTracingIncludes` entries for the helper and the smallest PDF.js dependency closure proven necessary for the locked package; avoid copying unrelated packages.
- [ ] Run focused source extraction/timeout tests and assert `.nft.json` lists the helper and closure and that every listed resource exists in standalone at its expected path.

### Task 3: Make standalone extraction a blocking build/CI gate

**Files:**
- Modify: `scripts/release/smoke-standalone-pdf-extraction.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml` only if the existing Production Build command does not execute the gate
- Test: `__tests__/scripts/standalone-pdf-extraction.test.ts`

- [ ] Make a real copy of the standalone under a temporary root; reject symlinks escaping that root, verify no ancestor has `node_modules`, clear `NODE_PATH`, `NODE_OPTIONS` and loader overrides, and run with `cwd` set to the copied standalone.
- [ ] Invoke the helper via the same production spawn wrapper included in the artifact; require success status, no truncation, and every exact expected PDF text fragment.
- [ ] Create a second disposable artifact copy with exactly the proven PDF.js runtime closure removed; assert the same wrapper fails with the expected module-resolution error.
- [ ] Wire the gate into the canonical build/Production Build lane and verify it is mandatory.

## Chunk 2: Prevent attempts being consumed by missing runtime prerequisites

### Task 4: Add the extraction engine preflight before queue claim

**Files:**
- Modify: `lib/core-v2/diagnostics/text-extraction.ts`
- Modify: `lib/core-v2/services/diagnostic-processing.ts`
- Test: `__tests__/core-v2/services/diagnostic-processing.test.ts`

- [ ] Add a bounded cached capability probe using the same helper and Node executable as actual extraction.
- [ ] In the DB-backed worker test, render the engine unavailable and prove processing `attemptCount`, `leaseOwner`, lease expiry and claim count are unchanged.
- [ ] Test available engine retains the existing queue behavior and does not fabricate an extraction result.

## Chunk 3: Add exact one-shot administrative recovery

### Task 5: Model the authorization and admin-only capability

**Files:**
- Modify: `core-v2/prisma/schema.prisma`
- Create: `core-v2/prisma/migrations/0022_core_v2_diagnostic_processing_retry_authorization/migration.sql`
- Modify: `lib/core-v2/rbac.ts`
- Test: `__tests__/core-v2/rbac.test.ts` or existing exhaustive capability tests

- [ ] Add a one-to-one authorization model with unique processing and operation IDs, frozen target/revision evidence, ADMIN actor, reason, release SHA and consumable status.
- [ ] Add the smallest additive migration and regenerate the Core v2 client in the worktree.
- [ ] Add an explicit ADMIN-only recovery capability and test exhaustive role classification.

### Task 6: Implement idempotent authorization service and route

**Files:**
- Create: `lib/core-v2/services/diagnostic-processing-recovery.ts` (or cohesive service section)
- Create: `app/api/v2/staff/diagnostics/processing/[processingId]/retry-authorization/route.ts`
- Modify: `lib/core-v2/audit.ts`
- Tests: `__tests__/core-v2/services/diagnostic-processing-recovery.test.ts`, `__tests__/core-v2/http/diagnostic-processing-recovery-api.test.ts`

- [ ] Lock processing first, then submission/assignment and authorization state in one documented order; require status `EXTRACTION_FAILED`, `attemptCount === 5`, no active lease, exact processing/submission/version/SHA/subject snapshot, active assignment, current usable `RECEIVED` copy, and exact latest extraction id/revision/status/error.
- [ ] Match only the historic missing-module error for `pdfjs-dist/legacy/build/pdf.mjs`; test unrelated `ERR_MODULE_NOT_FOUND` and document-corruption errors are refused.
- [ ] Derive or verify the corrected release SHA against the running server's trusted release identity; refuse absent/mismatched identity. Keep SHA out of audit metadata; store only in authorization evidence.
- [ ] Create authorization and append minimal reason-code audit in one transaction. Same operationId + identical payload returns the same authorization, including after consumption; changed payload/target or operationId reused across targets conflicts; a second grant for the same processing conflicts. Test concurrent identical and competing requests produce one grant and one audit.
- [ ] Enforce ADMIN-only access; prove ASSISTANTE and unauthenticated callers are denied.

### Task 7: Consume one authorization under the existing lease claim

**Files:**
- Modify: `lib/core-v2/services/diagnostic-processing.ts`
- Tests: `__tests__/core-v2/services/diagnostic-processing.test.ts`, recovery service tests

- [ ] Extend claim eligibility only for an exact unconsumed authorization while keeping the global attempt cap unchanged; lock processing before grant and revalidate every frozen snapshot at consumption.
- [ ] Consume authorization and increment cumulative attempt count 5→6 in the same `SKIP LOCKED` transaction.
- [ ] Use a cryptographically unique fencing lease token per claim (not a batch owner string) so a late result cannot replace an authorized attempt.
- [ ] On the first worker poll after the authorized lease expires, atomically close it as terminal `EXTRACTION_FAILED`, append an explicit `FAILED` extraction revision and audit reason `AUTHORIZED_RETRY_LEASE_EXPIRED`; never reclaim the extra attempt or loop. Prove a late worker cannot add a result after closure.
- [ ] Keep the engine-probe cache scoped to the immutable running process/release; distinguish dependency-unavailable errors from document-specific failures. If the actual extractor reports the same missing runtime module after a positive probe, do not consume normal attempts or the one-shot grant; emit infrastructure-unavailable metrics instead.
- [ ] Test exhausted/no grant, one grant/one claim, duplicate/concurrent requests, two workers, stale result, exact v5 success, extraction failure and lease crash. A crashed consumed authorization must produce a terminal explicit failure, not a permanently leased row or another claim.

## Chunk 4: Full verification and review handoff

### Task 8: Validate migration, app, artifact, and architecture

**Files:** all feature files above

- [ ] Run targeted tests, Core v2 service/API tests, architecture checks, typecheck, lint, and canonical production build.
- [ ] Run isolated standalone extraction positive and negative controls; retain red/green evidence.
- [ ] Verify working-tree diff contains only the three authorized PR concerns and docs.
- [ ] Push branch, open PR, request `@abenrhouma`, and wait for required checks/review without fabricating approval or bypassing protections.

### Task 9: Post-merge qualification and Preview-only deployment

- [ ] After exact merge SHA and successful CI/review, build an immutable release and preserve current release as rollback.
- [ ] On isolated cloned databases/storage/Redis/Mailpit, apply the additive migration and verify the old release remains schema-compatible before Preview migration; verify the deployment Node version satisfies the locked PDF.js engine range.
- [ ] Qualify the v5 retry end-to-end through the canonical worker, proving six total historical attempts, extraction revision appended, source v5 fingerprint unchanged, no AI credential usable, no AI calls.
- [ ] Only after isolated PASS, deploy Preview privately, verify health/auth/ClamAV and source invariants.
- [ ] Authorize exactly one application of the retry grant to live v5; verify persisted extracted text, then prepare the canonical full C2 request and ledger preflight.
- [ ] Before the already-authorized single C2 generation, inspect operation journal and ledger; send at most one call within the stated constraints and stop at DRAFT. No validation or publication.
