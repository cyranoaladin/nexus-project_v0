# Candidat Individuel Final Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one pre-cutover-ready candidate-individual release candidate with proven P1-A classification, minimal PII-safe POST search contracts, robust contextual navigation, an order-independent one-DB test runner, release fingerprinting, dual-browser qualification and immutable release provenance.

**Architecture:** Keep the existing business engine and identity resolver authoritative. Add thin staff-only POST adapters over shared server search services, use an allowlisted candidate DTO, preserve same-tab ephemeral handoff with native navigation, and repair the DB reset at its pooled-session root cause. Freeze one source SHA only after all source changes and tests; build one artifact, qualify that unchanged artifact, and bind a hashed sidecar attestation to its digest.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Zod, Prisma 6/PostgreSQL 15, Redis rate limiting, Jest, Playwright Chromium and Google Chrome 152, Nginx/PM2 release tooling.

---

## Chunk 1: Evidence and hermetic foundations

### Task 1: Capture and classify P1-A without changing production

**Files:**
- Existing diagnostic pack: `~/Téléchargements/NEXUS_CANDIDAT_LIVE_DIAGNOSTIC/`
- Update after evidence: `docs/audits/2026-08-30-candidat-individuel-contextual-student-workflow.md`

- [ ] **Step 1: Record the unchanged evidence baseline**

Record production source `ca2b86efa0c552277bc3a98c03c3944be8459835`, pipeline `ACTIVE_INTERNAL`, and expected assets without mutating production.

- [ ] **Step 2: Collect the normal-profile trace**

Direction runs the sanitized diagnostic once in the habitual Chrome profile against the exact failing student workflow. Store only the sanitized report; never store field values, cookies, IDs, bodies or tokens.

- [ ] **Step 3: Collect the clean-profile trace**

Repeat once in Incognito/Guest without extensions against the same production release, account and workflow.

- [ ] **Step 4: Classify the boundary**

Expected result is exactly one of `CLIENT_ENVIRONMENT_PROVEN`, `APPLICATION_BOUNDARY_PROVEN`, or `OPEN`. Automated browser success alone must not change this result.

- [ ] **Step 5: Follow the conditional application-fix path**

If classification is `APPLICATION_BOUNDARY_PROVEN`, add the smallest automated reproduction of the observed event/fetch/state boundary, verify RED on the current RC, implement one minimal correction, verify GREEN, obtain code/security review and rerun all affected source gates before Task 13. If the controlled human artifact trace later fails, disqualify that source/artifact and restart Task 13; never patch or rebuild it under the same identity.

- [ ] **Step 6: Gate subsequent release work**

Implementation may continue on the branch, but Task 14 and every cutover action remain blocked while classification is `OPEN`.

### Task 2: Make the DB reset hermetic on one fresh database

**Files:**
- Modify: `__tests__/setup/test-database.ts`
- Modify or remove unsafe duplicate: `__tests__/setup.ts`
- Modify: `__tests__/database/schema.test.ts`
- Create: `scripts/testing/run-db-order-matrix.mjs`
- Create: `scripts/testing/db-order-sequencer.cjs`
- Modify: `jest.config.db.js`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Write failing static and real-DB tests**

Tests added to the existing database schema suite must reject any executable `SET session_replication_role`, verify `_prisma_migrations` is excluded, require one fatal controlled TRUNCATE, check several concurrently occupied pool sessions are `origin`, and prove the canonical composite FK remains enforced after reset. Keeping the regression in an existing suite preserves the 12-suite topology; its new exact test total is frozen after RED/GREEN and must match every matrix lane.

- [ ] **Step 2: Run focused tests and verify RED**

Run the new helper/static tests and the canonical schema test. Expected failure: current cleanup contains `SET session_replication_role=replica` and can leave pooled sessions in `replica`.

- [ ] **Step 3: Implement one central reset**

Discover only application tables from `public`, exclude `_prisma_migrations`, quote identifiers, and execute one `TRUNCATE TABLE ... RESTART IDENTITY CASCADE`. Remove the trigger-disabling calls and every swallowed cleanup error. Align or delete the dormant duplicate helper.

- [ ] **Step 4: Verify GREEN on focused DB tests**

