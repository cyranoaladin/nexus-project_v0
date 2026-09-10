/** @jest-environment node */

import { Pool } from 'pg';
import { seedLearningEvidenceFixture } from '@/scripts/aria/seed-learning-evidence-fixture';
import { inspectLearningEvidence } from '@/scripts/aria/inspect-learning-evidence';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const REAL_COURSE_KEY = 'eds-maths-premiere';

async function cleanupLearningEvidence(pool: Pool, studentIds: readonly string[]): Promise<void> {
  await pool.query('DELETE FROM aria_learning_evidence WHERE "studentId" = ANY($1::text[])', [studentIds]);
}

describe('ARIA LearningEvidence ops CLIs, against real Postgres', () => {
  let pool: Pool;
  let student: AriaRealDbFixtureIds;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    student = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
  });

  afterAll(async () => {
    await cleanupLearningEvidence(pool, [student.student]);
    await cleanupAriaRealDbFixture(pool, student);
    await pool.end();
  });

  it('seed-learning-evidence-fixture writes a real row through the real write path', async () => {
    let loggedId: string | null = null;
    const spy = jest.spyOn(console, 'log').mockImplementation((message: string) => {
      const match = /^ARIA_EVIDENCE_SEED_WRITTEN_ID=(.+)$/.exec(message);
      if (match) loggedId = match[1]!;
    });
    try {
      await seedLearningEvidenceFixture({
        studentId: student.student,
        courseKey: REAL_COURSE_KEY,
        skillId: null,
        curriculumVersion: '2026-v1',
        source: 'PRACTICE_ATTEMPT',
        sourceRefId: 'cli-test-attempt-1',
        outcome: { outcome: 'CORRECT', activityAttemptId: 'cli-test-attempt-1' },
      });
    } finally {
      spy.mockRestore();
    }
    expect(loggedId).not.toBeNull();

    const row = await pool.query('SELECT "sourceRefId" FROM aria_learning_evidence WHERE id = $1', [loggedId]);
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].sourceRefId).toBe('cli-test-attempt-1');
  });

  it('inspect-learning-evidence reads the same row back through the real read path', async () => {
    await seedLearningEvidenceFixture({
      studentId: student.student,
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      source: 'TEACHER_OBSERVATION',
      sourceRefId: 'cli-test-obs-1',
      outcome: { note: 'Observation CLI', observedByUserId: 'teacher-cli-1' },
    });

    const logs: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((message: string) => {
      logs.push(message);
    });
    try {
      await inspectLearningEvidence({ studentUserId: student.studentUser });
    } finally {
      spy.mockRestore();
    }

    expect(logs[0]).toMatch(/^ARIA_EVIDENCE_INSPECT_COUNT=\d+$/);
    const rows = logs.slice(1).map((line) => JSON.parse(line) as { sourceRefId: string });
    expect(rows.some((row) => row.sourceRefId === 'cli-test-obs-1')).toBe(true);
  });

  it('inspect-learning-evidence filters by courseKey/skillId/source', async () => {
    await seedLearningEvidenceFixture({
      studentId: student.student,
      courseKey: REAL_COURSE_KEY,
      skillId: 'ALG_SUITE_ARITH',
      curriculumVersion: '2026-v1',
      source: 'CORRECTION_RESULT',
      sourceRefId: 'cli-test-filter-1',
      outcome: { outcome: 'PARTIALLY_CORRECT', correctionId: 'correction-1', feedbackSummary: 'Bon raisonnement, erreur de calcul.' },
    });

    const logs: string[] = [];
    const spy = jest.spyOn(console, 'log').mockImplementation((message: string) => {
      logs.push(message);
    });
    try {
      await inspectLearningEvidence({
        studentUserId: student.studentUser,
        courseKey: REAL_COURSE_KEY,
        skillId: 'ALG_SUITE_ARITH',
        source: 'CORRECTION_RESULT',
      });
    } finally {
      spy.mockRestore();
    }

    const rows = logs.slice(1).map((line) => JSON.parse(line) as { sourceRefId: string; source: string });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.sourceRefId).toBe('cli-test-filter-1');
    expect(rows[0]!.source).toBe('CORRECTION_RESULT');
  });
});
