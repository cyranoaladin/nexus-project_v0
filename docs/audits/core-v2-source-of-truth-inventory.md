# Core v2 — Source-of-Truth Inventory (Phase A/B/C/D, read-only pass 1)

- **Frozen SHA analyzed:** `7313e738928522cb8066c2b323cd745fcd0a48eb` (`origin/main`, = PR #220 merge commit)
- **Data source:** isolated, non-production Docker Postgres clone restored from a fresh production backup on 2026-09-08, migrated to schema head, backfilled. No production database was written to during this pass. No code was written or deleted during this pass.
- **Scope:** identity, family, student, curriculum, coach capability, assignment, planning, session occurrence, billing separation, ARIA/RAG boundary.

This document is the deliverable required by Phase A ("cartographier... Produire docs/audits/core-v2-source-of-truth-inventory.md") and folds in Phase B (source-of-truth matrix), Phase C (active roster), and Phase D (the Case A/Case B students) findings from the same pass.

> **Correction notice (owner-directed, Core v2 Canonical Architecture mission):** this file is kept as a **working audit**, not a decision record. Its original §8 roster table used `KEEP`/`DELETE` labels that read as decisions — they were not. Read them as:
> - `KEEP` → **`KEEP_CANDIDATE`** (a signal worth reviewing, not an approval)
> - `DELETE` → **`DO_NOT_MIGRATE_CANDIDATE`** (a candidate for non-migration, not a deletion order)
> - **`DELETE_APPROVED = 0`** — nothing in this document authorizes deleting any student row, in this pass or any prior one.
> - **`RECENCY_90_DAYS_IS_AUTHORITY = false`** — the 90-day signup-recency signal used below is **descriptive only**, never authoritative. It has been superseded as the roster source of truth by `StudentAcademicYearEnrollment` (see the Core v2 Canonical Architecture report, `docs/audits/core-v2-canonical-architecture.md`) and the real, signal-based roster candidate file `core-v2-roster-2026-2027.candidate.json`.
>
> The counts and student IDs below are left unchanged as a historical record of the first pass; do not act on them directly.
>
> **Second correction:** this file's "3 real authorization sites" count for `SessionBooking`'s legacy identity fields (§3, §16, §5 destructive-ops estimate) is superseded — a later independent review found a 4th, dormant (zero production importers) site at `lib/session-booking.ts:285-303`. Current authoritative count: **`LEGACY_SESSIONBOOKING_IDENTITY_AUTHORIZATION_SITES = 4`** (3 live + 1 dormant). See `docs/audits/core-v2-canonical-architecture.md` §16 for the up-to-date, corrected count.

---

## 1. Current schema inventory (concepts in scope)

| Model | Table | Role today |
|---|---|---|
| `User` | `users` | Auth, role, email/phone, activation/session. **Already clean** — no academic truth leaks into `User`. |
| `ParentProfile` | `parent_profiles` | 1:1 with `User`(role=PARENT). Owns `Student[]` via `Student.parentId` — today's family-membership authority. |
| `Student` | `students` | Student business entity. Has `grade` (legacy string, "conservée pour compatibilité") **and** `gradeLevel`/`academicTrack`/`stmgPathway` (canonical). `specialties` **already removed** by migration `20260828140000_academic_enrollment_ssot`. |
| `ParentStudentLink` | `canonical_parent_student_links` | Consent/audit trail (`consentedAt`/`verifiedAt`/`revokedAt`/`state`). **Not** a second family-membership source in practice — confirmed by usage audit (§3.7). |
| `FamilyRequest` / `FamilyRequestChild` | `family_requests` / `family_request_children` | Pre-creation intake only, never a live family record. Already correctly scoped per mission Phase 10. |
| `StudentAcademicEnrollment` | `student_academic_enrollments` | Explicit `SPECIALTY`/`OPTION` choices only; `CORE`/`TRACK` modules are derived from `gradeLevel × academicTrack × stmgPathway` via the versioned catalog, never stored. **This already matches the mission's target shape exactly** (Phase 4) — no redesign needed, just a possible rename to `StudentCourseEnrollment` and repointing at the new `Student` table. |
| `CoachProfile` | `coach_profiles` | `subjects Json` is the legacy "what can this coach teach" field — one authorization chokepoint (`lib/assignments/allowed-courses.ts::coachCapableCourseKeys()`) plus one undocumented second surface (`lib/session-booking.ts`, see §3.3). |
| `CoachStudentAssignment` | `coach_student_assignments` | Legacy multi-scope model: `subjects Subject[]` + `academicCourseKeys String[]` + `courseScopeState` enum (`BACKFILL_AUTO`/`BACKFILL_UNRESOLVED`/`BACKFILL_AMBIGUOUS`). Exactly the model Phase 6 wants replaced. |
| `PlanningSeries` | `planning_series` | **Already close to target**: references `assignmentId`, `studentProfileId`, `coachProfileId`, single `academicCourseKey`. Low rework. |
| `SessionBooking` | (unmapped table name, class `SessionBooking`) | **Genuine dual identity today**: legacy `User.id`-based `studentId`/`coachId`/`parentId` ("conservés pendant la migration") *and* canonical `studentProfileId`/`coachProfileId`/`assignmentId`. Schema comments admit this is transitional. |
| `Session` (legacy) | `sessions` | **Zero runtime consumers found** (read or write) anywhere in `app/`, `lib/`, `scripts/` at the frozen SHA. Confirms the mission's claim outright. |
| `Subscription`, `CreditTransaction`, `Payment`, `Invoice`, `InvoiceItem`, `Entitlement` | various | Billing/entitlement cluster. Already reasonably decoupled from the assignment/planning mess — `Subscription.studentId` and `Entitlement.userId` are the only couplings, no FK entanglement with `CoachStudentAssignment`/`PlanningSeries`. Low rework risk. |

---

## 2. Source-of-truth conflicts identified

| Concept | Current sources | Conflict |
|---|---|---|
| Coach capability | `CoachProfile.subjects` (Json) | Two independent authorization surfaces read it: the documented chokepoint `allowed-courses.ts`, and a second undocumented path in `lib/session-booking.ts` (booking-time coach availability filtering) that does its own inline `parseSubjects` rather than going through the chokepoint. |
| Assignment scope | `CoachStudentAssignment.{subjects[], academicCourseKeys[], courseScopeState}` | A single row can legitimately need >1 course (multiple subjects) or 0 courses (unresolved/ambiguous) — the array+enum shape is *why* ambiguity/emptiness is representable at all. Target model (§5) makes both structurally impossible. |
| Session identity | `SessionBooking.{studentId,coachId,parentId}` (User.id) vs `.{studentProfileId,coachProfileId,assignmentId}` | 3 real authorization branches still read the legacy User.id fields directly (`app/api/coach/sessions/[sessionId]/report/route.ts`, `app/api/sessions/book/route.ts`, `app/api/coach/students/eam-summary/route.ts`) — these block removing the legacy columns until migrated. |
| Student level display | `Student.grade` vs `Student.gradeLevel` | Mostly display-only duplication (safe), but `app/dashboard/eleve/page.tsx` uses `.grade === 'PREMIERE'` as a **fallback in real level-gating logic** alongside `studentGradeLevel` — a genuine (if minor) logic-level conflict. |
| Family membership | `ParentProfile.children` (via `Student.parentId`) | **No real second source found.** `ParentStudentLink` is consent/audit-only in every non-test call site (20 checked). This concept is *already* single-source; Household/HouseholdParent is a structural improvement (multi-parent support) but not a bug fix. |

---

## 3. Legacy usage map (file/line level)

Full detail from the codebase audit (7 items, ~60 call sites reviewed):

### 3.1 `Student.grade` legacy field
| File | Class | Note |
|---|---|---|
| `lib/dashboard/student-payload.ts:1180-1181` | ARCHIVE_ONLY / CANONICAL_KEEP | Emits both; only `gradeLevel` drives logic. |
| `lib/families/create-family.ts` (9 sites) | MIGRATE | Intake still captures free-text `grade`, derives canonical fields from it. New intake should capture `gradeLevel`/`academicTrack` directly. |
| `scripts/fix-grade-levels.ts:40-59` | DELETE_LEGACY | One-shot backfill tool, historical only. |
| `lib/scopes.ts:156,167,181` | ARCHIVE_ONLY | Parent child-list projection, raw display. |
| 6 API routes (parent/admin/coach dashboards & subscriptions) | ARCHIVE_ONLY | Pure display, no logic branch. |
| Frontend badges (8 components) | ARCHIVE_ONLY | Display only. |
| `app/dashboard/eleve/page.tsx:151,322,396,435` | **MIGRATE** | Real level-gating fallback on legacy field — needs removal. |

### 3.2 `Student.specialties` (already removed from schema)
| File | Class | Note |
|---|---|---|
| `app/dashboard/eleve/page.tsx:525`, `nsi-pratique-2026/page.tsx:28,31,36-37` | DELETE_LEGACY | Dead code reading a field that no longer exists in the payload type. |
| `app/dashboard/assistante/assignments/page.tsx:54,109,176,526` | **UNKNOWN** | Local view-model still types `specialties: Subject[] \| null` — needs a check against the actual API route response shape. |
| Docs/comments (`lib/curriculum/*`, `lib/validation/users.ts`, `lib/quotes/schemas.ts`) | ARCHIVE_ONLY | Historical comments only. |
| `app/equipe/page.tsx`, `lib/diagnostics/candidat-libre/synthesis.server.ts` | N/A | False positives — different domain (coach marketing page, candidat-libre diagnostic scores). |

### 3.3 `CoachProfile.subjects` — authorization-relevant reads
Chokepoint: `lib/assignments/allowed-courses.ts::coachCapableCourseKeys()`. Migrating this one function fixes most callers automatically.

| File | Class | Note |
|---|---|---|
| `lib/assignments/allowed-courses.ts:32-40` | **MIGRATE (priority 1)** | The chokepoint itself. |
| `app/api/assistante/assignments/route.ts:247`, `[id]/route.ts:221` | MIGRATE (auto-fixed via chokepoint) | |
| `lib/session-booking.ts:116,212,218` | **MIGRATE (priority 2)** | **Second, undocumented authorization surface** — inline `parseSubjects`, bypasses the chokepoint entirely. Must be unified. |
| `lib/planning/identities.ts:68,216` | MIGRATE | |
| `app/api/coaches/available/route.ts:112,124` | MIGRATE | Borderline-authz: determines which coaches are offered to a family. |
| `app/api/coach/dashboard/route.ts:128` | ARCHIVE_ONLY | Self-display. |
| `app/api/assistante/coaches/route.ts:111`, `coaches/manage/route.ts:72` | CANONICAL_KEEP *for now* | Admin edit UI for the field itself — becomes MIGRATE once `CoachCourseCapability` exists. |
| Stages (bootcamp) pages (3 files) | ARCHIVE_ONLY | Separate business line, display-only, lower priority. |
| `scripts/seed-parent-dashboard-e2e.ts:179` | ARCHIVE_ONLY | Test fixture. |

### 3.4 `CoachStudentAssignment.{subjects[], academicCourseKeys[], courseScopeState}`
39 files touched. Grouped:

| Group | Class |
|---|---|
| Chokepoint/core logic (`allowed-courses.ts`, `lib/planning/identities.ts`, `lib/planning/invariants.ts`) | MIGRATE — becomes structurally unnecessary under the new model. |
| Runtime routes (assistante/student/coach assignment & activation routes) | MIGRATE |
| Services (`student-activation.service.ts`, `families/requests.ts`) | MIGRATE |
| One-off scripts (`backfill-assignment-course-keys.ts`, `rehearsal-real-data-compat-check.ts`, `report-core-migration-state.ts`) | DELETE_LEGACY post-cutover — their entire purpose is managing states that cease to exist. |
| ARIA-side reads (`lib/aria/domain/profile/preferences.ts`, `infrastructure/prisma/profile-repository.ts`, `application/profile/public.ts`) | **UNKNOWN** — need to confirm whether ARIA uses `courseScopeState`/`academicCourseKeys` for entitlement decisions vs. display only. Out of this mission's core scope (RAG/ARIA independence) but worth a dedicated follow-up since it reads Core's assignment table directly. |
| ~20 test files | ARCHIVE_ONLY — will need rewriting, not "legacy" per se. |
| 3 files (stages planning page, `lib/validation/sessions.ts`, `admin/users/route.ts`) | UNKNOWN — matched but not deep-inspected; flag for Phase B follow-up. |

### 3.5 Legacy `Session` model (table `sessions`)
**Zero** `prisma.session.*`/`tx.session.*` call sites found anywhere in `app/`, `lib/`, `scripts/`. Confirms the mission's premise exactly.

| Finding | Class |
|---|---|
| `Session` model (`prisma/schema.prisma:750`) | DELETE_LEGACY — dead in Core runtime. Only open question: whether historical rows need archival before `DROP TABLE` (a data decision, not a code one — see Phase 9 destruction plan below). |

### 3.6 `SessionBooking` legacy User.id identity
Only 3 files do **real** branching on the legacy identity fields (everything else touching them is pass-through/display, high volume/low risk, not enumerated individually):

| File | Lines | What it does |
|---|---|---|
| `app/api/coach/sessions/[sessionId]/report/route.ts` | 72,115,154,249-251 | Real access-control: `coachId !== coachUserId`, `.studentId !== session.user.id`, `.parentId !== session.user.id`. |
| `app/api/sessions/book/route.ts` | 232,235 | `booking.parentId !== session.user.id` check + notification target. |
| `app/api/coach/students/eam-summary/route.ts` | 51,60 | Lists a coach's bookings by `coachId = session.user.id`, then reads `.studentId`. |

These 3 are the actual blockers to removing `studentId`/`coachId`/`parentId` from `SessionBooking`.

### 3.7 `ParentProfile.children` vs `ParentStudentLink`
**No real second source of truth found.** All 20 non-test consumers of `ParentStudentLink` gate *report/bilan access* (consent tracking) — never a family-membership decision. Two account-lifecycle plumbing sites (`parent-registration.ts:55`, `pending-account-lifecycle.ts:374,644`) are UNKNOWN-flagged for a closer read but show no membership inference. **This concept is already single-source in practice.**

---

## 4. Canonical KEEP models (no redesign needed)

- `User` — identity/auth authority, unchanged.
- `StudentAcademicEnrollment` — already exactly the target shape for course selection; rename optional (`StudentCourseEnrollment`), re-point FK on migration.
- `PlanningSeries` — already assignment/course-key-based; needs FK repoint + drop of the now-fully-derivable `academicCourseKey` denormalization (owner call, see §6).
- `Subscription`, `Payment`, `Invoice`, `InvoiceItem`, `Entitlement`, `CreditTransaction` — billing cluster, decoupled from the assignment mess already.
- `FamilyRequest`/`FamilyRequestChild` — pre-creation intake, correctly scoped.
- `ParentStudentLink` — correctly scoped as consent/audit; keep, do not touch its purpose.

## 5. Models to replace

| Legacy | Replacement | Why |
|---|---|---|
| `CoachProfile.subjects Json` | `CoachCourseCapability(coachId, courseKey)`, unique `(coachId, courseKey)` | Removes the Json-blob-as-authority pattern; makes capability a real relation, seedable one-time from existing `subjects` × catalog `legacySubject` mapping (reuse `coachCapableCourseKeys()` logic for the seed). |
| `CoachStudentAssignment` (multi-scope) | `CoachStudentCourseAssignment(coachId, studentId, courseKey, status, startsAt, endsAt, assignedById)` | One row = one coach+student+courseKey. `BACKFILL_AUTO`/`UNRESOLVED`/`AMBIGUOUS` become impossible by construction: `courseKey` is a required scalar, never an array, never empty. |
| `ParentProfile` + `Student.parentId` (single-parent-per-student) | `Household` / `HouseholdParent` / `Student.householdId` | Adds real multi-parent support (today: exactly 1 parent per student, structurally). Not fixing a bug — an enhancement Phase 2 explicitly asks for. |

## 6. Legacy models/fields to delete (after migration + verification)

- `Session` (legacy model/table) — zero runtime consumers, confirmed. Archive-then-drop.
- `CoachStudentAssignment.subjects[]`, `.academicCourseKeys[]`, `.courseScopeState` — superseded by `CoachStudentCourseAssignment`.
- `CoachProfile.subjects` — superseded by `CoachCourseCapability`, once the 2 authorization surfaces (§3.3) are unified onto it.
- `Student.grade` — once the 2 real logic-branch sites (`create-family.ts` intake, `eleve/page.tsx` gating) are migrated to `gradeLevel`/`academicTrack` directly; all other 15+ sites are display-only and trivial.
- `SessionBooking.studentId`/`.coachId`/`.parentId` (User.id) — once the 3 real authorization sites (§3.6) are migrated to `studentProfileId`/`coachProfileId`/derived-household-parent.
- Dead code: `app/dashboard/eleve/page.tsx:525` and `nsi-pratique-2026/page.tsx` reads of the already-removed `specialties` field.
- `scripts/core/backfill-assignment-course-keys.ts` and siblings (`rehearsal-real-data-compat-check.ts`, `report-core-migration-state.ts`) — their entire purpose is managing states that cease to exist post-cutover.

## 7. Open UNKNOWNs (target: 0 by end of Phase B follow-up)

1. `app/dashboard/assistante/assignments/page.tsx` — is `specialties` in its view-model backed by a real (stale) API field, or purely dead type? (4 line refs)
2. ARIA-side reads of `courseScopeState`/`academicCourseKeys` (3 files) — display-only, or entitlement-relevant? Matters for the RAG/Core independence boundary.
3. 3 files matched on assignment-scope strings without deep inspection: `app/dashboard/assistante/stages/planning/page.tsx`, `lib/validation/sessions.ts`, `app/api/admin/users/route.ts`.
4. `lib/families/parent-registration.ts:55` and `lib/auth/pending-account-lifecycle.ts:374,644` — confirm no family-membership inference from `ParentStudentLink` during account lifecycle transitions.
5. `students.specialties` — **schema drift found**: the physical column still exists in the live/restored database even though it was removed from `prisma/schema.prisma` by migration `20260828140000_academic_enrollment_ssot`. Needs a targeted check of that migration's SQL (did it actually `DROP COLUMN`, or only stop writing to it?) before Core v2 can assume the column is gone.

None of these block the report; all are scoped, bounded follow-ups for Phase B before any code changes.

---

## 8. Active roster (Phase C) — read against isolated production clone, 2026-09-08

**Important context finding:** the mission's proposed signals (active subscription, future `planning_series`/`SessionBooking`) are structurally near-empty right now: `planning_series` = 0 rows platform-wide, 0 future `SessionBooking` rows (last ever scheduled 2026-05-14), and exactly 1 `Subscription` row platform-wide with `status='ACTIVE'` but an `endDate` of 2026-05-27 (expired). This reflects the pre-rentrée-2026 lull (school year not yet resumed), not missing data.

To get a usable classification anyway, one additional signal was introduced — **flagged explicitly as a judgment call, not a mission-specified signal**: `recent_signup` = `Student.createdAt` within 90 days of now, as a proxy for the incoming 2026-2027 cohort.

**Rule used:**
- **KEEP** = has an ACTIVE `coach_student_assignments` row, OR a truly-active subscription (`status=ACTIVE` AND `endDate` null/future), OR a future `SessionBooking`, OR `recent_signup`.
- **DELETE** = none of the above, and zero historical trace at all (no assignment/subscription/booking/legacy-session/invoice/payment ever).
- **ARCHIVE** = some historical trace but no current-cycle signal.
- **AMBIGUOUS** = anything uncaught.

**Result (194 students total) — labels superseded, see correction notice above:**

| Bucket (original label) | Corrected label | Count |
|---|---|---|
| KEEP | `KEEP_CANDIDATE` | 62 |
| ARCHIVE | `ARCHIVE` | 0 |
| DELETE | `DO_NOT_MIGRATE_CANDIDATE` | 132 |
| AMBIGUOUS | `AMBIGUOUS` | 0 |

`DELETE_APPROVED = 0` for all 132. `RECENCY_90_DAYS_IS_AUTHORITY = false` — see correction notice.

KEEP driver breakdown (mutually exclusive): `recent_signup`-only = 52 (84% of KEEP), `active_assignment` (not recent) = 10, `truly_active_sub` alone = 0, `future_booking` alone = 0.

**⚠️ Owner review needed:** the 90-day recency window is not mission-specified and drives 84% of KEEP. 6 students sit within ±14 days of that boundary and would flip bucket under a 76- or 104-day cutoff: `cmprjrrqj0002mg3b1j1gw6aj`, `cmprjrrxw0005mg3blyxugonm`, `cmpsbhlt10002mgdxze2temxq`, `cmpstf3aj0002mglifzzif9zc`, `cmpvr72kd000dmgkuakgm7ean`, `cmpzszfn60002mgmryb6se84g`. No formal AMBIGUOUS bucket resulted from the schema-native signals alone — everything with any historical trace also independently qualifies via `recent_signup` or `active_assignment`.

No `status`/`isActive`/`lastActiveAt` field exists on `Student` — none available beyond what's listed.

## 9. Case A student / Case B student (Phase D)

| | Case A student (`cmonxyeh50...`) | Case B student (`cmoh7fpsn0...`) |
|---|---|---|
| `createdAt` | 2026-05-02 (not recent) | 2026-04-27 (not recent) |
| Active assignments | 1 (the disputed one) | 2 |
| Subscriptions | 0 | 1 (the platform-wide one, expired) |
| Bookings ever / future | 0 / 0 | 0 / 0 |
| Legacy `sessions` rows | 0 | 0 |
| Invoices | 0 | 0 |
| **Roster bucket (mechanical)** | **KEEP** | **KEEP** |

**Caveat — this KEEP classification is circular and should not be taken at face value for these two specifically.** Both land in KEEP *solely* because they have an "ACTIVE" `coach_student_assignments` row — but that row is exactly the disputed/empty-scope assignment from the go-live blocker investigation (Case A/Case B, already presented to you and deferred pending real-world verification). Using "has an active assignment" as a keep-signal for the very assignment under dispute doesn't tell us anything new about whether the Case A/Case B students are real active students — it just restates that the old row exists and is still marked ACTIVE.

Per the mission's Phase G ("REBUILD, PAS BACKFILL AVEUGLE"): *this old assignment must not automatically produce a new Core v2 assignment either way* — "Seulement une vérité actuelle explicite peut en créer une." So the roster bucket for the Case A/Case B students does not resolve anything: **whether they get migrated as students, and whether either gets a *new* assignment, both still require your explicit answer to the same Case A/Case B question already pending** (family/coach verification) — not a roster heuristic.

---

## 10. Proposed Core v2 schema (design only — nothing applied)

```prisma
// Family
model Household {
  id        String            @id @default(cuid())
  parents   HouseholdParent[]
  students  Student[]
  createdAt DateTime          @default(now())
  updatedAt DateTime          @updatedAt
}

model HouseholdParent {
  id               String    @id @default(cuid())
  householdId      String
  household        Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  userId           String    @unique
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  isPrimaryContact Boolean   @default(false)
  createdAt        DateTime  @default(now())
  @@unique([householdId, userId])
}

model Student {
  id               String    @id @default(cuid())
  householdId      String
  household        Household @relation(fields: [householdId], references: [id], onDelete: Cascade)
  userId           String    @unique
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  schoolingStatus  SchoolingStatus?
  gradeLevel       GradeLevel
  academicTrack    AcademicTrack @default(EDS_GENERALE)
  stmgPathway      StmgPathway?
  school           String?
  birthDate        DateTime?
  academicRevision Int @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  // no `grade`, no `specialties` — canonical fields only
}

// Curriculum — StudentAcademicEnrollment carried over unchanged in shape,
// re-pointed at the new Student table (optionally renamed StudentCourseEnrollment).

// Coach capability
model CoachCourseCapability {
  id        String       @id @default(cuid())
  coachId   String
  coach     CoachProfile @relation(fields: [coachId], references: [id], onDelete: Cascade)
  courseKey String
  createdAt DateTime     @default(now())
  @@unique([coachId, courseKey])
}

// Assignment — one row, one courseKey, never ambiguous, never empty
model CoachStudentCourseAssignment {
  id             String            @id @default(cuid())
  coachId        String
  coach          CoachProfile      @relation(fields: [coachId], references: [id], onDelete: Cascade)
  studentId      String
  student        Student           @relation(fields: [studentId], references: [id], onDelete: Cascade)
  courseKey      String
  status         AssignmentStatus  @default(ACTIVE)
  startsAt       DateTime          @default(now())
  endsAt         DateTime?
  assignedById   String?
  assignedBy     User?             @relation(fields: [assignedById], references: [id], onDelete: SetNull)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  planningSeries  PlanningSeries[]
  sessionBookings SessionBooking[]
  // Partial unique index (coachId, studentId, courseKey) WHERE status='ACTIVE'
  // — same pattern already used by entitlements_aria_access_invoice_key,
  // enforced at SQL level (Prisma can't express WHERE-clause indexes).
  @@index([coachId, status])
  @@index([studentId, status])
}
```

**What this structurally guarantees** (true "impossible by schema", not just app-layer discipline):
- `AMBIGUOUS_ASSIGNMENTS = impossible by schema` — a row is one `courseKey`, never an array; there is nothing to be ambiguous *between*.
- `EMPTY_ASSIGNMENT_SCOPE = impossible by schema` — `courseKey` is a required, non-null scalar column.

**What remains application-layer, not DB-schema** (stated plainly, not overclaimed): "student actually follows this courseKey" and "coach actually has this capability" are still enforced by the API route at write time (same pattern as today's `findCourseScopeIssue`/`allowedCourseKeysForSubject`), because followed courses are partly derived (TC modules from `gradeLevel × academicTrack`) rather than all being physical rows joinable via a DB foreign key. `CoachCourseCapability` does make the coach-capability half a real FK-joinable relation, which today's `Json` field cannot be.

`PlanningSeries`/`SessionBooking` keep their existing shape, re-pointed at `CoachStudentCourseAssignment`; whether to keep or drop the denormalized `academicCourseKey` field (now fully derivable via `assignment.courseKey`) is an owner call, not resolved here — noted as a design open point, not decided unilaterally.

## 11. Proposed fresh migration baseline

Per Phase E: a new database `nexus_core_v2`, not a 106-migration replay. `nexus_prod` becomes `LEGACY_SOURCE_READ_ONLY` during the transition. Concretely:
1. New Prisma schema (models above + carried-over billing/curriculum/planning models) with a single baseline migration, `prisma migrate dev --create-only` against an empty DB, reviewed by hand.
2. Git history of the 106 legacy migrations is kept (never rewritten) — only the *deployment* baseline for Core v2 is fresh, not the historical record.
3. A one-time ETL script (not a Prisma migration) reads from `nexus_prod` (read-only) and writes into `nexus_core_v2`, scoped strictly to `ACTIVE_STUDENT_KEEP_SET`.

## 12. Migration graph (Phase F order, dependency-driven)

```
Users (KEEP_SET only)
  → Households → HouseholdParents
  → Students (re-parented to Household)
    → CoachProfiles (all, capability is coach-level not student-level)
      → CoachCourseCapabilities (seeded from CoachProfile.subjects × catalog)
    → StudentCourseEnrollments (explicit SPECIALTY/OPTION only)
    → CoachStudentCourseAssignments  ← REBUILD, not backfill (Phase G — see §9 caveat)
      → PlanningSeries (future/active only)
        → SessionBookings (future only, or KEEP_SET history if owner wants it retained)
  → Subscriptions (active) / Entitlements (active) / financial history to retain (separate track, §13)
```

Nothing downstream of `CoachStudentCourseAssignment` migrates automatically from a legacy row — each new assignment requires an explicit current-truth decision (owner, assistante, or a fresh coach/family confirmation), never an automatic carry-forward of an old `subjects[]`/`academicCourseKeys[]` row.

## 13. Finance/history preservation plan

`Payment`, `Invoice`, `InvoiceItem`, `Entitlement`, `CreditTransaction` are already keyed to `User`/`Student` without entanglement in the assignment/planning legacy mess (confirmed in §1). Recommendation: **retain in full**, independent of the KEEP/ARCHIVE/DELETE roster decision on students — a student classified DELETE from the pedagogical roster may still have financial records subject to legal/accounting retention (invoices, tax records). Split explicitly:
- `ACTIVE_OPERATIONAL_DATA` — students/assignments/planning in KEEP_SET, migrated live into `nexus_core_v2`.
- `FINANCIAL_HISTORY_TO_RETAIN` — all `Invoice`/`Payment`/`Entitlement` rows, retained regardless of student roster bucket, in a form that never becomes a source of truth for cursus/assignments (no FK from billing into `CoachStudentCourseAssignment`).
- `DISPOSABLE_LEGACY_DATA` — pedagogical rows (old `Session`, old `CoachStudentAssignment`, stale enrollments) for students bucketed DELETE.

## 14. Cutover plan (outline, per mission Phase L — not executed in this pass)

1. Full legacy backup + checksum + offsite (canonical mechanism, already proven working this session).
2. Freeze writes per the private runbook.
3. Final delta ETL of `KEEP_SET` from `nexus_prod` → `nexus_core_v2`.
4. Canary-start Core v2 app against `nexus_core_v2`, internal/loopback only.
5. Golden Family v2 (Phase J) + five-role smoke on the canary.
6. Atomic pointer switch per the existing `verify-release-pointers.sh` mechanism (already audited this session, still in place at `/opt/nexus-ops/`).
7. `nexus_prod` → read-only, retained, not dropped.

## 15. Rollback plan (outline)

- Old app + old schema (`nexus_prod`) remains fully intact and untouched (`LEGACY_SOURCE_READ_ONLY`, never written during the transition) — rollback is "point the pointer back," not a DB restore.
- No down-migration attempted at any point (consistent with the existing go-live mission's rollback rule).
- `nexus_core_v2` can be dropped and rebuilt from `nexus_prod` + the ETL script at zero data loss to the legacy source, since the legacy source is never mutated by this process.

## 16. Estimated destructive operations (none executed — estimate only)

- `DROP TABLE sessions` (legacy) — after archival decision on historical rows, zero live consumers.
- `DROP COLUMN coach_student_assignments.{subjects,academicCourseKeys,courseScopeState}` — after `CoachStudentCourseAssignment` cutover.
- `DROP COLUMN coach_profiles.subjects` — after `CoachCourseCapability` cutover and the 2 authorization surfaces (§3.3) unified.
- `DROP COLUMN students.grade` — after the 2 real logic sites (§3.1) migrated.
- `DROP COLUMN "SessionBooking".{studentId,coachId,parentId}` (User.id) — after the 3 real authorization sites (§3.6) migrated.
- Student-row deletions for the 132 `DELETE`-bucketed students — **only after** owner sign-off on the 90-day recency judgment call (§8) and a dedicated backup/inventory/hash pass per mission Phase N (`BACKUP → INVENTORY → KEEP_SET → HASH/COUNTS → DELETE`), never a bare `DELETE FROM students`.

## 17. Tests to add (Phase I — hard architecture tests)

Failing-by-design tests to add once Core v2 lands, so CI blocks legacy reintroduction:
- Fails if `Student.grade` (or its Core v2 equivalent field) is read anywhere in `lib/`/`app/` outside an explicitly allow-listed display-only file.
- Fails if `CoachProfile.subjects` decides a capability (i.e. any authorization-relevant read outside the admin-edit UI for the field itself).
- Fails if a legacy `CoachStudentAssignment`-shaped multi-course row can be constructed (schema-level, not just a runtime test — the new model can't represent it).
- Fails if `Session` (legacy model) receives a write.
- Fails if `SessionBooking.{studentId,coachId,parentId}` (User.id) decides identity anywhere outside notification/display.
- Fails if more than one course-selection source is read for a given student (StudentAcademicEnrollment vs. any other path).

---

## 18. Report summary (25-point mission checklist)

1. **CURRENT_MAIN_SHA:** `7313e738928522cb8066c2b323cd745fcd0a48eb` (origin/main, unchanged since PR #220 merge).
2. **Current schema inventory:** §1.
3. **Source-of-truth conflicts:** §2, detailed in §3.
4. **Canonical keep models:** §4.
5. **Models to replace:** §5.
6. **Legacy models to delete:** §6 (models), §6 (fields, same section).
7. **Fields to delete:** §6.
8. **Routes using legacy sources:** §3 (per-item tables), full list ~60 sites across 7 legacy fields/models.
9. **Proposed Core v2 schema:** §10.
10. **Proposed fresh migration baseline:** §11.
11. **ACTIVE_STUDENT_KEEP_SET count:** 62 (of 194) — §8, **with an explicit caveat that 84% of it rests on an owner-unreviewed 90-day recency judgment call, not a mission-specified signal.**
12. **ARCHIVE count:** 0 (mechanically; see §8 note on why).
13. **DELETE candidate count:** 132.
14. **AMBIGUOUS student count:** 0 formally, but 6 students are recency-boundary-sensitive (§8) and the entire 90-day threshold itself is owner-reviewable.
15. **Case A student classification:** KEEP mechanically, but **circular** (only via the disputed assignment) — real answer still pending your Case A decision. §9.
16. **Case B student classification:** Same — KEEP mechanically, circular via disputed assignment, pending your Case B decision. §9.
17. **Finance/history preservation plan:** §13.
18. **Migration graph:** §12.
19. **Cutover plan:** §14 (outline only, not executed).
20. **Rollback plan:** §15.
21. **Estimated destructive operations:** §16 (estimate only, nothing executed).
22. **Tests to add:** §17.
23. **P0/P1/P2/P3:** 0/0/0/0 — this pass is read-only design/audit; no code defects to rate. (5 UNKNOWNs open, §7, none blocking.)
24. **UNKNOWN:** 5 open items, §7 — none block this report; all are bounded Phase B follow-ups.
25. **CORE_V2_ARCHITECTURE_READY:** **false.** This is a read-only inventory/design pass only, as instructed. Nothing was deployed, migrated, or deleted. Awaiting your review of: (a) the proposed schema in §10, (b) the 90-day KEEP_SET recency judgment call in §8, and (c) resolution of the still-pending Case A/Case B decision that the Case A student's and the Case B student's real disposition depends on regardless of roster bucket.