Run reset, concurrent-session, FK and canonical tests on one freshly migrated PostgreSQL 15 database. Expected: every backend reports `origin`, reset errors are fatal and FK violations fail closed.

- [ ] **Step 5: Add deterministic order matrix**

The script discovers and freezes the exact 12-suite list, then uses `db-order-sequencer.cjs` to enforce normal, reverse and seeded order. The sequencer emits actual execution order and seed and fails if Jest executes a different order. All lanes reuse the same once-migrated database; reset is fatal and migrations are never replayed.

- [ ] **Step 6: Run the full one-DB matrix**

Expected: normal PASS, reverse PASS, seeded PASS with exactly the same frozen suite list and exact post-change test total, which must be no lower than 203. A missing or replaced test is a failure; `FULL_DB_RUNNER_ONE_FRESH_DB=PASS`, `ORDER_INDEPENDENCE=PASS`.

- [ ] **Step 7: Add required CI job**

Create a PostgreSQL-backed CI job that runs migrations once, the hermetic full DB runner and the order regression. Add it to the aggregate CI success dependency.

- [ ] **Step 8: Commit**

```bash
git add __tests__/setup __tests__/database/schema.test.ts scripts/testing/run-db-order-matrix.mjs scripts/testing/db-order-sequencer.cjs jest.config.db.js package.json .github/workflows/ci.yml
git commit -m "test(db): make real database runner hermetic"
```

## Chunk 2: Minimal search contracts and privacy

### Task 3: Define strict candidate search contracts

**Files:**
- Create: `lib/quotes/candidat-individuel-search-contracts.ts`
- Create: `__tests__/lib/quotes/candidat-individuel-search-contracts.test.ts`

- [ ] **Step 1: Write failing schema tests**

Cover strict-object rejection, unknown keys and separate exact semantics: student query is trimmed and permits empty browse input up to 100 characters with page `1..10000` and limit `1..50`; lead query is trimmed `2..100` characters with limit `1..50`. Freeze exact success/error envelopes: invalid JSON or schema `400 INVALID_REQUEST`, OFF `409 PIPELINE_INACTIVE`, rate limit `429 RATE_LIMIT_EXCEEDED`, stable non-PII `500 SEARCH_UNAVAILABLE`, and success `200` with JSON content type plus `Cache-Control: private, no-store`.

- [ ] **Step 2: Verify RED**

Run only the new suite. Expected: module missing.

- [ ] **Step 3: Implement strict Zod schemas and DTO types**

Expose separate student and lead request schemas and explicit allowlisted response schemas/types. These Zod schemas are the sole contract SSOT: services construct them, routes serialize them, and clients parse/import them. `candidat-individuel-directory.ts` may adapt display state but cannot redefine the DTO. Do not include `creditBalance`, parent email, user IDs, phone, lead status or internal fields.

- [ ] **Step 4: Verify GREEN and commit**

```bash
git add lib/quotes/candidat-individuel-search-contracts.ts __tests__/lib/quotes/candidat-individuel-search-contracts.test.ts
git commit -m "feat(candidat-individuel): define minimal search contracts"
```

### Task 4: Build shared server-side SSOT search services

**Files:**
- Create: `lib/quotes/candidat-individuel-staff-search.server.ts`
- Modify: `lib/quotes/persistence.server.ts`
- Test: `__tests__/lib/quotes/candidat-individuel-staff-search.server.test.ts`

- [ ] **Step 1: Write failing service tests**

Use production-shaped fixtures for complete, missing parent, missing parent email, merged parent and merged student. Assert exact Prisma `select`, server-side selectability, canonical lead reuse and zero forbidden keys.

- [ ] **Step 2: Verify RED**

Expected: dedicated service absent and current generic query over-fetches.

- [ ] **Step 3: Extract shared SSOT primitives**

Reuse existing normalization and persistence logic. Student service performs strict Prisma projection and keeps responsible email only inside the service to compute `selectable`. Lead service reuses the canonical persistence lookup rather than duplicating filters.

- [ ] **Step 4: Verify GREEN**

Assert the returned JS objects cannot contain coach assignments, subscriptions, credits, counts, activation state or raw responsible data.

- [ ] **Step 5: Commit**

