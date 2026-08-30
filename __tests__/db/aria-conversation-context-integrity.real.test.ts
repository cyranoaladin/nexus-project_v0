/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { buildAriaConversationContext } from '@/lib/aria/application/conversation/public';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe('ARIA conversation context integrity on PostgreSQL', () => {
  let pool: Pool;
  const ids = {
    parentUser: randomUUID(),
    parent: randomUUID(),
    studentUser: randomUUID(),
    student: randomUUID(),
    otherStudentUser: randomUUID(),
    otherStudent: randomUUID(),
    entitlement: randomUUID(),
    validConversation: randomUUID(),
    crossCourseConversation: randomUUID(),
    otherStudentConversation: randomUUID(),
    invalidStoredContextConversation: randomUUID(),
  };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES
        ($1, $2, 'PARENT', NOW()),
        ($3, $4, 'ELEVE', NOW()),
        ($5, $6, 'ELEVE', NOW())`,
      [
        ids.parentUser,
        `parent-${ids.parentUser}@invalid.test`,
        ids.studentUser,
        `student-${ids.studentUser}@invalid.test`,
        ids.otherStudentUser,
        `student-${ids.otherStudentUser}@invalid.test`,
      ],
    );
    await pool.query(
      'INSERT INTO parent_profiles (id, "userId") VALUES ($1, $2)',
      [ids.parent, ids.parentUser],
    );
    await pool.query(
      `INSERT INTO students
        (id, "parentId", "userId", "gradeLevel", "academicTrack", "updatedAt") VALUES
        ($1, $2, $3, 'PREMIERE', 'EDS_GENERALE', NOW()),
        ($4, $2, $5, 'PREMIERE', 'EDS_GENERALE', NOW())`,
      [ids.student, ids.parent, ids.studentUser, ids.otherStudent, ids.otherStudentUser],
    );
    await pool.query(
      `INSERT INTO student_academic_enrollments
        (id, "studentId", "courseKey", kind, source, "curriculumVersion", "createdAt", "updatedAt")
       VALUES ($1, $2, 'eds-maths-premiere', 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW())`,
      [randomUUID(), ids.student],
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
       VALUES ($1, $2, 'COURSE', 'eds-maths-premiere', NOW(), NOW())`,
      [randomUUID(), ids.entitlement],
    );
    await pool.query(
      `INSERT INTO aria_conversations
        (id, "studentId", "courseKey", "contextState", "skillId", "resourceId", "updatedAt") VALUES
        ($1, $5, 'eds-maths-premiere', 'ACTIVE', 'ALG_SUITE_ARITH', 'res-maths-1ere-prog-bo', NOW()),
        ($2, $5, 'eds-maths-terminale', 'ACTIVE', NULL, NULL, NOW()),
        ($3, $6, 'eds-maths-premiere', 'ACTIVE', NULL, NULL, NOW()),
        ($4, $5, 'eds-maths-premiere', 'ACTIVE', NULL, 'res-nsi-1ere-prog-bo', NOW())`,
      [
        ids.validConversation,
        ids.crossCourseConversation,
        ids.otherStudentConversation,
        ids.invalidStoredContextConversation,
        ids.student,
        ids.otherStudent,
      ],
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE id = $1', [ids.parentUser]);
    await pool.end();
  });

  it('resumes only the exact student, course and stored skill/resource context', async () => {
    await expect(buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      conversationId: ids.validConversation,
      now: new Date('2026-08-30T12:00:00.000Z'),
    })).resolves.toMatchObject({
      courseKey: 'eds-maths-premiere',
      skillId: 'ALG_SUITE_ARITH',
      resourceId: 'res-maths-1ere-prog-bo',
    });

    await expect(buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      conversationId: ids.crossCourseConversation,
    })).rejects.toMatchObject({ code: 'CROSS_COURSE_MISMATCH' });
    await expect(buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      conversationId: ids.otherStudentConversation,
    })).rejects.toMatchObject({ code: 'CONVERSATION_NOT_FOUND' });
    await expect(buildAriaConversationContext({
      actor: { userId: ids.studentUser, role: 'ELEVE' },
      courseKey: 'eds-maths-premiere',
      conversationId: ids.invalidStoredContextConversation,
    })).rejects.toMatchObject({ code: 'RESOURCE_MISMATCH' });
  });
});
