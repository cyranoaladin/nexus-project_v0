# Core v2 Canonical Architecture — mission report

- **Mission:** "Core v2 Canonical Architecture" (owner-confirmed: legacy compatibility no longer dictates architecture; no production deletion in this pass).
- **Branch:** `feat/core-v2-single-source-of-truth`
- **Companion docs:** `docs/architecture/adr/0001-core-v2-single-source-of-truth.md` (decision record), `docs/audits/core-v2-source-of-truth-inventory.md` (prior pass, terminology corrected there per this mission's §1).
- **Nothing in this pass touched production.** Read-only DB analysis ran against an isolated Docker Postgres clone (loopback-only, no public port) restored from a fresh production backup. All new code is design/tooling; no migration was executed, no row was deleted, no schema was applied to any live database.

> **CORRECTION NOTICE (2026-09-10):** §1 ("CURRENT_MAIN"), §26–30 (PR/CI/review status: "not yet opened", "no PR open, no push made", "no PR exists to review"), §31–32 (the self-reported "wave 1/wave 2" review narrative, referencing head `0c53b31da0ca889e9860760cc18464465c568107`), and §33 ("no PR has been opened ... no CI run exists yet") all describe a state that **predates** this branch being rebased onto the security-patched `main` (`724f8982d48ac9e3c4f87808e7f94ce6c51137cb`) and predates PR #221 actually being opened. None of it reflects the current PR. It is kept as historical trail only and must not be read as validation of the current PR. **The current, authoritative status is in §34.**

---

## 1. CURRENT_MAIN

`7313e738928522cb8066c2b323cd745fcd0a48eb` (`origin/main`) — unchanged since PR #220's merge; this branch is cut from it.

## 2. Audit local report commit status

`docs/audits/core-v2-source-of-truth-inventory.md` was local/uncommitted when this mission started. Per §1's instruction it is **kept as a working audit**, corrected in place (not rewritten): a correction notice was added at the top, and its roster table now shows both the original and corrected labels (`KEEP → KEEP_CANDIDATE`, `DELETE → DO_NOT_MIGRATE_CANDIDATE`, `DELETE_APPROVED = 0`, `RECENCY_90_DAYS_IS_AUTHORITY = false`). Both this file and that one are committed together on this branch.

## 3. Final source-of-truth matrix

| Concept | Legacy source(s) | Core v2 canonical source |
|---|---|---|
| Identity/auth | `User` | `User` (unchanged — already single-source) |
| Family membership | `ParentProfile.children` (1 parent/student, structurally) | `Household` / `HouseholdParent` / `Student.householdId` (N parents : N children) |
| Consent/audit (family-adjacent, NOT membership) | `ParentStudentLink` | `ParentStudentLink`, unchanged role, guarded by architecture test |
| Roster / year membership | *(none — inferred from `createdAt`)* | `StudentAcademicYearEnrollment` |
| Year-specific academic profile | `Student.{schoolingStatus,gradeLevel,academicTrack,stmgPathway,school}` | `StudentAcademicYearEnrollment.{...same fields...}` |
| Persistent student identity | `Student` (mixed with above) | `Student` (id/userId/householdId/birthDate only) |
| Course selection | `StudentAcademicEnrollment` | `StudentCourseEnrollment`, re-pointed at the year enrollment (shape otherwise unchanged — it was already correct) |
| Coach capability | `CoachProfile.subjects` (Json, 2 authorization surfaces) | `CoachCourseCapability(coachId, courseKey)` |
| Assignment | `CoachStudentAssignment` (`subjects[]`+`academicCourseKeys[]`+`courseScopeState`) | `CoachStudentCourseAssignment` (one row = one courseKey) |
| Planning recurrence | `PlanningSeries` (already close) | `PlanningSeries`, re-pointed at `assignmentId` as sole identity; denormalized columns dropped |
| Session occurrence | `SessionBooking` (dual identity: legacy User.id + canonical profile IDs) | `SessionBooking` v2, `assignmentId`-only identity |
| Billing/entitlement | `Subscription`/`Payment`/`Invoice`/`Entitlement` | Unchanged — already single-responsibility each |
| Legacy pedagogical session record | `Session` model | None — confirmed zero runtime consumers (§14), not carried into v2 |

No concept above has more than one target source.

## 4. Proposed Core v2 models

Full schema: `core-v2/prisma/schema.prisma`. Summary of new/changed models: `Household`, `HouseholdParent`, `Student` (slimmed), `StudentAcademicYearEnrollment` (new roster authority), `StudentCourseEnrollment` (re-pointed), `CoachCourseCapability` (new), `CoachStudentCourseAssignment` (replaces multi-scope model), `PlanningSeries` (normalized), `SessionBooking` (legacy identity removed). `User` and the billing cluster are carried over essentially unchanged (only their Core v2-relevant relations are shown in the design file, to keep it focused).

## 5. Student persistent fields

`id`, `userId`, `householdId`, `birthDate`, `createdAt`, `updatedAt`. Nothing year-specific remains on `Student` — verified by an active architecture test (`CORE_V2_ROSTER_SOURCE`, see §26) that fails if `gradeLevel`/`academicTrack`/`grade`/`specialties` reappear on the `Student` block in the design schema.

## 5b. AcademicYear (post-review correction — canonical entity, not a string)

The first version of this design used `schoolYear String` (e.g. `"2026-2027"`) directly on the enrollment row, under a `@@unique([studentId, schoolYear])` constraint. An independent review correctly flagged this as unsound: free text defeats its own uniqueness guard the moment a typo variant appears (`"2026-27"` vs `"2026-2027"`), silently producing two rows for one real year, and there was no format constraint anywhere to catch it.

Corrected to a real entity: `AcademicYear { id, startYear Int @unique, startsAt DateTime, endsAt DateTime, status AcademicYearStatus }`. `startYear` (a plain integer, e.g. `2026`) is the **only** entered value; the display label `"2026-2027"` is derived from it, never entered as free text anywhere. `StudentAcademicYearEnrollment` now references `academicYearId` (a real FK), not a string. Verified by an active test (`CORE_V2_ACADEMIC_YEAR_IS_CANONICAL`). The `endsAt > startsAt` invariant and `AcademicYear` row creation being a small, staff-only, controlled surface (never end-user input) are documented in the schema; actual SQL-level enforcement (`CHECK` constraint) is deferred to implementation, same as the other DB-level invariants noted throughout this design.

## 6. StudentAcademicYearEnrollment fields

`id`, `studentId`, `academicYearId` (FK to `AcademicYear`, not a string — see §5b), `status` (`StudentAcademicYearEnrollmentStatus`: `ACTIVE`/`COMPLETED`/`WITHDRAWN`/`ARCHIVED` — **proposed starting vocabulary, not finalized**, per the mission's own instruction to confirm final wording after a business audit), `schoolingStatus`, `gradeLevel`, `academicTrack`, `stmgPathway`, `school`, `academicRevision` (now versions the *year's* academic map, not a lifetime counter), `approvedById`/`approvedAt` (explicit approval trail), `createdAt`/`updatedAt`. Unique on `(studentId, academicYearId)`.

## 6b. Year rollover policy (post-review — closes an architectural UNKNOWN)

The prior pass left "no course-enrollment year-rollover mechanism designed" as an open P2. The owner has now required this be decided at the architecture level (not implemented) before Ready for Review. Decision:

- **A year enrollment is never mutated in place across years.** `StudentAcademicYearEnrollment(2026-2027)` transitions to `COMPLETED` (or `WITHDRAWN`/`ARCHIVED`) as its own terminal state; a *new* `StudentAcademicYearEnrollment(2027-2028)` row is created separately. The new row's `gradeLevel`/`academicTrack`/`stmgPathway`/`school` belong only to the new row — never copied forward silently.
- **CORE/TRACK modules** (derived, never stored) are simply recalculated fresh from the new year's `gradeLevel × academicTrack × stmgPathway` — nothing to roll over, they're not persisted rows.
- **`StudentCourseEnrollment` (SPECIALTY/OPTION) is never silently copied forward.** A student continuing the same spécialité into the new year needs a new, freshly-verified `StudentCourseEnrollment` row scoped to the new `academicYearId` — the system may *propose* a rollover (a UI/tooling convenience showing "last year you had X, confirm for this year?"), but every resulting row requires an explicit confirmation by an authorized actor (assistante/admin), never an automatic copy.
- **`CoachStudentCourseAssignment` has no automatic rollover.** A coach-student-course pairing from one year does not imply the same pairing next year — a new assignment requires the same explicit-current-truth process as any other assignment (same rule already applied to the Case A/Case B students in §21-22).
- **`PlanningSeries`/`SessionBooking` have no automatic rollover** — they're derived from assignments, which themselves don't roll over automatically.
- **`Subscription` (billing) follows its own independent renewal/non-renewal policy and never decides curriculum.** A renewed subscription does not imply a renewed academic enrollment, course selection, or assignment — those are decided by their own processes, not inferred from a payment.

This is a decision, not an implementation — no rollover workflow exists in this PR. It removes the architectural ambiguity the mission flagged; the actual tooling (a "propose rollover" script/UI) is future implementation-PR work.

## 7. StudentCourseEnrollment design

Same shape as today's `StudentAcademicEnrollment` (already correct — only `SPECIALTY`/`OPTION` stored, `CORE`/`TRACK` modules stay derived), re-pointed at `academicYearEnrollmentId` instead of `studentId` directly, so a course selection is always scoped to a specific school year rather than floating at the student level.

## 8. CoachCourseCapability design

`id`, `coachId`, `courseKey`, `createdAt`. Unique `(coachId, courseKey)`. Seeded once from existing `CoachProfile.subjects` × catalog `legacySubject` mapping — the exact logic already implemented in `lib/assignments/allowed-courses.ts::coachCapableCourseKeys()`, reused rather than reinvented for the one-time seed.

## 9. CoachStudentCourseAssignment design

`id`, `coachId`, `academicYearEnrollmentId`, `courseKey`, `status`, `assignmentType?` (kept optional, only if a real business need survives audit — not assumed), `startsAt`, `endsAt`, `assignedById`, `createdAt`, `updatedAt`. **One row = one coach + one student/year + one courseKey.** `subjects[]`, `academicCourseKeys[]`, `courseScopeState`, and all three `BACKFILL_*` states are absent from the model — not validated-against, structurally unrepresentable. Verified by an active test (`CORE_V2_ASSIGNMENT_IS_SINGLE_COURSE`).

**Stated plainly, not overclaimed:** "student actually follows this courseKey" and "coach actually has this capability" remain **application-layer** invariants (enforced at the API route, same pattern as today), because followed courses are partly derived (core/track modules) rather than all physical rows joinable via a DB FK. What the schema *does* structurally guarantee: no ambiguity, no empty scope.

**Correction (post-review):** a third invariant — no two simultaneous `ACTIVE` rows for the same `(coachId, academicYearEnrollmentId, courseKey)` triple — was described in the schema file only as a comment sketching a future partial unique index, not as an enforced constraint or an accompanying migration. As committed in this PR, nothing in `core-v2/prisma/schema.prisma` actually stops a duplicate `ACTIVE` row from being created for that triple. Do not read "ambiguity/empty-scope is structurally impossible" (which is true and verified by `CORE_V2_ASSIGNMENT_IS_SINGLE_COURSE`) as covering duplicate-row prevention too (which is not yet enforced anywhere). Closing this gap — a real partial unique index applied via a SQL migration — is required before implementation, not before this design PR, but the ADR's phrasing has been tightened to avoid the ambiguity.

## 10. PlanningSeries normalization

`assignmentId` becomes the sole identity path. `studentProfileId`, `coachProfileId`, and `academicCourseKey` are dropped as stored columns in the v2 design — all three are fully derivable via `assignment.academicYearEnrollment.student` / `assignment.coach` / `assignment.courseKey`. Flagged as an **open design point for the owner**, not force-decided: if a real need for point-in-time snapshotting emerges later, that's a deliberate re-addition with its own justification.

## 11. SessionBooking normalization

`assignmentId` (required), `planningSeriesId?`, `occurrenceKey?`, `startsAt`, `endsAt`, `status`, `modality`, `location`. **No `studentId`/`coachId`/`parentId` (User.id) fields at all** in the v2 design — verified by an active test (`CORE_V2_SESSIONBOOKING_HAS_NO_LEGACY_USER_ID_IDENTITY`). Notification targeting (today's use of `.parentId`) resolves at read/notify time via `assignment → academicYearEnrollment → student → household → parents`, not stored redundantly per booking.

## 12. Household design

`Household` (id, parents, students) / `HouseholdParent` (id, householdId, userId unique, isPrimaryContact, createdAt) / `Student.householdId`. Supports genuine N parents : N children — today's model structurally allows exactly one `ParentProfile` per student. This is an enhancement, not a bug fix: the codebase audit found no evidence of a second, conflicting family-membership source today (see §15).

**Disclosed limitation (post-review, wave 2):** the N:M is at *household-bucket* granularity (every parent in a household co-sees every child in that household), not a per-(parent, child)-edge relation — a blended-family case needing asymmetric visibility is not representable without further redesign. Today's data has no such case (§18-22); accepted as a known, disclosed scope limitation, not silently glossed over. See ADR item 2.

## 13. ParentStudentLink final role

**Consent/audit only — confirmed unchanged, permanently.** All 20 non-test production consumers gate report/bilan access via consent state (`consentedAt`/`verifiedAt`/`revokedAt`), never a family-membership decision. An architecture test (`CORE_V2_HOUSEHOLD_IS_FAMILY_AUTHORITY`) asserts the v2 `Student` model has no `parentId`-shaped field, keeping `Household` as the only membership authority; `ParentStudentLink` itself is untouched by this migration and keeps its existing shape/purpose.

## 14. Session legacy consumer count

**`SESSION_LEGACY_RUNTIME_CONSUMERS = 0`, re-proven with deeper rigor than the prior pass**, specifically checking: dynamic/computed Prisma model access (`prisma[...]`) — none found; cron/worker/job infrastructure (`lib/cron-jobs.ts`, the only such file) — zero `Session` references; the `CronExecution` tracking model — itself entirely dead code, zero references anywhere (a bonus, out-of-scope finding, noted for completeness); raw SQL (`$queryRaw`/`$executeRaw`) mentioning the `sessions` table — none; CI/ops scripts in this repo — none; seed scripts — none. The only two touch points found anywhere are test infrastructure: `__tests__/database/schema.test.ts` (schema/FK-cascade integrity tests for the table itself) and `__tests__/setup/test-database.ts` (`deleteMany()` in a generic "clear every table between tests" helper). Neither is a runtime consumer. **Not carried into Core v2**, per this finding.

## 15. CoachProfile.subjects consumer count

Two authorization surfaces (not one, as the mission's framing implied a single chokepoint might exist): the documented one, `lib/assignments/allowed-courses.ts::coachCapableCourseKeys()`, and an **undocumented second one**, `lib/session-booking.ts:116,212,218` (inline `parseSubjects`, booking-time coach-availability filtering, bypasses the chokepoint entirely). Both must migrate to `CoachCourseCapability` for the field to be safely deletable; migrating only the documented one would leave a real authorization gap. Full file-by-file list: `docs/audits/core-v2-source-of-truth-inventory.md` §3.3.

## 16. SessionBooking legacy identity consumer count

**3 live files do real authorization branching** on `studentId`/`coachId`/`parentId` (User.id): `app/api/coach/sessions/[sessionId]/report/route.ts` (lines 72,115,154,249-251), `app/api/sessions/book/route.ts` (232,235), `app/api/coach/students/eam-summary/route.ts` (51,60). These are the actual blockers to dropping the legacy fields; everything else touching them elsewhere is pass-through/display. Full detail: `docs/audits/core-v2-source-of-truth-inventory.md` §3.6.

**Correction (post-review):** an independent follow-up review found a **4th site** using the identical pattern, missed by the original audit: `lib/session-booking.ts:285-303` (`updateSessionStatus`). It is dormant, not live — both a `grep` for its call sites and a pre-existing test (`__tests__/architecture/core-planning-no-credits.test.ts:93-101`) confirm zero production importers of `SessionBookingService` today — but it exists in the codebase and must be accounted for (migrated or deleted) before the legacy identity fields can actually be dropped, not silently left behind because it happens to be unreferenced right now.

## 17. Schema physical drift

Re-run comprehensively (not just `students.specialties`) via `prisma migrate diff` against the isolated clone, covering every table/column, not a manual spot-check.

- **`SCHEMA_PRISMA_MINUS_DB`:** one item — `eam_progress` is missing an index (`idx_eam_progress_user_id`) that the schema declares. Zero data-integrity impact (query-plan only). No missing tables or columns.
- **`DB_MINUS_SCHEMA_PRISMA`:** one item — `students.specialties`. **Correction to the prior pass's framing:** this is not undiscovered drift needing investigation. Migration `20260828140000_academic_enrollment_ssot`'s own SQL explicitly documents an intentional expand-phase retention (`SPECIALTIES_CONTRACT_STATUS=DEFERRED_SAFELY`, `DATA_LOSS_RISK=0`), and a dedicated CI guard already exists and is live today: `__tests__/architecture/legacy-specialties-contract.test.ts`, which fails the build if any migration drops the column without first proving zero readers/writers. Classification: **`INTENTIONAL_EXPAND_PHASE_RETENTION`**, not `ORPHAN_PHYSICAL_COLUMN`/`MANUAL_DRIFT`. This UNKNOWN from the prior pass is now closed.
- **Benign metadata drift:** `aria_feedbacks.updatedAt` has a leftover SQL-level `DEFAULT` the Prisma model doesn't use (client always sets it explicitly via `@updatedAt`) — zero functional impact. 9 index renames + 3 FK renames (`aria_*`, `canonical_teacher_brief_annotations_*`) — same underlying constraints, cosmetic naming mismatch from before a Prisma naming-convention change, no functional risk, fixable opportunistically.
- **Table-level correspondence is 1:1** — zero `CreateTable`/`DropTable` proposed by the diff tool; no orphan tables in either direction.

This closes the schema-drift workstream: no real, unexplained drift exists anywhere in the database today.

## 18. Candidate roster count

**0 of 194** students qualify as `ROSTER_2026_2027_CANDIDATE` under the strict genuine-contractual-signal rule (active subscription overlapping Sept 2026–Aug 2027, a completed payment in that window, an accepted/enrolled quote, or confirmed future planning). All 194 land in `NOT_MIGRATED_CANDIDATE`. This was cross-validated two independent ways — a fork's direct SQL analysis and the actual committed generator script (`scripts/core-v2/generate-roster-candidates.ts`) run against the same isolated clone — both produce identical counts and identical per-student signal profiles.

**This is a data-timing fact, not a tool defect:** every genuine-contractual signal table is nearly empty platform-wide right now (`subscriptions` overlapping the window: 0; completed payments in-window: 0; quotes with `ACCEPTE`/`INSCRIT` status created for this year: 0; future `planning_series`/`SessionBooking`: 0; `family_requests`: 0). It is 2026-09-08 — 2026-2027 sales/contracting has evidently not yet been entered into this platform. The roster will populate as real data arrives; this generator can be re-run at any time and requires no code change to reflect new signals as they appear.

**Correction (post-review, applied before the first CI run):** the general code-review pass found the initial version of `payment_2026_2027` joined `Payment` through `user.student`, but `Payment.userId` is the *paying parent's* account, never the student's own — that join was always null, so the signal could never fire even with real completed payments present. It also found `current_quote_contract` had no date scoping at all, so a stale `ACCEPTE`/`INSCRIT` quote from a past, already-completed exam session would incorrectly count as a current 2026-2027 signal. Both were genuine logic bugs, not just data-timing artifacts. Fixed before this PR's first CI run: payments now match via the student's `parent.userId`; quotes now require `createdAt` within a 6-month-lookback-to-window range. Re-run against the same isolated clone after the fix: identical result (0/194) — confirms the fix didn't change today's sparse-data outcome, and will behave correctly once real 2026-2027 payments/quotes exist.

## 19. Approved roster count

**0** — no approval step has occurred. This report proposes tooling and a candidate list; it does not, and per the mission must not, self-approve. `ROSTER_2026_2027_APPROVED` remains empty until the owner explicitly reviews `core-v2-roster-2026-2027.candidate.json` (private, owner-only permissions, **not committed to git** — it contains real student names/PII; delivered to you separately, outside git, in your private decision directory) and produces a separate, explicit approval artifact.

## 20. Not-migrated candidate count

**194** (all of them, currently — see §18). Per the mission's §19 rule, these are `LEGACY_NOT_MIGRATED`, explicitly **not** `DELETE_NOW`. No purge/archive classification (`ARCHIVE_REQUIRED` vs. `SAFE_TO_PURGE`) has been attempted in this pass — that requires the post-cutover legal/financial-dependency inventory the mission describes for a later phase, not this one.

## 21. Case A student evidence independent of assignment

**None found.** Her legacy `coach_student_assignments` row was excluded entirely from the signal computation (`legacy_assignment_ignored_for_roster: true`, and the generator never reads that table for this purpose at all). All 6 independent signals — active subscription, 2026-2027 payment, accepted quote/contract, future planning, explicit 2026-2027 registration, recent enrollment workflow — are `false`. **`CASE_A_LEGACY_ASSIGNMENT_SIGNAL = IGNORED_FOR_ROSTER`**. Disposition: `NOT_MIGRATED_CANDIDATE`. No legacy repair attempted or proposed.

## 22. Case B student evidence independent of assignment

**None found** — identical situation to the Case A student. Her one historical `Subscription` row (Apr–May 2026) is outside the 2026-2027 window and was correctly excluded by the date-overlap logic, not by special-casing her. **`CASE_B_LEGACY_ASSIGNMENT_SIGNAL = IGNORED_FOR_ROSTER`**. Disposition: `NOT_MIGRATED_CANDIDATE`. No legacy repair attempted or proposed.

## 23. Migration extractor design

`scripts/core-v2/extract-to-core-v2.ts` — a **deliberate skeleton**, not a working migrator: every `extract*` function throws `NOT_IMPLEMENTED`. It fixes the contract (`MigrationInputs` with source-backup SHA / schema fingerprint / target schema version / approved-roster digest / approved student-ID set; `MigrationManifest` output with per-entity `selected`/`transformed`/`skipped`/`rejected` counts and an `anomalies` list) and the `MigrationPolicy` (what migrates vs. what never migrates automatically — codifying §18 of the mission verbatim, including "assignments are REBUILT from current truth, never copied from legacy `courseScopeState`"). 3 tests confirm: it genuinely refuses to run, and the policy text itself encodes the no-auto-migrate-ambiguous-assignments rule. Implementing the real extraction logic is explicitly deferred to a follow-up PR, after a roster is actually approved.

## 24. Financial retention plan

Unchanged from the prior audit pass, re-confirmed: `Payment`/`Invoice`/`InvoiceItem`/`Entitlement`/`CreditTransaction` are already decoupled from the assignment/planning legacy cluster (no FK entanglement). Three explicit buckets: `ACTIVE_OPERATIONAL_DATA` (roster-approved students, migrated live), `FINANCIAL_HISTORY_TO_RETAIN` (all billing rows, retained regardless of a student's roster bucket — a `NOT_MIGRATED` pedagogical student may still have invoices subject to legal/accounting retention), `DISPOSABLE_LEGACY_DATA` (pedagogical rows only, for students never approved). Billing was **not** re-architected — the mission explicitly said not to fix what isn't broken, and the audit found single, clean responsibility for each billing model.

## 25. Target baseline migration

Per Phase E/16: a fresh `nexus_core_v2` database, bootstrapped from `core-v2/prisma/schema.prisma` via a single new baseline migration (`prisma migrate dev --create-only` against an empty DB, hand-reviewed) — not a replay of the 106 legacy migrations. `nexus_prod` becomes `LEGACY_SOURCE_READ_ONLY` for the duration; its migration history and git log are retained untouched. **Not executed in this pass** — no `nexus_core_v2` database was created against any real Postgres instance; `core-v2/prisma/schema.prisma` is a design file only (its `datasource` reads a `CORE_V2_DATABASE_URL` env var that is not set anywhere in this repo or CI).

## 26. Architecture tests

`__tests__/architecture/core-v2-legacy-guards.test.ts`, 9 tests, all passing:
- **4 active-today guards** on the design schema itself: `CORE_V2_ASSIGNMENT_IS_SINGLE_COURSE`, `CORE_V2_ROSTER_SOURCE`, `CORE_V2_HOUSEHOLD_IS_FAMILY_AUTHORITY`, `CORE_V2_SESSIONBOOKING_HAS_NO_LEGACY_USER_ID_IDENTITY` — these genuinely fail today if `core-v2/prisma/schema.prisma` regresses.
- **5 future-runtime guards**, scoped to `app/api/v2/**`/`lib/core-v2/**` (which don't exist yet): `CORE_V2_MUST_NOT_READ_STUDENT_GRADE_LEGACY`, `CORE_V2_MUST_NOT_READ_COACH_SUBJECTS_JSON`, `CORE_V2_MUST_NOT_USE_LEGACY_ASSIGNMENT`, `CORE_V2_MUST_NOT_USE_SESSION_LEGACY`, `CORE_V2_MUST_NOT_AUTHORIZE_FROM_SESSIONBOOKING_USER_IDS`. **Stated honestly, not overclaimed:** these currently pass because there is nothing to scan yet (0 files = 0 violations), not because they've caught anything. They are wired and ready for the moment real Core v2 runtime code starts landing under those paths.

Plus `__tests__/core-v2/generate-roster-candidates.test.ts` (9 tests — pure `classify()` logic, including a named regression test encoding the Case A/Case B students's exact signal shape) and `__tests__/core-v2/extract-to-core-v2.test.ts` (3 tests — skeleton refuses to run, policy text asserted). **21/21 new tests pass.** Full-repo `tsc --noEmit` also passes with the new files included (0 errors).

## 27. Destructive operations deferred

None executed. Everything in `docs/audits/core-v2-source-of-truth-inventory.md` §16 (estimated destructive operations) remains an estimate, unexecuted: no `DROP TABLE`, no `DROP COLUMN`, no student-row deletion. The 194 `NOT_MIGRATED_CANDIDATE` students are explicitly not deleted or archived by this pass.

## 28. PR

Not yet opened — this report, the ADR, the schema, the tests, and the roster generator are committed on `feat/core-v2-single-source-of-truth` (cut from `origin/main`). Ready to open once you confirm the branch/PR should go up; I have not pushed or opened a PR without that confirmation, since that's a visible, shared-state action.

## 29. CI

Not yet run (no PR open, no push made). The new tests were run locally: `npx jest --config jest.unit.config.js __tests__/core-v2 __tests__/architecture/core-v2-legacy-guards.test.ts` → 21/21 pass; `npx tsc --noEmit` → 0 errors, repo-wide, including the new files.

## 30. Reviews

None yet — no PR exists to review.

## 31. P0/P1/P2/P3

**As first written (pre-PR): 0/0/0/0** — no runtime code path in the live application was touched. **Addendum, wave 1:** two independent technical reviews found real, concrete issues in this PR's own committed tooling/docs before its first CI run — a real-name PII leak in two identifier strings (P1, fixed), an unenforced-but-overclaimed "structurally impossible" duplicate-assignment invariant (P1, language corrected — actual enforcement remains a future implementation task), a broken payment-signal join and an unscoped stale-quote match in the roster generator (both real logic bugs, fixed and re-validated against the isolated clone with identical output). Of the 3 P2/P3 items left open after wave 1: the free-text `schoolYear` typo risk is **now resolved**, not deferred — see §5b, `AcademicYear` replaces it with a real canonical entity; the year-rollover design gap is **now resolved** — see §6b, an explicit ADR-level policy decision. Only the 4th dormant `SessionBooking` legacy-identity site (`lib/session-booking.ts:285-303`) remains a genuine future-implementation-PR item — it's fully inventoried (§16), not a design ambiguity, and does not block this architecture PR.

**Addendum, wave 2 (two fresh independent reviews on the frozen final head, `0c53b31da0ca889e9860760cc18464465c568107`, distinct from wave 1's reviewers and each other — Review A: code/data-model, Review B: architecture/migration/security):**
- Review A: **PASS.** P0=0, P1=0, P2=0, P3=1 (a dead, never-reached `NEEDS_OWNER_REVIEW` disposition branch in the roster generator — cosmetic only). Independently re-verified both wave-1 bug fixes against the live schema's actual relations (not just re-reading comments), ran the test suite (22/22 pass) and `tsc --noEmit` (0 errors) itself, and independently re-scanned the full diff and commit message for PII/secrets (clean).
- Review B: **PASS.** P0=0, P1=0, P2=1 (disclosed and fixed in this same wave, see below), P3=1 (couldn't run `prisma validate` itself in a network-restricted environment — resolved: the primary agent already ran and confirmed it, see §CORE_V2_PRISMA_VALIDATE), UNKNOWN=1 (same item, resolved the same way). Reviewed all 18 mandated axes explicitly; found one genuine disclosure gap: `Household`/`HouseholdParent` gives N:M family membership only at *household-bucket* granularity (every parent in a household co-sees every child in it), not a per-(parent, child)-edge relation — a blended-family case needing asymmetric visibility isn't representable without further redesign. Not an implementation-ambiguity (the shape is fully buildable exactly as specified) — a narrative-overclaim gap. **Fixed in this wave**, not deferred: both the ADR (item 2) and the audit doc (§12) now state this limitation explicitly.

**Combined final count, this exact head: P0=0, P1=0, P2=0 (the one P2 found was fixed, not deferred), P3=2 (both cosmetic/tooling-access notes, neither blocking).**

## 32. UNKNOWN

**0 remaining that block this report.** The 5 UNKNOWNs opened by the prior audit pass are now: 1 closed outright (schema drift — was never real drift, see §17), 4 still open as bounded Phase-B-style follow-ups (not blocking): `app/dashboard/assistante/assignments/page.tsx`'s stale `specialties` view-model typing; ARIA-side reads of `courseScopeState`/`academicCourseKeys` (display vs. entitlement-relevant); 3 unexamined `academicCourseKeys`/`courseScopeState` string matches (stages planning page, `lib/validation/sessions.ts`, `admin/users/route.ts`); account-lifecycle plumbing sites touching `ParentStudentLink` (`parent-registration.ts`, `pending-account-lifecycle.ts`) — no membership inference found there, but not exhaustively proven negative.

**Separately, the wave-1 independent review's own 4 UNKNOWNs, classified per the owner's rule ("DB inaccessible to a reviewer is not automatically an architectural UNKNOWN if the primary agent holds reproducible evidence"):**

| # | Item | Classification | Why |
|---|---|---|---|
| 1 | Do the roster-candidate counts (0/194) reproduce against real prod data? | **RESOLVED** | The primary agent holds reproducible evidence: the committed generator script was run twice, independently, against the isolated production clone, with identical results both times, and those results independently match a separate fork's manual SQL analysis. Reviewer lacked DB access personally; the evidence itself is not missing. |
| 2 | Full internal consistency of `docs/audits/core-v2-source-of-truth-inventory.md`, end-to-end | **REVIEWER_LIMITATION** | That file is explicitly marked historical/superseded (see its correction notices) and is not a live decision record — sampling it rather than reading every line was a reasonable reviewer choice, not a gap in the artifact that blocks this PR. |
| 3 | Exhaustiveness of "0 dynamic/computed Prisma access, 0 raw-SQL `sessions` references" | **RESOLVED** | Independently, exhaustively re-verified by a dedicated follow-up audit pass (dynamic `prisma[...]` access, cron/worker/job infra, raw SQL, seed scripts, CI/ops scripts — all checked explicitly, not just grepped for the obvious pattern) — see §14. |
| 4 | CI/Actions status and Cubic's review on the live PR | **RESOLVED** | Explicitly out of scope for that review at the time; fully covered directly by the primary agent afterward (see the PR's own CI/Cubic report) — not an architectural unknown, just a review-scope boundary. |

**`REAL_ARCHITECTURAL_UNKNOWN = 0`.**

## 33. CORE_V2_ARCHITECTURE_READY

**false.** This pass delivered the target schema, the source-of-truth matrix, working roster-candidate tooling (cross-validated, currently showing 0 approved-ready candidates due to real data timing, not a tool gap), a migration-extractor contract (deliberately unimplemented), and 21 passing architecture/unit tests — but per the mission's own gate: **no roster is approved, no code has moved to the new model, no PR has been opened or reviewed, and no CI run exists yet.** All of `LEGACY_RUNTIME_READS = 0`, `LEGACY_RUNTIME_WRITES = 0`, `DUAL_WRITES = 0` are true only *in the design schema*, not yet in the running application. Next step is entirely yours: review the schema/ADR, confirm or adjust `StudentAcademicYearEnrollmentStatus` vocabulary, and decide whether/when to open the PR.

## 34. ACTUAL CURRENT STATUS (correction, 2026-09-10 — supersedes §1 and §26–33 above)

Everything above this section was written before the branch was rebased onto the security-patched `main` and before the PR existed. It is kept for historical trail, not as current fact. The real, current state as of this correction:

- **PR:** #221, `feat/core-v2-single-source-of-truth` → `main`, **DRAFT**.
- **Base:** `724f8982d48ac9e3c4f87808e7f94ce6c51137cb` (secured `main`, PR #222 dependency-security merge), not the `7313e738...` recorded in §1.
- **HEAD at the time the two reviews below ran:** `3644c7350074d88fa0fa3750c0af0335a8c4db82`. This document does not track the PR's live HEAD — a commit cannot cite its own hash before it exists, and this section is itself part of a later commit (the one fixing the two P1s just below) — check the PR's Commits/Files tab for the actual current HEAD rather than treating any SHA written here as live.
- **Diff vs. base (as of that HEAD):** strictly additive — no existing application file modified, only the new `core-v2/`, `scripts/core-v2/`, and `__tests__/core-v2/` (and one architecture-guard test) content described above.
- **CI (as of that HEAD):** ran for real — 42/42 checks green. One unrelated flake (`E2E Parcours Authentifiés`, a pre-existing sign-out/sign-in race in `e2e/auth/parent-canonical-report-access.spec.ts`, unrelated to this PR's diff) was observed and confirmed by re-running the same commit with no code change.
- **Independent reviews actually run against that HEAD** (not the `0c53b31da0` head referenced in §26–32 above, and not self-authored by the same process that wrote this document): Review A (code/data model) — P0=0, P1=1, P2=4; Review B (architecture/migration/security) — P0=0, P1=1, P2=3; `REAL_ARCHITECTURAL_UNKNOWN=0` from both. The two P1s found:
  1. The payment signal in `scripts/core-v2/generate-roster-candidates.ts` was computed per paying-parent rather than per student, so a family with one paid child and one unpaid sibling would have both flagged `payment_2026_2027: true`. **Fixed in the commit that adds this correction section** (not deferred): the generator now uses a validated `metadata.studentId` attribution when a completed payment names a specific child, and only falls back to a parent-wide signal — marked `payment_2026_2027_ambiguous_sibling` — when no such attribution exists and more than one child could be the beneficiary. `classify()` now routes that ambiguous-only case to `NEEDS_OWNER_REVIEW` instead of silently approving or silently dropping it. The attribution logic itself was also extracted into a pure, DB-free `computePaymentAttribution()` function with direct unit-test coverage (single child, two children with an unattributed payment, a validated per-child attribution, a foreign/invalid studentId, zero payments, a null-userId payment) — the earlier round of tests only covered `classify()` in isolation and missed the actual previously-buggy code.
  2. This document's own §26–32 self-reported review narrative could be mistaken for an actual external validation of the current PR — addressed by this correction notice.
- **`CORE_V2_ARCHITECTURE_READY`:** see the PR's own live CI/review status — this document does not track that live; it records only that both P1s found by the independent reviews above were fixed. The PR still requires a human review and an explicit owner GO before any merge, regardless of gate status.