```bash
git add lib/quotes/candidat-individuel-staff-search.server.ts lib/quotes/persistence.server.ts __tests__/lib/quotes/candidat-individuel-staff-search.server.test.ts
git commit -m "refactor(candidat-individuel): centralize staff search services"
```

### Task 5: Add staff-only POST search routes

**Files:**
- Create: `app/api/assistante/candidat-individuel/students/search/route.ts`
- Create: `app/api/assistante/candidat-individuel/leads/search/route.ts`
- Modify: `lib/rate-limit/sensitive.ts`
- Create: `__tests__/api/assistante.candidat-individuel.search.route.test.ts`

- [ ] **Step 1: Write failing route tests**

Cover ADMIN/ASSISTANTE success, PARENT/ELEVE/COACH/anonymous rejection, OFF `409 PIPELINE_INACTIVE`, strict Zod/invalid JSON rejection, query/limit bounds, exact content type/no-store, exact response equality, service errors and no mutation. Add distinct student/lead rate-limit scopes keyed by authenticated identity plus trusted IP, backed by Redis in production, applied before validation/lookup so invalid attempts count. A 429 contains no PII and never calls the service.

- [ ] **Step 2: Add failing log assertions**

Inject names/emails/phones into rejected inputs and service errors. Assert logs contain only stable code, requestId, operation and status; assert raw PII, serialized Prisma messages, request body and stack are absent.

- [ ] **Step 3: Verify RED**

Expected: routes and rate-limit scopes missing.

- [ ] **Step 4: Implement thin POST adapters**

Guard role and pipeline, apply sensitive rate limit before lookup, parse strict Zod JSON, call SSOT service, set `private, no-store`, and map failures to stable error codes without `serializeError(error)`.

Retire bypasses explicitly: candidate lead GET `/api/quotes/leads/search?q=...` returns 405 and the generic students GET rejects its legacy `search` parameter while retaining non-search assignment usage. Architecture/API tests must prove neither legacy route can carry candidate search PII or bypass the new rate limits.

- [ ] **Step 5: Verify GREEN and commit**

```bash
git add app/api/assistante/candidat-individuel/students/search/route.ts app/api/assistante/candidat-individuel/leads/search/route.ts lib/rate-limit/sensitive.ts __tests__/api/assistante.candidat-individuel.search.route.test.ts
git commit -m "feat(candidat-individuel): add private POST search routes"
```

### Task 6: Freeze logging and artifact privacy

**Files:**
- Modify: `ops/nginx/nexus-safe-log.conf`
- Modify if required by deployed template: `nginx/nginx.conf`
- Create: `__tests__/architecture/candidat-individuel-search-privacy.test.ts`
- Modify: `e2e/auth/candidat-individuel-pipeline.spec.ts`

- [ ] **Step 1: Write failing source/privacy tests**

Assert candidate searches cannot use GET/query strings; Nginx access logs use URI without args; Nginx configuration contains no `$request_body`, `$args`, `$query_string` or `$request_uri`; application catches do not call raw `serializeError`; Playwright artifact names, trace/HAR metadata and diagnostics exclude input values and IDs.

- [ ] **Step 2: Verify RED**

Expected: workspace still calls query-string GET routes and privacy freeze is absent.

- [ ] **Step 3: Apply minimum logging hardening**

Keep operational error visibility while ensuring candidate search PII lives only in POST bodies and route logging is stable-code-only. Do not globally disable Nginx error logging.

- [ ] **Step 4: Add browser privacy assertions**

Assert URLs, headers, referrer, all console/pageerror records, GA/dataLayer/collect URL, headers and third-party POST bodies contain no synthetic search marker. First-party dedicated search POST bodies are expected to contain the query and are excluded from that assertion. Disable or sanitize trace/HAR/video/screenshots that could capture entered PII, then scan retained artifact content, not only filenames.

- [ ] **Step 5: Verify GREEN and commit**

```bash
git add ops/nginx/nexus-safe-log.conf nginx/nginx.conf __tests__/architecture/candidat-individuel-search-privacy.test.ts e2e/auth/candidat-individuel-pipeline.spec.ts
git commit -m "security(candidat-individuel): prevent search PII logging"
```

## Chunk 3: UI contract, navigation and disclosure

### Task 7: Decouple contextual directory UI from credit models

