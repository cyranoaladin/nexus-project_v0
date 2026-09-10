-- Core v2 foundation — invariants Prisma's schema DSL cannot express, as
-- documented in core-v2/prisma/schema.prisma and
-- docs/architecture/adr/0001-core-v2-single-source-of-truth.md (items 1b and
-- 4b). This runs against a fresh, empty-until-now Core v2 database only —
-- there is no pre-existing row that could ever violate either constraint at
-- migration time, so no preflight duplicate/violation check is needed here
-- (contrast with prisma/migrations/20260903120000_aria_canonical_grant_invoice_uniqueness,
-- which guards an in-place migration against pre-existing legacy data).

-- ADR item 1b: an AcademicYear's end must be strictly after its start. Not
-- expressible as a Prisma `@@check` in the installed Prisma version (6.19.3).
ALTER TABLE "academic_years"
  ADD CONSTRAINT "academic_years_ends_after_starts_check"
  CHECK ("endsAt" > "startsAt");

-- ADR item 4b: never more than one simultaneously-ACTIVE assignment for the
-- same (coach, enrollment, courseKey) triple. Historical (ENDED) rows for
-- the same triple are explicitly allowed — re-assigning a coach to the same
-- course in a later period, or correcting a mistaken assignment, are
-- legitimate; only concurrent ACTIVE duplication is forbidden. A partial
-- unique index is the chosen mechanism (same pattern as this codebase's
-- existing entitlements_aria_access_invoice_key) — Prisma's schema DSL
-- cannot express a WHERE-clause index, so this table has no `@@unique` for
-- it in core-v2/prisma/schema.prisma; this index is the sole enforcement.
CREATE UNIQUE INDEX "coach_student_course_assignments_active_triple_key"
  ON "coach_student_course_assignments" ("coachId", "academicYearEnrollmentId", "courseKey")
  WHERE "status" = 'ACTIVE';
