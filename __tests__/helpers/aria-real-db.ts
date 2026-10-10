import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { cleanupDisposableTestFixture } from './real-db-fixture-cleanup';

export interface AriaRealDbFixtureIds {
  readonly parentUser: string;
  readonly parent: string;
  readonly studentUser: string;
  readonly student: string;
  readonly entitlement: string;
}

export interface SeedAriaRealDbFixtureOptions {
  /**
   * Instant the ARIA entitlement validity window is anchored to (`startsAt` =
   * one day before, `endsAt` = thirty days after). Pass the SAME fixed instant
   * a caller evaluates eligibility at (e.g. the workshop-reminder suite's
   * "24h before the session" anchor) so the window always brackets it,
   * independent of wall-clock. Omit it only when the caller genuinely evaluates
   * at live time — the default stays real-now, preserving existing behaviour.
   *
   * Anchoring to an explicit instant (passed as a SQL parameter) instead of
   * PostgreSQL `NOW()` is what defuses the time-bomb: mixing a fixed Node test
   * anchor with the database clock made the window drift past the fixed test
   * instants once real UTC passed them.
   */
  readonly now?: Date;
}

export async function seedAriaRealDbFixture(
  pool: Pool,
  courseKey = 'eds-maths-premiere',
  options: SeedAriaRealDbFixtureOptions = {},
): Promise<AriaRealDbFixtureIds> {
  const ids = {
    parentUser: randomUUID(),
    parent: randomUUID(),
    studentUser: randomUUID(),
    student: randomUUID(),
    entitlement: randomUUID(),
  };
  await pool.query(
    `INSERT INTO users (id, email, role, "updatedAt") VALUES
     ($1, $2, 'PARENT', NOW()), ($3, $4, 'ELEVE', NOW())`,
    [ids.parentUser, `parent-${ids.parentUser}@invalid.test`, ids.studentUser, `student-${ids.studentUser}@invalid.test`],
  );
  await pool.query('INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)', [ids.parent, ids.parentUser]);
  await pool.query(
    `INSERT INTO students
     (id, "parentId", "userId", "gradeLevel", "academicTrack", "updatedAt")
     VALUES ($1, $2, $3, 'PREMIERE', 'EDS_GENERALE', NOW())`,
    [ids.student, ids.parent, ids.studentUser],
  );
  await pool.query(
    `INSERT INTO student_academic_enrollments
     (id, "studentId", "courseKey", kind, source, "curriculumVersion", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW())`,
    [randomUUID(), ids.student, courseKey],
  );
  // Window anchored to an explicit instant passed as a SQL parameter, never
  // PostgreSQL NOW() — see SeedAriaRealDbFixtureOptions.now. Interval maths stay
  // in SQL (identical to the original `anchor ± INTERVAL`), only the anchor
  // changes, so timezone handling is unchanged. Default anchor is real-now.
  const entitlementAnchorIso = (options.now ?? new Date()).toISOString();
  await pool.query(
    `INSERT INTO entitlements
     (id, "userId", "productCode", label, status, "startsAt", "endsAt", "createdAt", "updatedAt")
     VALUES ($1, $2, 'ARIA_ACCESS', 'ARIA', 'ACTIVE', $3::timestamptz - INTERVAL '1 day',
             $3::timestamptz + INTERVAL '30 days', NOW(), NOW())`,
    [ids.entitlement, ids.studentUser, entitlementAnchorIso],
  );
  await pool.query(
    `INSERT INTO aria_entitlement_scopes
     (id, "entitlementId", kind, "courseKey", "createdAt", "updatedAt")
     VALUES ($1, $2, 'COURSE', $3, NOW(), NOW())`,
    [randomUUID(), ids.entitlement, courseKey],
  );
  return ids;
}

export async function cleanupAriaRealDbFixture(
  pool: Pool,
  ids: AriaRealDbFixtureIds,
): Promise<void> {
  // canonical_job_outbox carries no foreign key at all: it is addressed by
  // `aggregateId`, a plain text column. No edge leads to it from an account
  // root, so the canonical helper cannot see it and never will. This is the one
  // row this fixture owns outside the foreign-key graph, and the only reason a
  // hand-written statement survives in this file.
  await pool.query(
    `DELETE FROM canonical_job_outbox
     WHERE "jobType"='RECOVER_ARIA_TURN'
       AND "aggregateId" IN (
         SELECT id FROM aria_conversation_turns WHERE "subjectStudentId"=$1
       )`,
    [ids.student],
  );

  // Everything else this fixture created — conversations, turns, the academic
  // enrolment, the entitlement and its scopes, the student, the parent profile
  // and both users — is reachable from the two account roots, so the order is
  // derived from the live schema instead of being maintained here. That is the
  // whole point: the hand-written list above this line used to be four
  // statements long and still missed `entitlements`, which is what turned the
  // ARIA lanes red.
  await cleanupDisposableTestFixture(pool, {
    userIds: [ids.studentUser, ids.parentUser],
  });
}