**Files:**
- Modify: `lib/quotes/candidat-individuel-directory.ts`
- Modify: `components/dashboard/staff/StudentsManagementWorkspace.tsx`
- Modify: `components/dashboard/assistante/CandidatIndividuelWorkspace.tsx`
- Modify: `__tests__/lib/quotes/candidat-individuel-directory.test.ts`
- Modify: `__tests__/components/dashboard/staff/StudentsManagementWorkspace.test.tsx`
- Modify: `__tests__/components/dashboard/assistante/CandidatIndividuelWorkspace.test.tsx`

- [ ] **Step 1: Write failing component/normalizer tests**

Require POST JSON calls to dedicated routes, exact minimal DTOs, no `creditBalance`, disabled unavailable rows with human reasons, and corrected student-first copy.

- [ ] **Step 2: Verify RED**

Expected: GET URLs, generic Student type and obsolete copy remain.

- [ ] **Step 3: Implement candidate-specific discriminated state**

Normal credits mode retains its existing type and endpoints. Contextual mode uses only the candidate DTO and never manufactures `creditBalance: null`.

- [ ] **Step 4: Switch inline and directory searches to POST**

Use the dedicated routes with AbortController, bounded timeout and stable retry UX. Both paths still converge on the shared authoritative identity resolver.

- [ ] **Step 5: Correct the copy**

Replace the obsolete link/rattachement wording with text explaining that selecting the student attaches the Nexus responsible automatically.

- [ ] **Step 6: Verify GREEN and commit**

```bash
git add lib/quotes/candidat-individuel-directory.ts components/dashboard/staff/StudentsManagementWorkspace.tsx components/dashboard/assistante/CandidatIndividuelWorkspace.tsx __tests__/lib/quotes/candidat-individuel-directory.test.ts __tests__/components/dashboard/staff/StudentsManagementWorkspace.test.tsx __tests__/components/dashboard/assistante/CandidatIndividuelWorkspace.test.tsx
git commit -m "fix(candidat-individuel): use minimal contextual directory model"
```

### Task 8: Make native handoff navigation recoverable

**Files:**
- Modify: `lib/quotes/candidat-individuel-navigation.ts`
- Modify: `components/dashboard/staff/StudentsManagementWorkspace.tsx`
- Modify: `components/dashboard/assistante/CandidatIndividuelShell.tsx`
- Modify: `__tests__/lib/quotes/candidat-individuel-navigation.test.ts`
- Modify: `__tests__/components/dashboard/staff/StudentsManagementWorkspace.test.tsx`
- Modify: `__tests__/components/dashboard/assistante/CandidatIndividuelShell.test.tsx`

- [ ] **Step 1: Write failing handoff matrix tests**

Cover consume-once, reload before/after consume, BFCache back/forward, role switch, OFF, expired/corrupt payload, failed storage, failed navigation, watchdog unlock and retry. For two tabs, prove tab B never consumes tab A's handoff and a newly opened candidate page has no usable handoff.

- [ ] **Step 2: Verify RED**

Expected: router-driven navigation cannot prove async transition recovery.

- [ ] **Step 3: Implement native same-tab navigation**

Existing-row controls become native links whose unmodified primary activation synchronously stages the handoff. Ctrl/Cmd/Shift/Alt clicks and middle clicks are prevented or ignored without staging or opening a candidate handoff tab. Creation uses hard same-tab navigation after staging. A watchdog clears and unlocks only if no `pagehide` or route change occurs; after unload, consume-once validation and TTL provide fail-closed recovery.

- [ ] **Step 4: Verify keyboard semantics**

Native link behavior supports mouse and Tab+Enter. Space is tested on inline result buttons and confirmation controls; Space on a native link must not navigate. No pointer-only handler may be required.

- [ ] **Step 5: Verify GREEN and commit**

```bash
git add lib/quotes/candidat-individuel-navigation.ts components/dashboard/staff/StudentsManagementWorkspace.tsx components/dashboard/assistante/CandidatIndividuelShell.tsx __tests__/lib/quotes/candidat-individuel-navigation.test.ts __tests__/components/dashboard/staff/StudentsManagementWorkspace.test.tsx __tests__/components/dashboard/assistante/CandidatIndividuelShell.test.tsx
git commit -m "fix(candidat-individuel): harden native student handoff"
```

