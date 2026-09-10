/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { recordLearningEvidence } from '@/lib/aria/application/evidence/record';
import { listLearningEvidenceForStudent } from '@/lib/aria/application/evidence/list';
import { AriaError } from '@/lib/aria/kernel/errors';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const REAL_COURSE_KEY = 'eds-maths-premiere';
const REAL_SKILL_ID = 'ALG_SUITE_ARITH';

async function cleanupLearningEvidence(pool: Pool, studentIds: readonly string[]): Promise<void> {
  await pool.query('DELETE FROM aria_learning_evidence WHERE "studentId" = ANY($1::text[])', [studentIds]);
}

describe('ARIA LearningEvidence on PostgreSQL', () => {
  let pool: Pool;
  let studentA: AriaRealDbFixtureIds;
  let studentB: AriaRealDbFixtureIds;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    studentA = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    studentB = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
  });

  afterAll(async () => {
    await cleanupLearningEvidence(pool, [studentA.student, studentB.student]);
    await cleanupAriaRealDbFixture(pool, studentA);
    await cleanupAriaRealDbFixture(pool, studentB);
    await pool.end();
  });

  it('records real evidence and reads it back for its owning student', async () => {
    const written = await recordLearningEvidence({
      studentId: studentA.student,
      courseKey: REAL_COURSE_KEY,
      skillId: REAL_SKILL_ID,
      curriculumVersion: '2026-v1',
      source: 'PRACTICE_ATTEMPT',
      sourceRefId: 'db-test-attempt-1',
      outcome: { outcome: 'CORRECT', activityAttemptId: 'db-test-attempt-1' },
    });
    expect(written.studentId).toBe(studentA.student);
    expect(written.skillId).toBe(REAL_SKILL_ID);

    const list = await listLearningEvidenceForStudent({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
    });
    expect(list.some((row) => row.id === written.id)).toBe(true);
    const readBack = list.find((row) => row.id === written.id)!;
    expect(readBack.outcome).toEqual({ outcome: 'CORRECT', activityAttemptId: 'db-test-attempt-1' });
    expect(readBack.courseKey).toBe(REAL_COURSE_KEY);
    expect(readBack.curriculumVersion).toBe('2026-v1');
  });

  it('records course-level evidence with a null skillId', async () => {
    const written = await recordLearningEvidence({
      studentId: studentA.student,
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      source: 'CONVERSATION_ASSESSMENT',
      sourceRefId: 'db-test-turn-1',
      outcome: { assessment: 'STRONG', turnId: 'db-test-turn-1' },
    });
    expect(written.skillId).toBeNull();
  });

  it('IDOR: a different student cannot read this student\'s evidence', async () => {
    await recordLearningEvidence({
      studentId: studentA.student,
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      source: 'TEACHER_OBSERVATION',
      sourceRefId: 'db-test-obs-1',
      outcome: { note: 'Observation privée A', observedByUserId: 'teacher-1' },
    });
    const listForB = await listLearningEvidenceForStudent({
      actor: { userId: studentB.studentUser, role: 'ELEVE' },
    });
    expect(listForB.every((row) => row.studentId !== studentA.student)).toBe(true);
    expect(listForB.some((row) => row.sourceRefId === 'db-test-obs-1')).toBe(false);
  });

  it('rejects a non-ELEVE actor against real data (documents the scope boundary)', async () => {
    await expect(listLearningEvidenceForStudent({
      actor: { userId: studentA.studentUser, role: 'COACH' },
    })).rejects.toThrow(AriaError);
  });

  it('filters correctly by courseKey, skillId and source against real seeded rows', async () => {
    await recordLearningEvidence({
      studentId: studentB.student,
      courseKey: REAL_COURSE_KEY,
      skillId: REAL_SKILL_ID,
      curriculumVersion: '2026-v1',
      source: 'PRACTICE_ATTEMPT',
      sourceRefId: 'db-test-filter-1',
      outcome: { outcome: 'INCORRECT', activityAttemptId: 'db-test-filter-1' },
    });
    await recordLearningEvidence({
      studentId: studentB.student,
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      source: 'CONVERSATION_ASSESSMENT',
      sourceRefId: 'db-test-filter-2',
      outcome: { assessment: 'STRUGGLING', turnId: 'db-test-filter-2' },
    });

    const bySource = await listLearningEvidenceForStudent({
      actor: { userId: studentB.studentUser, role: 'ELEVE' },
      filters: { source: 'PRACTICE_ATTEMPT' },
    });
    expect(bySource.every((row) => row.source === 'PRACTICE_ATTEMPT')).toBe(true);
    expect(bySource.some((row) => row.sourceRefId === 'db-test-filter-1')).toBe(true);
    expect(bySource.some((row) => row.sourceRefId === 'db-test-filter-2')).toBe(false);

    const bySkill = await listLearningEvidenceForStudent({
      actor: { userId: studentB.studentUser, role: 'ELEVE' },
      filters: { skillId: REAL_SKILL_ID },
    });
    expect(bySkill.every((row) => row.skillId === REAL_SKILL_ID)).toBe(true);

    const byCourse = await listLearningEvidenceForStudent({
      actor: { userId: studentB.studentUser, role: 'ELEVE' },
      filters: { courseKey: REAL_COURSE_KEY },
    });
    expect(byCourse.every((row) => row.courseKey === REAL_COURSE_KEY)).toBe(true);
    expect(byCourse.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects an unknown courseKey against real validation (no row written)', async () => {
    await expect(recordLearningEvidence({
      studentId: studentA.student,
      courseKey: 'not-a-real-course-key',
      skillId: null,
      curriculumVersion: '2026-v1',
      source: 'PRACTICE_ATTEMPT',
      sourceRefId: 'db-test-invalid-course',
      outcome: { outcome: 'CORRECT', activityAttemptId: 'db-test-invalid-course' },
    })).rejects.toThrow(AriaError);
  });

  it('rejects a real User with no corresponding Student row (real resolveStudentIdByUserId null path)', async () => {
    // A real, freshly-seeded User that deliberately has no Student row —
    // exercises resolveStudentIdByUserId's real `null` outcome against
    // actual Postgres, not an assumption.
    const orphanUserId = randomUUID();
    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES ($1, $2, 'ELEVE', NOW())`,
      [orphanUserId, `orphan-${orphanUserId}@invalid.test`],
    );
    try {
      await expect(listLearningEvidenceForStudent({
        actor: { userId: orphanUserId, role: 'ELEVE' },
      })).rejects.toThrow(AriaError);
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [orphanUserId]);
    }
  });

  it('paginates with a real cursor against real seeded rows', async () => {
    await recordLearningEvidence({
      studentId: studentA.student,
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      source: 'EXAM_SIMULATION',
      sourceRefId: 'db-test-cursor-1',
      outcome: { score: 12, maxScore: 20, examSimulationId: 'ds-blanc-1' },
    });
    await recordLearningEvidence({
      studentId: studentA.student,
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      source: 'EXAM_SIMULATION',
      sourceRefId: 'db-test-cursor-2',
      outcome: { score: 15, maxScore: 20, examSimulationId: 'ds-blanc-2' },
    });

    const firstPage = await listLearningEvidenceForStudent({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      filters: { source: 'EXAM_SIMULATION', limit: 1 },
    });
    expect(firstPage).toHaveLength(1);

    const secondPage = await listLearningEvidenceForStudent({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      filters: { source: 'EXAM_SIMULATION', limit: 1, cursor: firstPage[0]!.id },
    });
    expect(secondPage).toHaveLength(1);
    expect(secondPage[0]!.id).not.toBe(firstPage[0]!.id);
  });
});
