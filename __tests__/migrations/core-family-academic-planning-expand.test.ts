import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(
  process.cwd(),
  'prisma/migrations/20260906200000_core_family_academic_planning_expand/migration.sql',
);
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

describe('core family, academic assignment and planning expand migration', () => {
  test('aborts on legacy student overlaps before executing any new DDL', () => {
    const firstDdl = migration.search(/\b(?:CREATE TYPE|ALTER TABLE|CREATE TABLE|CREATE INDEX)\b/);
    expect(firstDdl).toBeGreaterThan(0);
    const preflight = migration.slice(0, firstDdl);

    expect(preflight).toMatch(/DO \$student_overlap_preflight\$/);
    expect(preflight).toMatch(/CORE_STUDENT_BOOKING_OVERLAP_PRECHECK_FAILED/);
    expect(preflight).toMatch(/COUNT\(\*\)[\s\S]*conflict_pair_count/i);
    expect(preflight).toMatch(/COUNT\(DISTINCT student\."id"\)[\s\S]*affected_student_count/i);
    expect(preflight).toMatch(/student\."userId" = first_booking\."studentId"/);
    expect(preflight).toMatch(/second_booking\."studentId" = first_booking\."studentId"/);
    expect(preflight).toMatch(/first_booking\."status" IN \('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'\)/);
    expect(preflight).toMatch(/tsrange\([\s\S]*\) && tsrange\(/);
    expect(preflight).not.toMatch(/\b(?:CREATE|ALTER|DROP|UPDATE|DELETE|TRUNCATE|INSERT)\b/);
    expect(preflight).not.toMatch(/RAISE EXCEPTION[\s\S]*(?:student\."id"|first_booking\."id"|second_booking\."id")/);
  });

  test('creates explicit family request and assignment lifecycle enums', () => {
    expect(migration).toMatch(/CREATE TYPE "FamilyRequestType" AS ENUM \('BILAN_GRATUIT', 'ADD_CHILD'\)/);
    expect(migration).toMatch(
      /CREATE TYPE "FamilyRequestStatus" AS ENUM \('SUBMITTED', 'QUALIFIED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'\)/,
    );
    expect(migration).toMatch(
      /CREATE TYPE "AssignmentCourseScopeState" AS ENUM \([\s\S]*'STAFF_VERIFIED'[\s\S]*'BACKFILL_AUTO'[\s\S]*'BACKFILL_UNRESOLVED'[\s\S]*'BACKFILL_AMBIGUOUS'[\s\S]*\)/,
    );
    expect(migration).toMatch(/CREATE TABLE "family_requests"/);
    expect(migration).toMatch(/CREATE TABLE "family_request_children"/);
  });

  test('adds revisions, course scope and payload hashes without deleting legacy subjects', () => {
    expect(migration).toMatch(/ALTER TABLE "students"[\s\S]*ADD COLUMN\s+"academicRevision" INTEGER NOT NULL DEFAULT 0/);
    expect(migration).toMatch(/ALTER TABLE "coach_student_assignments"[\s\S]*ADD COLUMN\s+"academicCourseKeys" TEXT\[\] NOT NULL DEFAULT ARRAY\[\]::TEXT\[\]/);
    expect(migration).toMatch(/ADD COLUMN\s+"courseScopeState" "AssignmentCourseScopeState" NOT NULL DEFAULT 'BACKFILL_UNRESOLVED'/);
    expect(migration).toMatch(/ALTER TABLE "canonical_api_idempotency_keys"[\s\S]*ADD COLUMN\s+"payloadHash" TEXT/);
    expect(migration).not.toMatch(/DROP COLUMN\s+"subjects"/i);
  });

  test('creates canonical planning series and nullable booking bridge columns', () => {
    expect(migration).toMatch(/CREATE TABLE "planning_series"/);
    for (const column of [
      'studentProfileId',
      'coachProfileId',
      'assignmentId',
      'academicCourseKey',
      'timezone',
      'startDate',
      'localStartTime',
      'localEndTime',
      'recurrenceRule',
      'recurrenceCount',
      'recurrenceUntil',
      'modality',
      'location',
      'status',
      'revision',
      'createdById',
    ]) {
      expect(migration).toContain(`"${column}"`);
    }

    for (const column of [
      'studentProfileId',
      'coachProfileId',
      'assignmentId',
      'academicCourseKey',
      'planningSeriesId',
      'occurrenceKey',
      'overridesBookingId',
    ]) {
      expect(migration).toMatch(new RegExp(`ADD COLUMN\\s+"${column}"`));
    }

    for (const duplicatedAuditColumn of [
      'overrideReason',
      'overrideCreatedById',
      'overrideCreatedAt',
    ]) {
      expect(migration).not.toMatch(new RegExp(`ADD COLUMN\\s+"${duplicatedAuditColumn}"`));
    }

    expect(migration).toMatch(/CREATE UNIQUE INDEX "SessionBooking_occurrenceKey_key"/);
    expect(migration).not.toMatch(/ALTER COLUMN "(?:studentProfileId|coachProfileId)" SET NOT NULL/);
    expect(migration).toMatch(/"createdById" TEXT NOT NULL/);
  });

  test('creates an append-only shaped override audit record with a mandatory actor', () => {
    expect(migration).toMatch(/CREATE TABLE "planning_override_audits"/);
    for (const column of [
      'sessionBookingId',
      'planningSeriesId',
      'overrideCode',
      'overrideReason',
      'actorId',
      'occurredAt',
      'previousValues',
      'nextValues',
    ]) {
      expect(migration).toContain(`"${column}"`);
    }
    expect(migration).toMatch(/"actorId" TEXT NOT NULL/);
    expect(migration).toMatch(/FOREIGN KEY \("actorId"\) REFERENCES "users"\("id"\) ON DELETE RESTRICT/);
    expect(migration).toMatch(/FOREIGN KEY \("sessionBookingId"\) REFERENCES "SessionBooking"\("id"\) ON DELETE RESTRICT/);
    expect(migration).toMatch(/FOREIGN KEY \("createdById"\) REFERENCES "users"\("id"\) ON DELETE RESTRICT/);
  });

  test('backfills only canonical profile ids through unique legacy user links', () => {
    expect(migration).toMatch(
      /UPDATE "SessionBooking" AS booking[\s\S]*SET "studentProfileId" = student\."id"[\s\S]*FROM "students" AS student[\s\S]*student\."userId" = booking\."studentId"/,
    );
    expect(migration).toMatch(
      /UPDATE "SessionBooking" AS booking[\s\S]*SET "coachProfileId" = coach\."id"[\s\S]*FROM "coach_profiles" AS coach[\s\S]*coach\."userId" = booking\."coachId"/,
    );
    expect(migration).not.toMatch(/UPDATE "planning_series"/i);
    expect(migration).not.toMatch(/SET\s+"(?:planningSeriesId|assignmentId|academicCourseKey)"/i);
  });

  test('enforces foreign keys, occurrence uniqueness and active student overlap', () => {
    expect(migration).toMatch(/FOREIGN KEY \("studentProfileId"\) REFERENCES "students"\("id"\) ON DELETE SET NULL/);
    expect(migration).toMatch(/FOREIGN KEY \("coachProfileId"\) REFERENCES "coach_profiles"\("id"\) ON DELETE SET NULL/);
    expect(migration).toMatch(/FOREIGN KEY \("planningSeriesId"\) REFERENCES "planning_series"\("id"\) ON DELETE SET NULL/);
    expect(migration).toMatch(/FOREIGN KEY \("overridesBookingId"\) REFERENCES "SessionBooking"\("id"\) ON DELETE SET NULL/);
    expect(migration).toMatch(
      /ADD CONSTRAINT "SessionBooking_student_profile_no_overlap_excl"[\s\S]*EXCLUDE USING gist[\s\S]*"studentProfileId" WITH =[\s\S]*WITH &&[\s\S]*WHERE \("studentProfileId" IS NOT NULL AND status IN \('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'\)\)/,
    );
  });

  test('ships operational reconciliation reports and remains additive', () => {
    expect(migration).toMatch(/UNRESOLVED ACTIVE OR FUTURE BOOKING IDENTITIES/);
    expect(migration).toMatch(/UNRESOLVED ACTIVE ASSIGNMENT COURSE SCOPES/);
    expect(migration).toMatch(/SELECT[\s\S]*"studentProfileId" IS NULL[\s\S]*"coachProfileId" IS NULL/);
    expect(migration).toMatch(/SELECT[\s\S]*"courseScopeState"[\s\S]*BACKFILL_(?:UNRESOLVED|AMBIGUOUS)/);
    expect(migration).not.toMatch(/^\s*(?:DROP|DELETE|TRUNCATE)\b/im);
  });
});