### Task 9: Disclose contextual creation side effects

**Files:**
- Modify: `components/dashboard/staff/StudentsManagementWorkspace.tsx`
- Modify: `__tests__/components/dashboard/staff/StudentsManagementWorkspace.test.tsx`
- Modify: `app/api/assistante/students/route.ts`
- Modify: route tests covering `app/api/assistante/students/route.ts`
- Modify: encrypted outbox tests as required by the existing contract
- Modify: `e2e/auth/candidat-individuel-pipeline.spec.ts`

- [ ] **Step 1: Write failing disclosure tests**

Assert the contextual CTA is `Créer les comptes et utiliser pour ce devis`; an accessible dialog before the POST names account creation/update, student activation email and possible responsible password definition/reset email. Assert cancel sends no request and enqueues no email.

- [ ] **Step 2: Verify RED**

Expected: current action is ambiguous and submits without explicit disclosure confirmation.

- [ ] **Step 3: Implement explicit confirmation**

Keep the existing API and email behavior. Require staff confirmation after the disclosure and before the POST. Preserve normal students-page creation wording outside contextual mode.

- [ ] **Step 4: Prove the server-side email and secrecy matrix**

Cover new parent, active existing parent, inactive existing parent and conflict paths with exact email types/counts; conflict and canceled UI paths enqueue none. Require an exact minimal response containing only success/message/studentId/contactLeadId, reduce the transaction result to IDs, escape staff-entered names before HTML interpolation, and prove raw activation/password tokens, email addresses and passwordHash are absent from responses, stable logs and clear DB payloads. Reuse the encrypted-outbox proof rather than duplicating encryption.

- [ ] **Step 5: Verify GREEN and commit**

```bash
git add components/dashboard/staff/StudentsManagementWorkspace.tsx app/api/assistante/students/route.ts __tests__/components/dashboard/staff/StudentsManagementWorkspace.test.tsx __tests__/api __tests__/lib/email e2e/auth/candidat-individuel-pipeline.spec.ts
git commit -m "fix(candidat-individuel): disclose account creation side effects"
```

## Chunk 4: Release fingerprint and qualification lanes

### Task 10: Add non-secret server/client release fingerprinting

**Files:**
- Create: `lib/release/fingerprint.ts`
- Modify: `app/api/health/route.ts`
- Create: `components/dashboard/ReleaseMismatchBanner.tsx`
- Modify: `app/dashboard/layout.tsx`
- Create: `__tests__/lib/release/fingerprint.test.ts`
- Create: `__tests__/components/dashboard/ReleaseMismatchBanner.test.tsx`
- Modify: `__tests__/api/health.test.ts` or the existing health route suite
- Modify: `next.config.mjs`

- [ ] **Step 1: Write failing fingerprint tests**

Cover exact normalized SHA format, missing/invalid values, server health disclosure with `Cache-Control: no-store`, equal/mismatched client/server values, explicit reload and no automatic reload. Missing or invalid client/server SHA is fail-closed with a visible staff warning rather than silent success.

- [ ] **Step 2: Verify RED**

Expected: no shared fingerprint service or staff mismatch banner exists.

- [ ] **Step 3: Implement build-time client and runtime server SHA**

Embed `NEXT_PUBLIC_RELEASE_SHA` at build time, read `RELEASE_SHA` server-side, expose non-secret server SHA in health, and render the banner only for authenticated staff roles on mismatch.

- [ ] **Step 4: Verify no form interruption**

Banner may recheck on navigation/focus but never invokes reload automatically or clears client state.

- [ ] **Step 5: Verify GREEN and commit**

```bash
git add lib/release/fingerprint.ts app/api/health/route.ts components/dashboard/ReleaseMismatchBanner.tsx app/dashboard/layout.tsx __tests__/lib/release/fingerprint.test.ts __tests__/components/dashboard/ReleaseMismatchBanner.test.tsx __tests__/api next.config.mjs
git commit -m "feat(release): expose staff build fingerprint mismatch"
```

### Task 11: Add Chromium and Chrome 152 authenticated lanes

