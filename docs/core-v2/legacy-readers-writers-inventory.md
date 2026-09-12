# Core v1 legacy readers / writers — runtime inventory (go-live §AO)

Survey of the live runtime (`app/**`, `lib/**`, `components/**`, production scripts; `__tests__/**`, `e2e/**`, seed/test scripts excluded) for every read or write of a Core v1 concept that Core v2 replaces. Generated 2026-09-12 on `feat/core-v2-planning-engine`; paths are repo-relative. Counts at the end.

`CUTOVER_STATUS` vocabulary:

- `REPLACED` — a Core v2 authority exists and is wired (service + route); the legacy path is to be retired at cutover.
- `V2_READY` — the Core v2 authority exists; the legacy caller still needs re-pointing (UI/API) — listed so the cutover can count it.
- `PENDING_V2` — no Core v2 service yet; the replacement is named.
- `ARCHIVAL` — read-only admin history, allowed to keep reading Core v1 outside the live authority.
- `SCRIPT` — migration/rehearsal tooling, not live runtime.
- `DELETE` — dead or duplicate code; remove.

Structural findings that shape the work:

1. The legacy `Session` model (`prisma/schema.prisma:776`) has **zero** runtime callers — orphaned schema. All v1 session traffic goes through v1 `SessionBooking`.
2. `Student.specialties` no longer exists on the v1 schema; `lib/aria/cockpit/legacy-specialties.ts` synthesizes it from course enrollments.
3. `User.isActive` / `status='PENDING'` do not exist; v1 gates on `activatedAt` / activation tokens. `app/api/admin/users/route.ts` still carries dead `isActive` references and `lib/validation/users.ts` still accepts the field.
4. v1 already has `PlanningSeries`, `PlanningOverrideAudit` and `SessionBooking.{studentProfileId,coachProfileId,assignmentId,planningSeriesId,occurrenceKey}` — but v1 bookings also carry **User-id** participants (`studentId`/`coachId`). Core v2 `SessionBooking` has profile ids only, projected from the assignment (migration 0007).
5. `lib/session-booking.ts` is a **second, independent** v1 booking path (User ids, bypasses `lib/planning/**` invariants) — `DELETE` candidate.
6. The Core v2 planning API had no front-end consumer before this branch; the Planning Studio (`public/planning/*`, vanilla JS) persists an opaque JSON document keyed by a free-text school year.

## 1. `Student.grade` (free-text) → `StudentAcademicYearEnrollment.gradeLevel/academicTrack` (`lib/core-v2/services/enrollment.ts`)

| PATH | R/W | REPLACEMENT | CUTOVER_STATUS |
|---|---|---|---|
| lib/families/create-family.ts (:419, :726) | WRITE | createStudent + createAnnualEnrollment/setAcademicMap | V2_READY |
| lib/services/student-activation.service.ts (:268, :280) | WRITE | same | V2_READY |
| app/api/admin/users/route.ts (:399) | WRITE | /api/v2/staff/students, /enrollments | V2_READY |
| app/api/assistante/family-requests/[requestId]/convert/route.ts | WRITE (indirect) | household + enrollment services | V2_READY |
| lib/curriculum/student-academic-profile.ts (:117-124) | WRITE | setAcademicMap | V2_READY |
| app/api/coach/students/[studentId]/survival-mode/route.ts (:84) | WRITE | none — survival mode absent from Core v2 | PENDING_V2 |
| app/api/parent/children/route.ts, lib/scopes.ts, app/api/parent/dashboard/route.ts, app/api/parent/subscriptions/route.ts | READ | lib/core-v2/queries/parent.ts (`GET /api/v2/parent/household`) | REPLACED |
| lib/dashboard/student-payload.ts (:1180) | READ | lib/core-v2/queries/student.ts (`GET /api/v2/student/me`) | REPLACED |
| app/api/coach/dashboard/route.ts (:188), app/api/coach/students/[studentId]/dossier/route.ts (:76) | READ | lib/core-v2/queries/coach.ts (`GET /api/v2/coach/me`) | REPLACED |
| app/api/assistante/students/[studentId]/route.ts, app/api/assistante/subscriptions/route.ts, app/api/admin/subscriptions/route.ts | READ | lib/core-v2/queries/staff.ts | V2_READY |
| app/api/bilans/[id]/route.ts, app/api/assessments/[id]/{export,result,test}/route.ts | READ | none — historical snapshots | ARCHIVAL |
| scripts/fix-grade-levels.ts | WRITE | one-off | SCRIPT |
| UI display-only (`grade: string` props): app/dashboard/{admin/subscriptions,assistante/students,assistante/students/[studentId],assistante/subscriptions,coach/students,parent/abonnements,parent/add-child-dialog,eleve}/page.tsx, components/dashboard/{parent/children-list,StudentSelector,assistante/FamilyForm,eleve/types}.tsx, components/ui/session-management.tsx, lib/pdf/assessment-template.tsx | READ (DTO) | follow their API | V2_READY |

