# Core family, academic enrollment and per-child planning design

## Date

2026-09-06

## Objective

Make the five-role Nexus core operational without any RAG dependency. The critical path is authentication, staff-created families, parent activation, per-child academic maps, course-scoped coach assignments, per-child planning, and strictly owned dashboard projections.

`CORE_PLATFORM_GO_LIVE_READY` and `RAG_FEATURE_GO_LIVE_READY` are independent gates. Missing RAG configuration or staging blocks only the RAG feature.

## Git boundary

The work lives on `feat/core-go-live-family-academic-planning-20260906`, created from `origin/main` at `95f518e3112636a2d01c6feea06e261150efd446`.

PR #214 and commit `da59f70c38db08d1e23ae3f4bada3c6d269de1c5` are not ancestors of this branch. This work must not implement or modify the RAG v2 client contract.

## Public identities

- `studentId` always means `Student.id`.
- `studentUserId` always means the student's `User.id`.
- `coachId` always means `CoachProfile.id`.
- `coachUserId` always means the coach's `User.id`.

Historical `SessionBooking.studentId` and `SessionBooking.coachId` remain User foreign keys during this PR. Expand-and-contract adds nullable `studentProfileId` and `coachProfileId`, backfills them deterministically from the existing User relations, dual-writes all new occurrences, switches readers to the profile fields, and reports unresolved rows. No historical relationship is invented and no old field is dropped.

## Family boundary

`lib/families/create-family.ts` remains the sole domain writer of the `User parent + ParentProfile + User child + Student` graph. `/api/assistante/families` is the canonical HTTP entry. Any retained staff compatibility route must be an explicitly tested adapter to the same service and idempotency namespace.

Public bilan submissions and parent add-child actions create a `FamilyRequest`, never an active account. A request has an explicit type (`BILAN_GRATUIT` or `ADD_CHILD`), lifecycle, contact/consent facts, optional requesting parent, and structured child rows. Existing `ContactLead`, `StageReservation`, and commercial request models are not reused because none expresses a structured family change without changing its existing meaning.

Generic admin user management cannot create PARENT/ELEVE users or transition into or out of these roles. Family role transitions require a dedicated transactional service and are outside the generic CRUD contract.

The existing parent WhatsApp manual contract is preserved: the normalized verified phone remains the parent login identifier; staff never choose a parent password; manual mode creates no Meta call and no WhatsApp outbox row; the sensitive prepared `wa.me` response is punctual and `no-store`; the parent consumes the activation link, chooses a password, logs in by phone and confirms the household. Email/student activation work must not alter these parent-channel invariants.

## Family HTTP guarantees

The canonical handler reads a bounded stream, applies a strict configured same-origin policy and explicit CSRF validation, and rate-limits the actor and source before body parsing. Its idempotency coordinate is shared by canonical aliases and includes a canonical SHA-256 payload digest. A reused key with a different digest returns `409 IDEMPOTENCY_CONFLICT`. Concurrent identical submissions yield one graph and a replay.

## Academic map

`Student.gradeLevel`, `Student.academicTrack`, `Student.stmgPathway`, `Student.schoolingStatus`, `Student.school`, `Student.academicRevision`, `StudentAcademicEnrollment`, and `data/curriculum/` define the current map.

Mandatory courses remain derived. Only specialties and options are persisted. `setStudentChosenCourses()` remains the only enrollment validation and replacement logic, but accepts an existing Prisma transaction so the staff command can atomically:

1. compare the client revision;
2. validate the next identity and chosen course keys;
3. update the Student identity by CAS;
4. replace enrollments;
5. increment `academicRevision`;
6. return the recalculated map inside the same transaction.

A stale revision returns `409 ACADEMIC_REVISION_CONFLICT` without partial writes.

`ProfilCandidat` and `ParcoursType` continue to describe examination administration for individual candidates, including the existing one-year, two-year, repeat and other P1–P12 modalities. They do not become a parallel current-course authority. New explicit course selections made while a candidate is linked to a Student go through the revisioned academic command. Historical candidate strings are reported and remain unchanged unless a human confirms their canonical course keys; no automatic historical inference is allowed.

## Course-scoped assignments

`CoachStudentAssignment` remains the sole coach-to-student authority. It gains additive canonical course keys while retaining historical `subjects` for rollback compatibility.

Allowed course keys are computed server-side as the intersection of the student's current followed courses and the coach's declared capabilities. The client selects only from this result. Assignments store explicit course keys because one Subject can map to multiple simultaneously followed courses, such as Première core mathematics and mathematics specialty.

The existing-assignment backfill evaluates each active historical Subject independently:

