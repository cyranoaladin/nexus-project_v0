/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { prisma } from '@/lib/prisma';
import { prismaLearningEvidenceRepository } from '@/lib/aria/infrastructure/prisma/learning-evidence-repository';
import { generateAndPersistAriaPeriodicBilan } from '@/lib/aria/bilans/periodic/generate-and-persist-periodic-bilan';
import { AriaError } from '@/lib/aria/kernel/errors';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const REAL_COURSE_KEY = 'eds-maths-premiere';
const SKILL_A = 'ALG_SUITE_ARITH';
const CURRICULUM_VERSION = '2026-v1';

const PERIOD_START = new Date('2026-08-29T00:00:00.000Z');
const PERIOD_END = new Date('2026-09-12T00:00:00.000Z');

function daysAgo(n: number): Date {
  return new Date(PERIOD_END.getTime() - n * 24 * 60 * 60 * 1000);
}

async function seedEvidence(
  studentId: string,
  skillId: string,
  outcome: 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT',
  observedAt: Date,
): Promise<void> {
  await prismaLearningEvidenceRepository.create({
    studentId,
    courseKey: REAL_COURSE_KEY,
    skillId,
    curriculumVersion: CURRICULUM_VERSION,
    source: 'PRACTICE_ATTEMPT',
    sourceRefId: randomUUID(),
    outcome: { outcome, activityAttemptId: randomUUID() },
    observedAt,
  });
}

async function cleanupEvidenceAndBilans(pool: Pool, studentId: string): Promise<void> {
  await pool.query('DELETE FROM aria_learning_evidence WHERE "studentId" = $1', [studentId]);
  await pool.query('DELETE FROM bilans WHERE "studentId" = $1', [studentId]);
}

describe('ARIA periodic bilans (P7b-1) on PostgreSQL', () => {
  let pool: Pool;
  let child: AriaRealDbFixtureIds;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    child = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Mehdi', child.studentUser]);
  });

  afterAll(async () => {
    await cleanupEvidenceAndBilans(pool, child.student);
    await cleanupAriaRealDbFixture(pool, child);
    await pool.end();
  });

  afterEach(async () => {
    await cleanupEvidenceAndBilans(pool, child.student);
  });

  it('persists a real, unpublished Bilan computed from real LearningEvidence in the period', async () => {
    await seedEvidence(child.student, SKILL_A, 'CORRECT', daysAgo(1));
    await seedEvidence(child.student, SKILL_A, 'CORRECT', daysAgo(2));
    await seedEvidence(child.student, SKILL_A, 'INCORRECT', daysAgo(3));

    const result = await generateAndPersistAriaPeriodicBilan({
      studentId: child.student,
      courseKey: REAL_COURSE_KEY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });

    expect(result.report.totalAttemptsInPeriod).toBe(3);

    const persisted = await prisma.bilan.findUnique({ where: { id: result.bilanId } });
    expect(persisted).not.toBeNull();
    expect(persisted!.type).toBe('ARIA_PERIODIC');
    expect(persisted!.studentId).toBe(child.student);
    expect(persisted!.subject).toBe('MATHEMATIQUES');
    expect(persisted!.status).toBe('COMPLETED');
    // The core confidentiality invariant for this whole lot: never published
    // automatically — a human must review and publish it (P7b-2).
    expect(persisted!.isPublished).toBe(false);
    expect(persisted!.publishedAt).toBeNull();
    expect(persisted!.studentMarkdown).toContain('Mehdi');
    expect(persisted!.parentsMarkdown).not.toBeNull();
  });

  it('refuses to create a bilan when there is no ARIA activity in the requested period (real DB, no row created)', async () => {
    // Evidence exists, but entirely OUTSIDE the requested period.
    await seedEvidence(child.student, SKILL_A, 'CORRECT', new Date('2026-01-01T00:00:00.000Z'));

    await expect(
      generateAndPersistAriaPeriodicBilan({
        studentId: child.student,
        courseKey: REAL_COURSE_KEY,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      }),
    ).rejects.toThrow(AriaError);

    const count = await prisma.bilan.count({ where: { studentId: child.student } });
    expect(count).toBe(0);
  });

  it('rejects an unknown course key without creating a bilan', async () => {
    await expect(
      generateAndPersistAriaPeriodicBilan({
        studentId: child.student,
        courseKey: 'not-a-real-course',
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      }),
    ).rejects.toThrow(AriaError);

    const count = await prisma.bilan.count({ where: { studentId: child.student } });
    expect(count).toBe(0);
  });

  it('rejects an inverted or empty period window', async () => {
    await seedEvidence(child.student, SKILL_A, 'CORRECT', daysAgo(1));

    await expect(
      generateAndPersistAriaPeriodicBilan({
        studentId: child.student,
        courseKey: REAL_COURSE_KEY,
        periodStart: PERIOD_END,
        periodEnd: PERIOD_START,
      }),
    ).rejects.toThrow(AriaError);
  });

  it('rejects an unknown studentId without creating a bilan', async () => {
    await expect(
      generateAndPersistAriaPeriodicBilan({
        studentId: 'not-a-real-student-id',
        courseKey: REAL_COURSE_KEY,
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      }),
    ).rejects.toThrow(AriaError);
  });
});