## 2. `Student.specialties` (synthesized) → `StudentCourseEnrollment` (`lib/core-v2/services/enrollment.ts`)

| PATH | R/W | REPLACEMENT | CUTOVER_STATUS |
|---|---|---|---|
| lib/aria/cockpit/legacy-specialties.ts; app/api/aria/cockpit/{profile,curriculum}/route.ts; lib/aria/cockpit/{profile-service,builder}.ts; lib/aria/curriculum/resolver.ts | READ | course enrollments (ARIA-owned consumers — handoff) | V2_READY |
| app/dashboard/assistante/assignments/page.tsx | READ | staff enrollment read model | V2_READY |
| components/dashboard/coach/StudentDossier.tsx; app/dashboard/eleve/nsi-pratique-2026/page.tsx; app/dashboard/eleve/page.tsx (:541) | READ | course-enrollment-driven gating | V2_READY |

## 3. `CoachProfile.subjects` (Json) → `CoachCourseCapability` (`lib/core-v2/services/coach.ts`)

| PATH | R/W | REPLACEMENT | CUTOVER_STATUS |
|---|---|---|---|
| app/api/assistante/coaches/manage/route.ts (:172); app/api/assistante/coaches/manage/[id]/route.ts (:135); app/api/admin/users/route.ts (:212) | WRITE | setCoachCapability, `PUT /api/v2/staff/coaches/[id]/capabilities` | V2_READY |
| app/api/assistante/assignments/route.ts (:247); app/api/assistante/assignments/[id]/route.ts (:146, :221) | READ (gate) | capability check inside assignCoach | REPLACED |
| app/api/coaches/available/route.ts; app/api/coach/dashboard/route.ts (:128); app/api/assistante/coaches/route.ts | READ | capabilities on the coach read models | REPLACED |
| app/api/admin/stages/[stageId]/** | READ | none — Stages absent from Core v2 | PENDING_V2 |
| app/dashboard/assistante/assignments/page.tsx; app/dashboard/admin/stages/page.tsx; app/dashboard/assistante/coaches/page.tsx | READ (DTO) | capability DTO | V2_READY |
| lib/utils/subjects.ts (`parseSubjects`) | helper | delete with the Json column | DELETE |

## 4. `CoachStudentAssignment` (v1) → `CoachStudentCourseAssignment` (`lib/core-v2/services/coach.ts`)

| PATH | R/W | REPLACEMENT | CUTOVER_STATUS |
|---|---|---|---|
| app/api/assistante/assignments/route.ts (:307 create) | WRITE | assignCoach, `POST /api/v2/staff/assignments` | REPLACED |
| app/api/assistante/assignments/[id]/route.ts (:280 update) | WRITE | endCoachAssignment, `POST /api/v2/staff/assignments/[id]/end` | REPLACED |
| lib/rbac/coach-student-access.ts; lib/guards.ts (:176); lib/security/message-access.ts; lib/npc/access.ts; lib/nsi-pratique-2026/access.ts; lib/diagnostics/candidat-libre/access.server.ts; lib/bilans/api/get-report.ts | READ (authz) | a Core v2 coach↔student predicate (scope rule on `CoachStudentCourseAssignment`) | PENDING_V2 |
| lib/planning/identities.ts (:180) | READ | Core v2 planning engine (assignment is the sole identity) | REPLACED |
| app/api/coach/dashboard/route.ts; app/api/coach/students/eam-summary/route.ts; app/api/student/assignments/route.ts; app/api/assistante/students/[studentId]/route.ts; app/api/npc/submissions/route.ts; app/api/assessments/predict/route.ts; app/dashboard/coach/npc/** | READ | lib/core-v2/queries/{coach,student,staff}.ts | V2_READY |
| scripts/core/backfill-assignment-course-keys.ts; scripts/core/report-core-migration-state.ts; scripts/core/rehearsal-*.ts | R/W | migration tooling | SCRIPT |

## 5. v1 `SessionBooking` / planning → Core v2 planning engine (`lib/core-v2/services/planning.ts`, `lib/core-v2/queries/planning.ts`, migration 0007)

| PATH | R/W | REPLACEMENT | CUTOVER_STATUS |
|---|---|---|---|
| lib/planning/series.ts (recurrence + occurrence materialization, :410/:543; fixed UTC+1 at :184/:549) | WRITE | createPlanningSeries / changePlanningSeries (materialization, IANA zone from configuration) | REPLACED |
| lib/planning/invariants.ts (conflicts, stage overlaps) | READ | pre-check + exclusion constraints (`session_bookings_v2_*_no_overlap_excl`); stage overlaps: none — Stages absent from Core v2 | REPLACED / PENDING_V2 (stages) |
| lib/planning/identities.ts | READ | assignment projection (trigger-enforced) | REPLACED |
| lib/planning/effective-availability.ts (CoachAvailability) | READ | none — `CoachAvailability` absent from Core v2 | PENDING_V2 |
| app/api/assistante/sessions/route.ts (one-off session) | WRITE | `POST /api/v2/staff/planning/series` (COUNT=1) | REPLACED |
| app/api/assistante/planning/series/[seriesId]/route.ts (future-only edit/cancel) | WRITE | `PATCH /api/v2/staff/planning/series/[id]`, `POST …/cancel` | REPLACED |
| app/api/sessions/cancel/route.ts | WRITE | `POST /api/v2/staff/planning/bookings/[id]/cancel` (staff); self-service cancel policy: owner decision | REPLACED (staff) / PENDING_V2 (family self-cancel) |
| app/api/sessions/book/route.ts (parent/student booking funnel + notifications) | WRITE | none — family self-booking is a product decision (§AM-like); reminders/notifications: PENDING | PENDING_V2 |
| app/api/sessions/video/route.ts; app/api/coach/sessions/[sessionId]/report/route.ts | WRITE | none — video room / session report transitions (CONFIRMED→IN_PROGRESS→COMPLETED) | PENDING_V2 |
| lib/session-booking.ts (User-id booking path) | WRITE | planning engine | DELETE |
| lib/email-service.ts (:383 reminderSent) | WRITE | none — reminder pipeline | PENDING_V2 |
| app/api/assistante/planning/route.ts; app/api/assistante/dashboard/route.ts; app/api/coaches/availability/route.ts; app/api/assistante/coaches/manage/[id]/route.ts (:210) | READ | `GET /api/v2/staff/planning/bookings` | REPLACED |
| app/api/coach/dashboard/route.ts; app/api/coach/students/[studentId]/dossier/route.ts; app/api/coach/students/eam-summary/route.ts | READ | `GET /api/v2/coach/planning` | REPLACED |
| app/api/student/sessions/route.ts | READ | `GET /api/v2/student/planning` | REPLACED |
| app/api/parent/dashboard/route.ts (:131) | READ | `GET /api/v2/parent/planning` | REPLACED |
| lib/next-step-engine.ts; lib/nexus-index.ts | READ | planning read models | V2_READY |
| app/api/admin/{dashboard,analytics,activities}/route.ts | READ | history | ARCHIVAL |

## 6. Planning Studio (opaque JSON document)

| PATH | R/W | REPLACEMENT | CUTOVER_STATUS |
|---|---|---|---|
| lib/planning-studio/service.ts; app/api/planning-studio/{route,restore/route,revisions/**}.ts | WRITE/READ | must become an editor writing through the Core v2 planning services (series/bookings) or be retired — the JSON document cannot stay an authority (§AK) | PENDING_V2 (decision: converge or retire) |
| public/planning/** (vanilla JS client, `config.js apiBase:'/api/planning-studio'`); links at app/dashboard/admin/page.tsx:367, app/dashboard/assistante/page.tsx:382 | client | same | PENDING_V2 |

## 7. Free-text school year → `AcademicYear.startYear` (`lib/core-v2/services/academic-year.ts`)

| PATH | R/W | REPLACEMENT | CUTOVER_STATUS |
|---|---|---|---|
| lib/planning-studio/service.ts (`PlanningStudioDocument.academicYear`) | WRITE | AcademicYear FK | PENDING_V2 (with §6) |
| app/api/assessments/submit/route.ts (`studentMetadata.schoolYear`) | WRITE | frozen snapshot | ARCHIVAL |
| lib/bilans/catalog/**, lib/aria/rag.ts & RAG identity files, lib/campaigns/pre-rentree-2026/schema.ts | READ | corpus/campaign metadata, not student data | ARCHIVAL |

## 8. Account status / activation → `AccountStatus` + `Invitation` (`lib/core-v2/services/account.ts`, `/api/v2/auth/activate`, `/api/v2/staff/accounts/[id]/*`)

| PATH | R/W | REPLACEMENT | CUTOVER_STATUS |
|---|---|---|---|
| lib/auth/credentials-authorize.ts | READ | authority bridge already in place (CORE_V2 identities verified in Core v2 only) | REPLACED |
| lib/auth/parent-activation.ts (`isAccountActivationRequired`) | pure | AccountStatus checks | REPLACED |
| lib/services/student-activation.service.ts; app/api/auth/resend-activation/route.ts; lib/auth/activation-controller.ts | WRITE | inviteAccount / resendInvitation / activateAccount | REPLACED |
| app/api/auth/reset-password/route.ts | WRITE | changePassword (Core v2) — reset-link flow for CORE_V2 identities: PENDING (§AL) | PENDING_V2 |
| lib/auth/pending-account-lifecycle.ts; lib/auth/pending-account-policy.ts | WRITE (sweeper) | Invitation expiry | V2_READY |
| lib/auth/parent-phone.ts; app/api/auth/parent-phone/recovery/route.ts; app/api/assistante/parents/[parentId]/whatsapp-invitation/route.ts | WRITE | none — Core v2 Invitation is e-mail/token only (phone channel: owner decision) | PENDING_V2 |
| lib/families/create-family.ts; app/api/stages/[stageSlug]/reservations/[reservationId]/confirm/route.ts | WRITE | createHousehold + inviteAccount | V2_READY |
| app/api/admin/users/route.ts (:199, :347-352); app/api/assistante/coaches/manage/[id]/route.ts (:118-122) | WRITE | suspend/reactivate/disableAccount | REPLACED |
| app/api/parent/dashboard/route.ts (status from `activatedAt`); app/api/assistante/students/**; app/dashboard/assistante/students/[studentId]/page.tsx; app/dashboard/admin/users/page.tsx | READ | `accountStatus` on the Core v2 DTOs | REPLACED |
| lib/validation/users.ts (`isActive`) | — | dead field | DELETE |
| lib/bilans/family-landing/access.ts; lib/bilans/staff/parent-contact-service.ts; lib/families/parent-registration.ts; lib/rgpd/parent-phone-anonymisation.ts | WRITE | household contact services / RGPD (owner) | PENDING_V2 |

## Counts (runtime files)

| Concept | READ-only | WRITE | Total |
|---|---|---|---|
| 1. Student.grade | 15 | 6 | 21 |
| 2. Student.specialties | 8 | 0 | 8 |
| 3. CoachProfile.subjects | 9 | 3 | 12 |
| 4. CoachStudentAssignment | 19 | 2 | 21 |
| 5. SessionBooking / planning | 15 | 9 | 24 |
| 6. Planning Studio JSON | 2 | 4 (+1 client) | 7 |
| 7. Free-text school year | 5 | 2 | 7 |
| 8. Account status / activation | 8 | 15 | 23 |
| **Distinct files** | **≈68** | **≈38** | **≈101** |

`LEGACY_CORE_WRITERS` today: 38 runtime files. Cutover target (§AO/§AZ): 0 live writers, 0 live readers outside `ARCHIVAL`. Each `PENDING_V2` row names the missing Core v2 service; each `V2_READY` row is a re-pointing task with its target route.
