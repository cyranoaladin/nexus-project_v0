-- Core v2 planning engine (go-live mission §AK).
--
-- Part 1 is the DDL Prisma generated for the schema change
-- (`prisma migrate diff --from-url <db at 0006> --to-schema-datamodel`):
-- the booking row now carries the participant PROFILE ids (coachId,
-- studentId) as a projection of its assignment.
-- Part 2 is what the DSL cannot express: the double-booking guarantee as
-- database EXCLUSION constraints (no two active bookings of one coach, nor
-- of one student, overlap in time), a trigger that keeps the projected ids
-- equal to the assignment's coach / enrolled student, and the identity
-- generation bump. Runs against a Core v2 database only ever populated by
-- tests/CI so far — session_bookings_v2 is empty, so the NOT NULL columns
-- need no backfill.

-- ────────────────────────────────────────────────────────────────────────────
-- Part 1 — generated DDL
-- ────────────────────────────────────────────────────────────────────────────

-- AlterTable
ALTER TABLE "session_bookings_v2" ADD COLUMN     "coachId" TEXT NOT NULL,
ADD COLUMN     "studentId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "session_bookings_v2_coachId_startsAt_idx" ON "session_bookings_v2"("coachId", "startsAt");

-- CreateIndex
CREATE INDEX "session_bookings_v2_studentId_startsAt_idx" ON "session_bookings_v2"("studentId", "startsAt");

-- AddForeignKey
ALTER TABLE "session_bookings_v2" ADD CONSTRAINT "session_bookings_v2_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "coach_profiles_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_bookings_v2" ADD CONSTRAINT "session_bookings_v2_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- Part 2 — double-booking exclusion, projection integrity, identity bump
-- ────────────────────────────────────────────────────────────────────────────

-- Equality on a text column inside a GiST exclusion needs btree_gist
-- (PostgreSQL contrib; present in the postgres:16 image used by every
-- disposable stack and in CI — a production Core v2 database must ship it).
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- A booking occupies [startsAt, endsAt) (TIMESTAMP(3) columns holding UTC instants,
-- hence tsrange). Only live bookings count; a
-- cancelled/rescheduled/completed row never blocks a slot.
ALTER TABLE "session_bookings_v2"
  ADD CONSTRAINT "session_bookings_v2_coach_no_overlap_excl"
  EXCLUDE USING gist ("coachId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("status" IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'));

ALTER TABLE "session_bookings_v2"
  ADD CONSTRAINT "session_bookings_v2_student_no_overlap_excl"
  EXCLUDE USING gist ("studentId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("status" IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'));

ALTER TABLE "session_bookings_v2"
  ADD CONSTRAINT "session_bookings_v2_time_window_check" CHECK ("endsAt" > "startsAt");

-- coachId / studentId are a projection of the assignment, never an
-- independent authority: any row that disagrees with its assignment is
-- refused at the database.
CREATE OR REPLACE FUNCTION core_v2_session_booking_participants_check() RETURNS trigger AS $$
DECLARE
  expected_coach TEXT;
  expected_student TEXT;
BEGIN
  SELECT a."coachId", e."studentId"
    INTO expected_coach, expected_student
    FROM "coach_student_course_assignments" a
    JOIN "student_academic_year_enrollments" e ON e."id" = a."academicYearEnrollmentId"
   WHERE a."id" = NEW."assignmentId";
  IF expected_coach IS NULL THEN
    RAISE EXCEPTION 'session_bookings_v2: unknown assignment %', NEW."assignmentId" USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF NEW."coachId" <> expected_coach OR NEW."studentId" <> expected_student THEN
    RAISE EXCEPTION 'session_bookings_v2: participants (%, %) do not match assignment % (%, %)',
      NEW."coachId", NEW."studentId", NEW."assignmentId", expected_coach, expected_student
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER core_v2_session_booking_participants
  BEFORE INSERT OR UPDATE OF "coachId", "studentId", "assignmentId" ON "session_bookings_v2"
  FOR EACH ROW EXECUTE FUNCTION core_v2_session_booking_participants_check();

-- Identity generation: a client expecting generation 3 must refuse this database.
UPDATE "core_v2_database_identity" SET "schemaGeneration" = 4 WHERE "id" = 1;
