# Core Family, Academic Enrollment and Per-child Planning Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the five-role Nexus core go-live ready through canonical family creation, atomic per-child academic maps, course-scoped coach assignments, governed recurring planning and owned dashboards, with RAG completely disabled.

**Architecture:** Use additive expand-and-contract migrations and focused domain commands. `createFamily`, `setStudentChosenCourses`, `CoachStudentAssignment`, and `SessionBooking` remain the respective canonical foundations; new request, identity, course-key and planning-series structures close their current gaps without dropping rollback fields.

**Tech Stack:** Next.js 15 App Router, TypeScript, NextAuth v5, Prisma 6/PostgreSQL, Zod, Jest, Playwright.

Each checkbox below is one bounded action. When an assertion protects behavior that is already correct, record it as a green characterization and make no production change. Every behavior change still requires an observed RED before its GREEN implementation.

---

## Chunk 1: Governance, boundaries and additive schema

### Task 1: Freeze independent go-live gates and role contract

**Files:**
- Create: `CORE_GO_LIVE_GATE.md`
- Create: `docs/audits/2026-09-06-core-platform-go-live.md`
- Modify: `audit_dsahboard.md`
- Create: `lib/auth/role-destinations.ts`
- Modify: `auth.config.ts`
- Modify: `middleware.ts`
- Modify: `app/dashboard/page.tsx`
- Test: `__tests__/architecture/core-go-live-gates.test.ts`
- Test: `__tests__/auth/five-role-dashboard-isolation.test.ts`

- [ ] Write a failing architecture test requiring both independent statuses and classifying missing external RAG staging as RAG-only blocking.
- [ ] Run the test and confirm RED because the new registry is absent.
- [ ] Add the gate matrix and living-audit entries with every required row initially FAIL and evidence placeholders.
- [ ] Run the architecture test and confirm GREEN.
- [ ] Write a failing contract test requiring one role-to-dashboard map and all five landing paths.
- [ ] Run it and confirm RED on duplicated maps.
- [ ] Add `ROLE_DASHBOARD_DESTINATIONS` and migrate the three consumers without weakening API guards.
- [ ] Run targeted auth and middleware tests, then the full unit regression suite.
- [ ] Commit `docs(core): freeze independent go-live gates and role matrix`.

