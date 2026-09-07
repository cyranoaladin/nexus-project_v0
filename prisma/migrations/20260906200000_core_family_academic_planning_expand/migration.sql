-- Expand-only foundation for qualified family requests, canonical academic scope,
-- recurring planning series and a gradual SessionBooking identity migration.
-- Existing User-based booking foreign keys and assignment subjects are retained.

-- Fail before every DDL statement if the deterministic Student.userId backfill
-- would make existing active bookings violate the new student exclusion. Only
-- aggregate counts are emitted: no user, profile or booking identifier leaves
-- the database. Staff must resolve the source bookings explicitly; this
-- migration never cancels one, selects a winner or changes their status.
DO $student_overlap_preflight$
DECLARE
  conflict_pair_count BIGINT;
  affected_student_count BIGINT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(DISTINCT student."id")
  INTO conflict_pair_count, affected_student_count
  FROM "SessionBooking" AS first_booking
  JOIN "SessionBooking" AS second_booking
    ON second_booking."studentId" = first_booking."studentId"
   AND second_booking."id" > first_booking."id"
  JOIN "students" AS student
    ON student."userId" = first_booking."studentId"
  WHERE first_booking."status" IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
    AND second_booking."status" IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
    AND first_booking."scheduledDate" = second_booking."scheduledDate"
    AND tsrange(
      session_time_to_timestamp(first_booking."scheduledDate"::DATE, first_booking."startTime"),
      session_time_to_timestamp(first_booking."scheduledDate"::DATE, first_booking."endTime")
    ) && tsrange(
      session_time_to_timestamp(second_booking."scheduledDate"::DATE, second_booking."startTime"),
      session_time_to_timestamp(second_booking."scheduledDate"::DATE, second_booking."endTime")
    );

  IF conflict_pair_count > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = format(
        'CORE_STUDENT_BOOKING_OVERLAP_PRECHECK_FAILED conflict_pairs=%s affected_students=%s',
        conflict_pair_count,
        affected_student_count
      );
  END IF;
END
$student_overlap_preflight$;

CREATE TYPE "FamilyRequestType" AS ENUM ('BILAN_GRATUIT', 'ADD_CHILD');
CREATE TYPE "FamilyRequestStatus" AS ENUM ('SUBMITTED', 'QUALIFIED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED');
CREATE TYPE "AssignmentCourseScopeState" AS ENUM (
  'STAFF_VERIFIED',
  'BACKFILL_AUTO',
  'BACKFILL_UNRESOLVED',
  'BACKFILL_AMBIGUOUS'
);
CREATE TYPE "PlanningSeriesStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED');

ALTER TABLE "students"
  ADD COLUMN "academicRevision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "coach_student_assignments"
  ADD COLUMN "academicCourseKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "courseScopeState" "AssignmentCourseScopeState" NOT NULL DEFAULT 'BACKFILL_UNRESOLVED';

ALTER TABLE "canonical_api_idempotency_keys"
  ADD COLUMN "payloadHash" TEXT;

-- Canonical profile and planning columns stay nullable throughout this expand phase.
ALTER TABLE "SessionBooking"
  ADD COLUMN "studentProfileId" TEXT,
  ADD COLUMN "coachProfileId" TEXT,
  ADD COLUMN "assignmentId" TEXT,
  ADD COLUMN "academicCourseKey" TEXT,
  ADD COLUMN "planningSeriesId" TEXT,
  ADD COLUMN "occurrenceKey" TEXT,
  ADD COLUMN "overridesBookingId" TEXT;