**Files:**
- Modify: `playwright.auth.config.ts`
- Modify: `e2e/auth/candidat-individuel-pipeline.spec.ts`
- Modify: `scripts/playwright-entrypoint.sh`
- Modify: `Dockerfile.playwright`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`

- [ ] **Step 1: Write/enable the dual-project matrix and verify RED**

Add explicit projects for bundled Chromium and `channel: 'chrome'`. Provision exact Google Chrome `152.0.7977.64` through a pinned package/archive plus checksum in the Playwright image or an equivalently enforced host lane. Preflight must assert `browser.version() === 152.0.7977.64`; CI must run both projects. Expected current failure: authenticated candidate suite is not wired to an installed/pinned Chrome 152.

- [ ] **Step 2: Add deterministic interaction scenarios**

Use `pressSequentially`, real mouse click, Tab+Enter on links/results and Tab+Space on buttons/confirmation. Cover inline selection, contextual existing student, contextual creation, fresh/warm/hard reload, 60+ second idle and back/forward. Set a dedicated timeout greater than idle plus all actions.

- [ ] **Step 3: Add viewport matrix**

Exercise identity, profile, needs, financing and quote states at desktop 1440+, tablet 1024 and mobile 390. Assert no overflow, inaccessible CTA or hidden error.

- [ ] **Step 4: Keep diagnostics test-only and sanitized**

Capture candidate-owned page errors, console errors, unexpected HTTP/request failures and event types without input values or IDs. Remove any temporary runtime instrumentation.

- [ ] **Step 5: Verify both lanes**

Expected on the same standalone and DB fixture: Chromium PASS, Chrome `152.0.7977.64` PASS, application diagnostics zero.

- [ ] **Step 6: Commit**

```bash
git add playwright.auth.config.ts e2e/auth/candidat-individuel-pipeline.spec.ts scripts/playwright-entrypoint.sh Dockerfile.playwright .github/workflows/ci.yml package.json
git commit -m "test(candidat-individuel): qualify Chromium and Chrome 152"
```

### Task 12: Implement immutable release manifest, attestation and governance gates

**Files:**
- Modify: `scripts/release/verify-standalone-artifact.mjs`
- Create: `scripts/release/create-qualification-attestation.mjs`
- Create: `scripts/release/verify-qualified-release.mjs`
- Create: `docs/adr/candidat-individuel-release-governance.md`
- Create: `__tests__/scripts/release/candidat-individuel-qualified-release.test.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Write failing release-chain tests**

Require exact agreement among source SHA, annotated tag target, embedded manifest, BUILD_ID, payload/tree digest, final artifact digest and attestation digest. Reject lightweight/moving tags, dirty source, missing security scan, migration drift and post-build mutation.

- [ ] **Step 2: Verify RED**

Expected: current tooling writes a build manifest but does not verify tag/attestation chain.

- [ ] **Step 3: Implement build manifest and sidecar attestation tools**

The artifact manifest contains a payload/tree digest computed with the manifest and all sidecars excluded. After the manifest is embedded, compute the final packaged artifact digest externally and store it only in sibling `.sha256`/attestation files outside the artifact tree. The final verifier recomputes both digests and rejects any added/removed file, content mutation or unexpected symlink. Verification is fail-closed and logs no secret/path/PII.

- [ ] **Step 4: Add CI/release enforcement**

Make the final source gates and one-DB job remotely visible. Configure the release branch/ruleset against force-push if repository permissions permit; otherwise apply and verify immutable annotated-tag protection/ruleset, not documentation alone.

- [ ] **Step 5: Verify and commit governance before final freeze**

```bash
git add scripts/release docs/adr/candidat-individuel-release-governance.md __tests__/scripts/release package.json .github/workflows/ci.yml
git commit -m "chore(release): enforce immutable qualified artifact chain"
```

## Chunk 5: Integration, review and pre-cutover freeze

### Task 13: Full source qualification before final SHA

**Files:**
- Update before freeze: `docs/audits/2026-08-30-candidat-individuel-contextual-student-workflow.md`
- Update before freeze: qualification manifest template/schema owned by Task 12

- [ ] **Step 1: Run static gates**

In a clean checkout, verify pinned Node `22.23.1` and npm `10.9.8`, run real `npm ci`, then Prisma generate/validate, typecheck, lint, dead-code checks, test quarantine/focus scanner, PR180 source scanner and candidate warning scanner. Expected: lockfile-clean install, no new warning and no candidate-individual warning.