### Task 2: Add expand-and-contract schema

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260906xxxxxx_core_family_academic_planning_expand/migration.sql`
- Test: `__tests__/migrations/core-family-academic-planning-expand.test.ts`
- Test: `__tests__/architecture/core-schema-contract.test.ts`

- [ ] Write failing schema tests for `FamilyRequest`, request children, `Student.academicRevision`, assignment course keys/backfill state, `PlanningSeries`, booking profile relations, booking course/assignment/series fields, override audit fields, and idempotency payload hash.
- [ ] Run tests and confirm RED on missing schema.
- [ ] Add only nullable/additive columns and tables; retain User-based booking FKs and historical `subjects`.
- [ ] Add the Student-profile booking backfill through the existing User relation.
- [ ] Add the Coach-profile booking backfill through the existing User relation.
- [ ] Add profile relation indexes.
- [ ] Add the unique occurrence materialization identity.
- [ ] Add the partial PostgreSQL exclusion constraint for active overlap by `studentProfileId`.
- [ ] Add the unresolved Student identity report query.
- [ ] Add the unresolved Coach identity report query.
- [ ] Add the assignment resolution report query; do not add NOT NULL constraints.
- [ ] Generate Prisma client and run schema/migration contract tests.
- [ ] Rehearse the migration on a fresh disposable database.
- [ ] Commit `feat(core): expand family academic assignment and planning schema`.

### Task 3: Make idempotency payload-aware and harden family HTTP boundary

**Files:**
- Modify: `lib/bilans/api/idempotency.ts`
- Modify: `lib/families/create-family.ts`
- Modify: `app/api/assistante/families/route.ts`
- Modify: `app/api/assistante/students/route.ts`
- Create: `lib/http/strict-origin.ts` if no reusable strict helper fits
- Test: `__tests__/lib/idempotency-payload.test.ts`
- Test: `__tests__/api/assistante.families.http-boundary.test.ts`
- Test: `__tests__/integration/family-idempotency-concurrency.real.test.ts`

- [ ] Write failing tests for same key/same canonical payload replay and same key/different payload `409 IDEMPOTENCY_CONFLICT`.
- [ ] Confirm RED because stored keys have no request hash.
- [ ] Implement stable canonical JSON hashing and compare it on every replay and unique-race recovery.
- [ ] Run targeted idempotency tests and confirm GREEN.
- [ ] Write failing tests for chunked over-limit bodies, invalid/missing same-origin evidence, CSRF, and rate-limit before body read.
- [ ] Confirm RED against the current handler.
- [ ] Apply bounded JSON reading, strict origin, CSRF and actor/source rate limiting to the canonical handler.
- [ ] Give canonical aliases one shared idempotency route coordinate.
- [ ] Run targeted unit and real concurrent tests.
- [ ] Commit `fix(families): harden canonical creation boundary and idempotency`.

## Chunk 2: One family request path

### Task 4: Introduce family requests without creating accounts

**Files:**
- Create: `lib/families/requests.ts`
- Create: `app/api/assistante/family-requests/route.ts`
- Create: `app/api/assistante/family-requests/[requestId]/convert/route.ts`
- Modify: `app/api/bilan-gratuit/route.ts`
- Modify: `app/api/parent/children/route.ts`
- Modify: `components/dashboard/parent/ParentChildrenEmptyState.tsx`
- Modify: parent add-child surfaces found by `rg "Ajouter.*enfant|parent/children"`
- Test: `__tests__/api/family-requests.test.ts`
- Test: `__tests__/api/bilan-gratuit.test.ts`
- Test: `__tests__/api/parent.children.route.test.ts`
- Test: `__tests__/integration/family-request-conversion.real.test.ts`

- [ ] Write failing tests proving bilan and add-child create request rows and zero User/Student rows.
- [ ] Confirm RED because both routes currently create active family records.
- [ ] Implement bounded request parsing for family requests.
- [ ] Add request rate limiting before body parsing.
- [ ] Persist structured request children and consent facts transactionally.
- [ ] Change parent wording to “Demander l’ajout d’un enfant”.
- [ ] Write the failing staff-conversion test.
- [ ] Confirm RED because no conversion route exists.
- [ ] Add staff qualification loading and authorization.
- [ ] Call `createFamily()` or the canonical add-to-household command.
- [ ] Mark the request converted exactly once in the same governed workflow.
- [ ] Test ownership: a parent can view/create only their request; staff can qualify; replay cannot create twice.
- [ ] Run relevant family and parent regressions.
- [ ] Commit `feat(families): route public and parent changes through requests`.

### Task 5: Neutralize generic and stage family writers

**Files:**
- Modify: `app/api/admin/users/route.ts`
- Modify: `app/dashboard/admin/users/**` matching current role controls
- Modify: `app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts`
- Modify: `app/api/assistante/activate-student/route.ts`
- Modify: `lib/services/student-activation.service.ts`
- Test: `__tests__/api/assistante.parent-whatsapp-manual-regression.test.ts`
- Test: `__tests__/api/admin-users.test.ts`
- Test: `__tests__/api/stages.reservations.confirm.route.test.ts`
- Test: `__tests__/lib/services/student-activation.service.test.ts`

- [ ] Write failing tests rejecting generic PARENT/ELEVE creation and all role transitions into or out of family roles.
- [ ] Confirm RED, then add explicit domain-error responses and remove invalid UI choices.
- [ ] Write failing stage tests proving confirmation requires a canonical `Student.id`, preserves payment state, attaches once and rolls back atomically.
- [ ] Confirm RED, then remove system-parent/User/Student creation and implement CAS confirmation.
- [ ] Write failing activation tests requiring atomic state/enrollment/outbox changes and truthful “queued/prepared” wording.
- [ ] Implement the minimal transaction and outbox behavior.
- [ ] Add a parent manual-WhatsApp characterization for phone identity, no staff password and zero WhatsApp/Meta outbox.
- [ ] Add a sensitive-response characterization for punctual `no-store` invitation preparation.
- [ ] Add the activation, phone login and household-confirmation regression.
- [ ] Keep student email activation changes isolated from the parent manual WhatsApp channel.
- [ ] Run admin, stage, activation and family regressions.
- [ ] Commit `fix(core): close parallel family account creation paths`.

## Chunk 3: Canonical academic map

### Task 6: Add atomic revisioned academic command

**Files:**
- Modify: `lib/curriculum/enrollment.ts`
- Create: `lib/curriculum/student-academic-profile.ts`
- Test: `__tests__/lib/curriculum/student-academic-profile.test.ts`
- Test: `__tests__/integration/student-academic-profile-concurrency.real.test.ts`

- [ ] Write the failing test for atomic identity plus chosen-course replacement.
- [ ] Run that test and confirm RED because there is no revision command.
- [ ] Refactor enrollment replacement into a transaction-client core without duplicating validation.
- [ ] Run existing enrollment tests and confirm GREEN.
- [ ] Implement the minimal `updateStudentAcademicProfile` transaction around that core.
- [ ] Run the atomic profile test and confirm GREEN.
- [ ] Write the failing author-provenance test.
- [ ] Add the minimal ADMIN/ASSISTANTE provenance handling and run GREEN.
- [ ] Write the failing stale-revision test.
- [ ] Add the Student revision CAS and stable `ACADEMIC_REVISION_CONFLICT`; run GREEN.
- [ ] Write the failing recalculated-map response test.
- [ ] Return mandatory/specialty/option sections from the same transaction; run GREEN.
- [ ] Write the two-writer real concurrency test.
- [ ] Run it and prove one success and one `ACADEMIC_REVISION_CONFLICT`.
- [ ] Add candidate P1–P12 characterization tests proving existing examination modalities remain intact.
- [ ] Add a test proving ProfilCandidat strings never directly overwrite StudentAcademicEnrollment.
- [ ] Route new explicit candidate course keys through the same revisioned command when a Student link and revision are supplied.
- [ ] Report unmatched historical candidate course declarations for human review without mutating them.
- [ ] Run all curriculum, migration and ARIA academic-access regressions.
- [ ] Commit `feat(curriculum): add atomic revisioned student academic map`.

### Task 7: Expose and render the staff academic map

**Files:**
- Create: `app/api/assistante/students/[studentId]/academic-enrollments/route.ts`
- Modify: `app/api/assistante/students/[studentId]/route.ts`
- Create: `components/dashboard/assistante/StudentAcademicMap.tsx`
- Modify: `app/dashboard/assistante/students/[studentId]/page.tsx`
- Test: `__tests__/api/assistante.student-academic-enrollments.test.ts`
- Test: `__tests__/components/dashboard/assistante/student-academic-map.test.tsx`

- [ ] Write failing API tests for ADMIN/ASSISTANTE success, all other roles denied, `Student.id` only, invalid identity/course keys, provenance and stale revision.
- [ ] Confirm RED because the route is absent.
- [ ] Implement GET/PUT using the command from Task 6.
- [ ] Write failing UI tests for separate read-only mandatory, editable specialties and editable options from the catalog.
- [ ] Confirm RED, then add Scolarité and Enseignements suivis sections.
- [ ] Remove the false `specialties: string[]` page contract and free-text choices.
- [ ] Run targeted API/component and assistante-page tests.
- [ ] Commit `feat(assistante): manage each student academic map`.

## Chunk 4: Course-scoped assignments and ownership

### Task 8: Compute assignable courses and backfill without guessing

**Files:**
- Create: `lib/assignments/allowed-courses.ts`
- Create: `scripts/core/backfill-assignment-course-keys.ts`
- Create: `scripts/core/report-core-migration-state.ts`
- Test: `__tests__/lib/assignments/allowed-courses.test.ts`
- Test: `__tests__/scripts/backfill-assignment-course-keys.test.ts`
- Test: `__tests__/integration/assignment-course-backfill.real.test.ts`

- [ ] Write failing tests for exact one, zero and multiple candidate course keys.
- [ ] Include the Première core-maths plus specialty-maths ambiguity fixture.
- [ ] Confirm RED, then implement the pure intersection using current followed courses and coach capabilities.
- [ ] Implement idempotent reporting/backfill states without selecting ambiguous candidates.
- [ ] Verify report totals and gates on a disposable database.
- [ ] Commit `feat(assignments): derive and audit canonical course scopes`.

### Task 9: Enforce assignment courses in APIs and UI

**Files:**
- Modify: `app/api/assistante/assignments/route.ts`
- Modify: `app/api/assistante/assignments/[id]/route.ts`
- Modify: `app/dashboard/assistante/assignments/page.tsx`
- Modify: `lib/rbac/coach-student-access.ts`
- Modify: `lib/security/ownership.ts`
- Test: `__tests__/api/assistante-assignments.test.ts`
- Test: `__tests__/rbac/coach-student-access.test.ts`
- Test: `__tests__/integration/assignment-concurrency.real.test.ts`

- [ ] Write failing tests for User-id rejection, unknown/not-followed/not-capable course rejection and multiple active concurrent creation.
- [ ] Confirm RED because the API trusts browser subjects.
- [ ] Make POST/PATCH reload Student, current map and CoachProfile, compute allowed keys and persist canonical keys transactionally.
- [ ] Derive legacy `subjects` only for compatibility, never as the authorization source.
- [ ] Populate UI choices from the same allowed-course projection.
- [ ] Write failing RBAC tests proving historical bookings and ended assignments grant no dossier access.
- [ ] Remove both SessionBooking fallbacks and ambiguous Student-id resolution from canonical guards.
- [ ] Run assignment, coach dossier and report regressions.
- [ ] Commit `fix(assignments): enforce academic course scope and active ownership`.

## Chunk 5: Canonical per-child planning

### Task 10: Build planning invariant and availability services

**Files:**
- Create: `lib/planning/identities.ts`
- Create: `lib/planning/effective-availability.ts`
- Create: `lib/planning/invariants.ts`
- Test: `__tests__/lib/planning/effective-availability.test.ts`
- Test: `__tests__/lib/planning/invariants.test.ts`

- [ ] Write failing tests for exact Student/Coach profile IDs, active assignment/course, coach capability and academic map.
- [ ] Write the failing recurring-window availability test and confirm RED.
- [ ] Implement recurring-window resolution and run GREEN.
- [ ] Write the failing validFrom/validUntil test and confirm RED.
- [ ] Add validity-window filtering and run GREEN.
- [ ] Write the failing dated replacement test and confirm RED.
- [ ] Add dated replacement priority and run GREEN.
- [ ] Write the failing negative-blackout test and confirm RED.
- [ ] Add blackout priority and run GREEN.
- [ ] Write failing student overlap tests for start, end, included, enclosing and exact shapes.
- [ ] Implement the shared overlap predicate and run those cases GREEN.
- [ ] Reuse the predicate in a failing coach-overlap test and run GREEN.
- [ ] Add a failing stage-overlap test, implement stage loading and run GREEN.
- [ ] Add transaction-client invariant loading and rerun every planning invariant test.
- [ ] Enumerate allowed admin override codes for non-temporal validation only; reject generic booleans and all ASSISTANTE overrides.
- [ ] Run targeted planning tests.
- [ ] Commit `feat(planning): centralize schedule invariants and availability`.

### Task 11: Materialize governed planning series

**Files:**
- Create: `lib/planning/series.ts`
- Modify: `app/api/assistante/sessions/route.ts`
- Create: `app/api/assistante/planning/series/[seriesId]/route.ts`
- Modify: `app/api/sessions/cancel/route.ts`
- Test: `__tests__/lib/planning/series.test.ts`
- Test: `__tests__/api/assistante.planning-series.test.ts`
- Test: `__tests__/integration/planning-concurrency.real.test.ts`

- [ ] Write failing tests for Africa/Tunis weekly materialization, count/until limits, dual-write identities and idempotent retry.
- [ ] Confirm RED because occurrences are independent.
- [ ] Implement Serializable series creation using Task 10 invariants and dual-write all profile/User identifiers.
- [ ] Persist the canonical assignment and academic course on the series.
- [ ] Persist the series identity and occurrence key on each occurrence.
- [ ] Dual-write Student and Coach User/profile identifiers.
- [ ] Write `creditsUsed=0` explicitly on every new occurrence.
- [ ] Persist enumerated override audit data.
- [ ] Convert DB exclusion/serialization errors to stable 409 responses.
- [ ] Prove concurrent creation produces success=1, conflict=1, double booking=0.
- [ ] Write failing tests for future-only edit/cancel and immutable past occurrences.
- [ ] Implement the series revision comparison.
- [ ] Implement future-only cancellation while preserving past occurrences.
- [ ] Implement future-only edit with idempotent rematerialization.
- [ ] Keep unrelated historical bookings at `planningSeriesId = null`.
- [ ] Run planning, sessions, availability and migration regressions.
- [ ] Commit `feat(planning): add governed recurring sessions per child`.

### Task 12: Switch operational planning routes to canonical identities

**Files:**
- Modify: `app/api/assistante/planning/route.ts`
- Modify: `app/api/sessions/book/route.ts`
- Modify: `app/api/coaches/available/route.ts`
- Modify: `app/api/coaches/availability/route.ts`
- Test: `__tests__/api/assistante-planning.test.ts`
- Test: `__tests__/api/sessions.book.route.test.ts`
- Test: `__tests__/api/coaches.availability.route.test.ts`

- [ ] Write failing route tests requiring public `studentId=Student.id`, `coachId=CoachProfile.id` and explicit User-id names only in internal adapters.
- [ ] Confirm RED on current mixed identity contracts.
- [ ] Switch staff reads/writes to profile IDs and the shared service.
- [ ] Fail the switch if either active/future unresolved-profile counter is non-zero.
- [ ] Keep unresolved completed/cancelled history in a labelled read-only legacy projection.
- [ ] Route any retained parent/student booking through the same assignment/course/conflict invariants.
- [ ] Write the failing unauthorized availability projection test.
- [ ] Restrict the projection to authorized sanitized choices and run GREEN.
- [ ] Write the failing availability-replacement rollback test.
- [ ] Put delete/create replacement in one transaction and run GREEN.
- [ ] Run targeted routes and all session regressions.
- [ ] Commit `refactor(planning): expose canonical student and coach identifiers`.

## Chunk 6: Five dashboard projections

### Task 13: Switch student and parent dashboards to canonical occurrences

**Files:**
- Modify: `lib/dashboard/student-payload.ts`
- Modify: `app/api/student/sessions/route.ts`
- Modify: `app/api/parent/dashboard/route.ts`
- Modify: `app/dashboard/parent/enfant/[studentId]/page.tsx`
- Modify: `app/dashboard/eleve/page.tsx`
- Test: `__tests__/api/student.dashboard.payload.test.ts`
- Test: `__tests__/api/parent.dashboard.route.test.ts`
- Test: `__tests__/integration/parent-cross-child-isolation.real.test.ts`

- [ ] Write failing test: a real SessionBooking is the student next/recent session and legacy Session is ignored for core scheduling.
- [ ] Confirm RED, then switch payload readers.
- [ ] Write failing parent tests for two independent children, future-only ordering, time/course/coach/modality/location/status/series and foreign-child denial.
- [ ] Implement owned per-child projections keyed by Student.id.
- [ ] Render the independent child schedule and academic map.
- [ ] Run student, parent, document and report regressions.
- [ ] Commit `feat(dashboards): show canonical schedules per student and parent child`.

### Task 14: Switch coach, assistante and admin dashboards

**Files:**
- Modify: `app/api/coach/dashboard/route.ts`
- Modify: `app/api/coach/students/[studentId]/dossier/route.ts`
- Modify: `components/dashboard/coach/StudentDossier.tsx`
- Modify: `app/dashboard/assistante/students/[studentId]/page.tsx`
- Modify: `app/dashboard/admin/page.tsx`
- Modify: `middleware.ts` only if an explicit admin operational route exception is required
- Test: `__tests__/api/coach.dashboard.route.test.ts`
- Test: `__tests__/api/coach.students.dossier.route.test.ts`
- Test: `__tests__/api/assistante-student-operational-workflow.test.ts`
- Test: `__tests__/auth/admin-operational-planning-access.test.ts`

- [ ] Write failing coach tests requiring only active assigned Students, allowed course keys and matching SessionBookings.
- [ ] Confirm RED on booking-derived roster and dossier User-id response.
- [ ] Return explicit `studentId` and `studentUserId`; connect all dossier submodules to their declared identity.
- [ ] Add the assistante operational sequence and admin supervision entry without generic family mutations.
- [ ] Define post-assignment policy in tests: no dossier/future planning after ENDED; minimal own historical session metadata only where needed.
- [ ] Run all coach, assistante and admin dashboard regressions.
- [ ] Commit `feat(dashboards): align staff and coach views with active assignments`.

### Task 15: Preserve payment, invoice and no-credit behavior

**Files:**
- Modify only if a failing regression requires it: `app/api/payments/pending/route.ts`
- Modify only if a failing regression requires it: `app/api/payments/validate/route.ts`
- Modify only if a failing regression requires it: `app/api/admin/invoices/route.ts`
- Modify only if a failing regression requires it: `app/api/admin/invoices/[id]/route.ts`
- Modify only if a failing regression requires it: `app/api/invoices/[id]/pdf/route.ts`
- Modify only if a failing regression requires it: `app/api/invoices/[id]/receipt/pdf/route.ts`
- Modify only if a failing regression requires it: `app/dashboard/assistante/paiements/page.tsx`
- Modify only if a failing regression requires it: `app/dashboard/assistante/facturation/page.tsx`
- Modify only if a failing regression requires it: `app/dashboard/parent/factures/page.tsx`
- Modify only if a failing regression requires it: `components/facturation/NexusInvoiceGenerator.tsx`
- Test: `__tests__/architecture/core-planning-no-credits.test.ts`
- Test: `__tests__/api/assistante.sessions.sans-credits.test.ts`
- Test: `__tests__/api/assistante-dashboard-sans-credits.test.ts`
- Test: `__tests__/api/payments.pending.route.test.ts`
- Test: `__tests__/api/payments.validate.route.test.ts`
- Test: `__tests__/api/admin.invoices.route.test.ts`
- Test: `__tests__/api/invoices.pdf.route.test.ts`
- Test: `__tests__/api/invoices.receipt.pdf.route.test.ts`
- Test: `__tests__/app/assistante.facturation.page.test.tsx`
- Test: `__tests__/app/parent-invoices-phone.test.tsx`

- [ ] Add a characterization proving new series occurrences write `creditsUsed=0`.
- [ ] Add a characterization proving scheduling performs no credit balance read or write.
- [ ] Run assistante no-credit navigation and API tests.
- [ ] Run payment validation and completed-revenue tests.
- [ ] Run invoice creation and parent invoice-ownership tests.
- [ ] Fix only observed regressions, each behind an observed failing test.
- [ ] Commit `test(core): preserve payments invoices and retired credits` if evidence or code changed.

## Chunk 7: RAG-independent golden path and release evidence

### Task 16: Prove core makes zero RAG requests

**Files:**
- Create: `__tests__/architecture/core-rag-independence.test.ts`
- Create: `e2e/auth/core-rag-disabled.spec.ts`
- Modify: only core widget entrypoints that currently fail open when RAG env is absent
- Modify: `CORE_GO_LIVE_GATE.md`

- [ ] Write a contract test clearing every RAG variable and importing each core route/dashboard boundary.
- [ ] Add a network recorder assertion for `EXPECTED_RAG_OUTBOUND_REQUESTS=0`.
- [ ] Record a green characterization and make no production change if the boundary is already independent; otherwise confirm the precise RED.
- [ ] Hide or disable those optional widgets without adding `/search` fallback or PR #214 code.
- [ ] Run the core route tests and browser scenario with RAG absent.
- [ ] Record evidence and commit `test(core): prove all critical paths run without RAG`.

### Task 17: Build Golden Family E2E and role isolation

**Files:**
- Create: `e2e/auth/core-golden-family.spec.ts`
- Create: `e2e/helpers/golden-family.ts`
- Modify: `e2e/auth/rbac.dashboards.contract.spec.ts`
- Modify: `CORE_GO_LIVE_GATE.md`

- [ ] Add the synthetic-data namespace and cleanup helper.
- [ ] Add assistante login and family creation; run to the first expected RED.
- [ ] Add parent activation, phone login and household confirmation; run GREEN.
- [ ] Add two academic-map writes; run GREEN.
- [ ] Add two course-scoped assignments; run GREEN.
- [ ] Add two weekly series; run GREEN.
- [ ] Add assistante and admin operational assertions.
- [ ] Add Parent visibility for child A and child B independently.
- [ ] Add Student A isolation, then Student B isolation.
- [ ] Add Coach C1 isolation, then Coach C2 isolation.
- [ ] Add cross-parent and cross-child IDOR denials.
- [ ] Add cross-coach and ended-assignment denials.
- [ ] Add wrong-course and conflicting-schedule denials.
- [ ] Add duplicate-idempotency conflict and replay assertions.
- [ ] Run cleanup and verify zero synthetic rows remain.
- [ ] Run Chromium, Firefox, WebKit, mobile and axe against the disposable environment.
- [ ] Update gate evidence and commit `test(core): add golden family five-role workflow`.

### Task 18: Rehearse migrations against fresh, existing and production-clone databases

**Files:**
- Create: `scripts/core/rehearse-core-migration.sh`
- Create: `docs/audits/2026-09-06-core-migration-rehearsal.md`
- Modify: `CORE_GO_LIVE_GATE.md`

- [ ] Record the approved backup identifier and checksum without its secret path.
- [ ] Record the migration SHA, prior production artifact SHA and candidate SHA.
- [ ] Restore the backup into isolated PostgreSQL without printing credentials or PII.
- [ ] Capture aggregate before-counts for Users and Parents.
- [ ] Capture aggregate before-counts for Students and Enrollments.
- [ ] Capture aggregate before-counts for Assignments and Bookings.
- [ ] Apply all migrations.
- [ ] Run the deterministic Student identity backfill/report.
- [ ] Run the deterministic Coach identity backfill/report.
- [ ] Run the assignment course-key backfill/report.
- [ ] Capture all after-counts and unresolved/ambiguous gates.
- [ ] Repeat the migration on a fresh database.
- [ ] Repeat the migration on a synthetic existing database.
- [ ] Start the prior compatible application artifact against the expanded clone.
- [ ] Read pre-expansion records through the prior artifact.
- [ ] Read and write an expansion-era compatible record through the prior artifact.
- [ ] Record aggregate evidence and commit `docs(core): record migration and rollback rehearsal`.

### Task 19: Full gates, reviews and draft PR readiness

**Files:**
- Modify: `audit_dsahboard.md`
- Modify: `CORE_GO_LIVE_GATE.md`
- Modify: `docs/audits/2026-09-06-core-platform-go-live.md`

- [ ] Run Prisma format/validate/generate and migration drift checks.
- [ ] Run full Jest, integration/DB tests, TypeScript and lint.
- [ ] Run full Playwright Chromium, Firefox, WebKit, mobile and a11y.
- [ ] Run standalone production build and artifact audits.
- [ ] Run repository security, CodeQL/GitGuardian/Cubic CI gates where available.
- [ ] Dispatch specification and code-quality reviews; resolve every actionable P0/P1/P2 and re-review.
- [ ] Push every commit and open/update the draft PR titled `feat(core): close family, academic enrollment and per-child planning go-live`.
- [ ] Mark the PR ready only when all core gates and Golden Family are green.
- [ ] Do not merge until `HUMAN_REVIEW=APPROVED` and required CI is green.
- [ ] After merge only, perform backup verification, exact-artifact canary, private smoke and synthetic production Golden Family cleanup.
- [ ] Record final `CORE_PLATFORM_GO_LIVE_READY` and independent `RAG_FEATURE_GO_LIVE_READY` truthfully.