- one matching followed course: `BACKFILL_AUTO`;
- no match: `BACKFILL_UNRESOLVED`;
- multiple matches: `BACKFILL_AMBIGUOUS`.

The script reports every unresolved or ambiguous assignment and never chooses for a human. Readiness requires both counts to be zero.

Historical SessionBooking rows never grant dossier access. Ending or suspending an assignment removes current dossier and future-planning rights. A coach may still see the minimal immutable record of a session they personally delivered where an existing legal/operational route requires it, but that record cannot open the student's dossier.

## Operational planning

`SessionBooking` is the operational occurrence source. The legacy `Session` model receives no new writes and no longer powers the core dashboards.

`PlanningSeries` is introduced because no current model represents a child-specific recurrence. It stores `studentProfileId`, `coachProfileId`, `assignmentId`, `academicCourseKey`, `Africa/Tunis`, local start/end time, recurrence/count/until, modality, location, status and authorship. Occurrences are materialized into `SessionBooking`, linked to the series, and uniquely identified within a series so retries cannot duplicate them.

Existing unrelated bookings are not grouped into guessed series. Their series relation remains null.

Before profile-based readers are switched, every active or future occurrence must resolve both profile identities. The blocking gates are `ACTIVE_FUTURE_SESSION_WITHOUT_STUDENT_PROFILE = 0` and `ACTIVE_FUTURE_SESSION_WITHOUT_COACH_PROFILE = 0`. Unresolved completed/cancelled history stays visible through an explicitly labelled legacy projection using the existing User relations; it grants no ownership and is never assigned a guessed profile.

The scheduling service reloads and verifies all invariants inside a serializable transaction:

- Student exists and the course belongs to its current map;
- assignment is active for Student, Coach and course at the occurrence date;
- coach capability covers the course;
- effective availability includes the slot, including dated overrides, blackouts and validity windows;
- no Student, Coach or Stage conflict exists.

PostgreSQL exclusion constraints protect active coach and student-profile overlaps. Application checks give useful messages; database constraints close concurrent races. Two simultaneous identical/conflicting writes must yield one success, one conflict and zero double bookings.

ASSISTANTE has no override. ADMIN may use only enumerated non-temporal override codes. Every override records code, reason, actor, time and bypassed validation. Student, coach and stage conflicts remain impossible to override.

Future-only series edits cancel superseded future occurrences and materialize the revised future schedule idempotently. Past occurrences remain immutable. Future-only cancellation preserves history.

## Dashboard projections

- ASSISTANTE completes family, activation, academic map, assignment, planning, payment and invoice work without SQL or Admin.
- PARENT receives children keyed by `Student.id`, with independent academic map, coaches, future sessions and authorized reports. Add child creates a request.
- ELEVE receives only their academic map, assigned coaches, SessionBooking occurrences, documents and published reports.
- COACH receives only current assignments, allowed course keys and matching planning. Old sessions do not reopen dossiers.
- ADMIN supervises the same domain services and does not bypass them through generic CRUD.

Every route independently enforces server-side role and ownership. Middleware remains a navigation layer, not authorization.

## Payments, invoices and retired credits

The core planning work must preserve the no-credit product decision. Every new SessionBooking writes the legacy `creditsUsed` compatibility field as zero and no core route checks, debits, grants or displays credits. ASSISTANTE retains payment validation and invoice operations; PARENT retains owned payment/invoice visibility. Subscriptions, payments and invoices remain distinct domains and revenue remains based on completed payments.

## Core without RAG

Core tests clear all RAG endpoint and credential variables and record outbound requests. Core authentication, family, activation, academic, assignment, planning and dashboards must produce zero RAG outbound requests. RAG widgets are hidden or disabled when unavailable. No `/search` fallback is introduced.

## Migration and rollback

All schema changes are additive. Migrations run against a fresh database, a synthetic existing database and an isolated restore of a recent Nexus backup. Counts are compared before and after for users, parents, students, enrollments, assignments and bookings. New profile relations remain nullable if any real row cannot be explained.

The rehearsal record includes the backup identifier and checksum, migration SHA, previous production artifact SHA and candidate artifact SHA without exposing storage paths, credentials or PII. Rollback verification reads pre-expansion records and reads/writes records created after expansion with the previous compatible application artifact.

Rollback deploys the previous application against the expanded schema. Historical User foreign keys and Subject arrays remain available. No down migration destroys migrated data.

## Readiness evidence

`CORE_GO_LIVE_GATE.md` records PASS/FAIL, evidence, test and commit for each core gate. A Golden Family browser test creates and later removes a synthetic parent, two children and two coaches through supported interfaces. It verifies all five dashboards plus cross-role, cross-child, wrong-course, conflict, ended-assignment and idempotency denials with RAG disabled.
