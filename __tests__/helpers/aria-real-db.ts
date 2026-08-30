import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';

export interface AriaRealDbFixtureIds {
  readonly parentUser: string;
  readonly parent: string;
  readonly studentUser: string;
  readonly student: string;
  readonly entitlement: string;
}

export async function seedAriaRealDbFixture(
  pool: Pool,
  courseKey = 'eds-maths-premiere',
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
  await pool.query(
    `INSERT INTO entitlements
     (id, "userId", "productCode", label, status, "startsAt", "endsAt", "createdAt", "updatedAt")
     VALUES ($1, $2, 'ARIA_ACCESS', 'ARIA', 'ACTIVE', NOW() - INTERVAL '1 day',
             NOW() + INTERVAL '30 days', NOW(), NOW())`,
    [ids.entitlement, ids.studentUser],
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
  await pool.query(
    `DELETE FROM canonical_job_outbox
     WHERE "jobType"='RECOVER_ARIA_TURN'
       AND "aggregateId" IN (
         SELECT id FROM aria_conversation_turns WHERE "subjectStudentId"=$1
       )`,
    [ids.student],
  );
  await pool.query('DELETE FROM aria_conversations WHERE "studentId" = $1', [ids.student]);
  await pool.query('DELETE FROM users WHERE id = ANY($1::text[])', [[ids.studentUser, ids.parentUser]]);
}