CREATE TABLE "family_requests" (
  "id" TEXT NOT NULL,
  "type" "FamilyRequestType" NOT NULL,
  "status" "FamilyRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
  "requestingParentProfileId" TEXT,
  "contactFirstName" TEXT NOT NULL,
  "contactLastName" TEXT NOT NULL,
  "contactEmail" TEXT,
  "contactPhone" TEXT NOT NULL,
  "contactPhoneNormalized" TEXT NOT NULL,
  "consentVersion" TEXT NOT NULL,
  "consentAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "processedById" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "family_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "family_request_children" (
  "id" TEXT NOT NULL,
  "familyRequestId" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "birthDate" TIMESTAMP(3),
  "schoolingStatus" "SchoolingStatus",
  "gradeLevel" "GradeLevel" NOT NULL,
  "academicTrack" "AcademicTrack",
  "stmgPathway" "StmgPathway",
  "school" TEXT,
  "academicCourseKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "family_request_children_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "planning_series" (
  "id" TEXT NOT NULL,
  "studentProfileId" TEXT NOT NULL,
  "coachProfileId" TEXT NOT NULL,
  "assignmentId" TEXT NOT NULL,
  "academicCourseKey" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Tunis',
  "startDate" DATE NOT NULL,
  "localStartTime" TEXT NOT NULL,
  "localEndTime" TEXT NOT NULL,
  "recurrenceRule" TEXT NOT NULL,
  "recurrenceCount" INTEGER,
  "recurrenceUntil" DATE,
  "modality" "SessionModality" NOT NULL,
  "location" TEXT,
  "status" "PlanningSeriesStatus" NOT NULL DEFAULT 'ACTIVE',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "planning_series_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "planning_series_recurrence_count_check" CHECK ("recurrenceCount" IS NULL OR "recurrenceCount" > 0),
  CONSTRAINT "planning_series_recurrence_limit_check" CHECK (NOT ("recurrenceCount" IS NOT NULL AND "recurrenceUntil" IS NOT NULL)),
  CONSTRAINT "planning_series_local_time_format_check" CHECK (
    "localStartTime" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "localEndTime" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'
    AND "localStartTime" < "localEndTime"
  )
);

CREATE TABLE "planning_override_audits" (
  "id" TEXT NOT NULL,
  "sessionBookingId" TEXT NOT NULL,
  "planningSeriesId" TEXT,
  "overrideCode" TEXT NOT NULL,
  "overrideReason" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "previousValues" JSONB NOT NULL,
  "nextValues" JSONB NOT NULL,

  CONSTRAINT "planning_override_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "family_requests_status_createdAt_idx"
  ON "family_requests"("status", "createdAt");
CREATE INDEX "family_requests_type_status_idx"
  ON "family_requests"("type", "status");
CREATE INDEX "family_requests_requestingParentProfileId_createdAt_idx"
  ON "family_requests"("requestingParentProfileId", "createdAt");
CREATE INDEX "family_requests_contactPhoneNormalized_createdAt_idx"
  ON "family_requests"("contactPhoneNormalized", "createdAt");
CREATE INDEX "family_request_children_familyRequestId_idx"
  ON "family_request_children"("familyRequestId");

CREATE INDEX "coach_student_assignments_courseScopeState_status_idx"
  ON "coach_student_assignments"("courseScopeState", "status");

CREATE INDEX "planning_series_studentProfileId_status_idx"
  ON "planning_series"("studentProfileId", "status");
CREATE INDEX "planning_series_coachProfileId_status_idx"
  ON "planning_series"("coachProfileId", "status");
CREATE INDEX "planning_series_assignmentId_status_idx"
  ON "planning_series"("assignmentId", "status");
CREATE INDEX "planning_series_academicCourseKey_status_idx"
  ON "planning_series"("academicCourseKey", "status");
CREATE INDEX "planning_override_audits_sessionBookingId_occurredAt_idx"
  ON "planning_override_audits"("sessionBookingId", "occurredAt");
CREATE INDEX "planning_override_audits_planningSeriesId_occurredAt_idx"
  ON "planning_override_audits"("planningSeriesId", "occurredAt");
CREATE INDEX "planning_override_audits_actorId_occurredAt_idx"
  ON "planning_override_audits"("actorId", "occurredAt");

CREATE UNIQUE INDEX "SessionBooking_occurrenceKey_key"
  ON "SessionBooking"("occurrenceKey");
CREATE UNIQUE INDEX "SessionBooking_overridesBookingId_key"
  ON "SessionBooking"("overridesBookingId");
CREATE INDEX "SessionBooking_studentProfileId_scheduledDate_idx"
  ON "SessionBooking"("studentProfileId", "scheduledDate");
CREATE INDEX "SessionBooking_coachProfileId_scheduledDate_idx"
  ON "SessionBooking"("coachProfileId", "scheduledDate");
CREATE INDEX "SessionBooking_assignmentId_idx"
  ON "SessionBooking"("assignmentId");
CREATE INDEX "SessionBooking_planningSeriesId_scheduledDate_idx"
  ON "SessionBooking"("planningSeriesId", "scheduledDate");

ALTER TABLE "family_requests"
  ADD CONSTRAINT "family_requests_requestingParentProfileId_fkey"
  FOREIGN KEY ("requestingParentProfileId") REFERENCES "parent_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "family_requests_processedById_fkey"
  FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "family_request_children"
  ADD CONSTRAINT "family_request_children_familyRequestId_fkey"
  FOREIGN KEY ("familyRequestId") REFERENCES "family_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "planning_series"
  ADD CONSTRAINT "planning_series_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "students"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "planning_series_coachProfileId_fkey"
  FOREIGN KEY ("coachProfileId") REFERENCES "coach_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "planning_series_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "coach_student_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "planning_series_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Deterministic profile identity backfill: both source columns are unique user links.
-- No assignment, course or planning series is inferred from historical bookings.
UPDATE "SessionBooking" AS booking
SET "studentProfileId" = student."id"
FROM "students" AS student
WHERE booking."studentProfileId" IS NULL
  AND student."userId" = booking."studentId";

UPDATE "SessionBooking" AS booking
SET "coachProfileId" = coach."id"
FROM "coach_profiles" AS coach
WHERE booking."coachProfileId" IS NULL
  AND coach."userId" = booking."coachId";

ALTER TABLE "SessionBooking"
  ADD CONSTRAINT "SessionBooking_studentProfileId_fkey"
  FOREIGN KEY ("studentProfileId") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SessionBooking_coachProfileId_fkey"
  FOREIGN KEY ("coachProfileId") REFERENCES "coach_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SessionBooking_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "coach_student_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SessionBooking_planningSeriesId_fkey"
  FOREIGN KEY ("planningSeriesId") REFERENCES "planning_series"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "SessionBooking_overridesBookingId_fkey"
  FOREIGN KEY ("overridesBookingId") REFERENCES "SessionBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "planning_override_audits"
  ADD CONSTRAINT "planning_override_audits_sessionBookingId_fkey"
  FOREIGN KEY ("sessionBookingId") REFERENCES "SessionBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "planning_override_audits_planningSeriesId_fkey"
  FOREIGN KEY ("planningSeriesId") REFERENCES "planning_series"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "planning_override_audits_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Student-side equivalent of SessionBooking_no_overlap_excl. It applies only
-- when canonical identity is known and only to operationally active bookings.
ALTER TABLE "SessionBooking"
ADD CONSTRAINT "SessionBooking_student_profile_no_overlap_excl"
EXCLUDE USING gist (
  "studentProfileId" WITH =,
  "scheduledDate" WITH =,
  tsrange(
    session_time_to_timestamp("scheduledDate"::DATE, "startTime"),
    session_time_to_timestamp("scheduledDate"::DATE, "endTime")
  ) WITH &&
)
WHERE ("studentProfileId" IS NOT NULL AND status IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'));

-- UNRESOLVED ACTIVE OR FUTURE BOOKING IDENTITIES
-- Run after deployment; identifiers are opaque and no family PII is selected:
-- SELECT "id", "status", "scheduledDate", "studentProfileId", "coachProfileId"
-- FROM "SessionBooking"
-- WHERE ("status" IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS') OR "scheduledDate" >= CURRENT_DATE)
--   AND ("studentProfileId" IS NULL OR "coachProfileId" IS NULL)
-- ORDER BY "scheduledDate", "id";

-- UNRESOLVED ACTIVE ASSIGNMENT COURSE SCOPES
-- Empty keys are never guessed from legacy Subject values:
-- SELECT "courseScopeState", COUNT(*) AS "assignmentCount"
-- FROM "coach_student_assignments"
-- WHERE "status" = 'ACTIVE'
--   AND "courseScopeState" IN ('BACKFILL_UNRESOLVED', 'BACKFILL_AMBIGUOUS')
-- GROUP BY "courseScopeState"
-- ORDER BY "courseScopeState";