- [ ] **Step 2: Run unit/component/API suites**

Run full unit plus focused contracts, service, route, component, timeout, handoff, privacy and fingerprint suites. Record exact counts.

- [ ] **Step 3: Run DB and integration gates**

Run `DB_ONE_FRESH_DB`, normal/reverse/seeded order, then full integration. Require at least 203/203 DB tests and all integration tests.

- [ ] **Step 4: Run business/security gates**

Run V1 freeze, deferred scope, group/margin rules, R1, R2, family link rotation/security, PDF semantics, PR180 and artifact source audit.

- [ ] **Step 5: Review all changes**

Use code-review and security-review agents. Fix findings through new RED/GREEN cycles. Repeat focused and full source gates after every fix.

- [ ] **Step 6: Finish all documentation now**

Record P1-A evidence/classification, DB root cause, privacy decisions, release governance and rollback plan before creating the final source SHA. No documentation commit is allowed after Task 13.

- [ ] **Step 7: Create and push the final source commit**

Require clean worktree, remote synchronization and zero unpushed production-relevant commits. This commit becomes `FINAL_SOURCE_SHA`; no later commit is allowed.

### Task 14: Build once and qualify the exact immutable artifact

**Precondition:** P1-A is `CLIENT_ENVIRONMENT_PROVEN` or the application cause is fixed and ready for controlled artifact trace. If not, stop with `FINAL_VERDICT=NOT_READY`.

- [ ] **Step 1: Create one clean build from FINAL_SOURCE_SHA**

Verify pinned Node `22.23.1` and npm `10.9.8`, run `npm ci` from the lockfile in the clean FINAL_SOURCE_SHA checkout, set both server/client release SHA inputs to that exact SHA, then run the production build once and generate the immutable build manifest.

- [ ] **Step 2: Compute and retain artifact identity**

Record `FINAL_BUILD_ID` and SHA-256 of the immutable packaged artifact. Run standalone audit and forbidden-artifact scanner. Never rebuild after this step.

- [ ] **Step 3: Run E2E Chromium against that artifact**

Execute the complete candidate matrix and record exact count, diagnostics, responsive and accessibility results.

- [ ] **Step 4: Run E2E Chrome 152 against the same artifact**

Execute the identical required matrix using installed Google Chrome `152.0.7977.64`.

- [ ] **Step 5: Complete P1-A application-fix proof if applicable**

If ca2 traces proved an application cause, direction performs the controlled human trace against this exact artifact with safe fixture data. Without PASS, stop.

- [ ] **Step 6: Push and verify the protected annotated tag**

After all artifact/browser/human qualification passes, push an annotated immutable release tag at the exact final SHA and verify the remote protection/ruleset and tag target.

- [ ] **Step 7: Generate the sidecar qualification attestation**

Bind all counts, versions, migration result, rollback target, verified remote tag evidence and gate results to `FINAL_SOURCE_SHA`, `FINAL_BUILD_ID` and `FINAL_ARTIFACT_SHA256`. Hash the attestation without altering the artifact.

- [ ] **Step 8: Verify the complete immutable chain**

Run `verify-qualified-release` over remote tag, source SHA, payload/tree digest, embedded manifest, BUILD_ID, final artifact SHA-256, security scan and attestation/hash. Confirm remote CI PASS or the enforced formal equivalent.

- [ ] **Step 9: Fail closed on any post-freeze failure**

If Chrome, Chromium, human artifact trace, digest or final-chain verification fails, mark the artifact disqualified. Any code, documentation or tooling correction returns to Task 13, creates a new final SHA and builds a new identity. If a proven external condition is repaired without source change, restart complete Task 14 qualification from step 1; never retain partial PASS evidence or reuse a failed tag/attestation.

- [ ] **Step 10: Produce the pre-cutover report and stop**

Require every requested field PASS, migrations `88 -> 88`, `PRODUCTION_DEPLOYED=NO`, and `FINAL_VERDICT=READY_FOR_ATOMIC_CUTOVER`. If any gate is open, report `NOT_READY`. Do not connect for cutover in this task phase.
