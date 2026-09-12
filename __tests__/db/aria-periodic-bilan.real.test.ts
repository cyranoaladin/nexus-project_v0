/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { prisma } from '@/lib/prisma';
import { prismaLearningEvidenceRepository } from '@/lib/aria/infrastructure/prisma/learning-evidence-repository';
import { generateAndPersistAriaPeriodicBilan } from '@/lib/aria/bilans/periodic/generate-and-persist-periodic-bilan';
import { listAriaPeriodicBilansForParent } from '@/lib/aria/bilans/periodic/list-for-parent';
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

/** Bypasses the repository's own write-time validation, to simulate a row corrupted by something other than `recordLearningEvidence`. */
async function seedCorruptedEvidence(pool: Pool, studentId: string, observedAt: Date): Promise<void> {
  await pool.query(
    `INSERT INTO aria_learning_evidence
     (id, "studentId", "courseKey", "skillId", "curriculumVersion", source, "sourceRefId", outcome, "observedAt", "createdAt")
     VALUES ($1, $2, $3, $4, $5, 'PRACTICE_ATTEMPT', $6, $7::jsonb, $8, NOW())`,
    [randomUUID(), studentId, REAL_COURSE_KEY, SKILL_A, CURRICULUM_VERSION, randomUUID(), JSON.stringify({ outcome: 'NOT_A_REAL_OUTCOME' }), observedAt],
  );
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

  it('rejects a real, known course that has no legacy subject to file a bilan under', async () => {
    await seedEvidence(child.student, SKILL_A, 'CORRECT', daysAgo(1));

    await expect(
      generateAndPersistAriaPeriodicBilan({
        studentId: child.student,
        // Real, known catalog course — but `legacySubject: null` (e.g. Grand
        // Oral): there is no `Subject` enum value a `Bilan` row could use.
        courseKey: 'tc-grand-oral-terminale',
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      }),
    ).rejects.toThrow(AriaError);

    const count = await prisma.bilan.count({ where: { studentId: child.student } });
    expect(count).toBe(0);
  });

  it('rejects a real, known course that has no compiled skill graph yet', async () => {
    await expect(
      generateAndPersistAriaPeriodicBilan({
        studentId: child.student,
        // Real, known catalog course with a real legacySubject, but not in
        // the compiled skill-graph registry (e.g. collège maths).
        courseKey: 'tc-maths-quatrieme',
        periodStart: PERIOD_START,
        periodEnd: PERIOD_END,
      }),
    ).rejects.toThrow(AriaError);

    const count = await prisma.bilan.count({ where: { studentId: child.student } });
    expect(count).toBe(0);
  });

  it('falls back to the student email as name/greeting when firstName and lastName are both unset', async () => {
    await pool.query('UPDATE users SET "firstName" = NULL, "lastName" = NULL WHERE id = $1', [child.studentUser]);
    await seedEvidence(child.student, SKILL_A, 'CORRECT', daysAgo(1));

    const result = await generateAndPersistAriaPeriodicBilan({
      studentId: child.student,
      courseKey: REAL_COURSE_KEY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });

    const persisted = await prisma.bilan.findUnique({ where: { id: result.bilanId } });
    expect(persisted!.studentName).toBe(persisted!.studentEmail);
    expect(persisted!.studentMarkdown).toContain('l’élève');

    // Restore for the other tests in this suite.
    await pool.query('UPDATE users SET "firstName" = $1 WHERE id = $2', ['Mehdi', child.studentUser]);
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

  it('surfaces a real error (from the repository\'s own read-time validation) rather than silently misreading evidence corrupted by something other than it', async () => {
    await seedCorruptedEvidence(pool, child.student, daysAgo(1));

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
});

describe('LearningEvidenceRepository.listForStudent since/until windowing (P7b)', () => {
  let pool: Pool;
  let child: AriaRealDbFixtureIds;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    child = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
  });

  afterAll(async () => {
    await cleanupEvidenceAndBilans(pool, child.student);
    await cleanupAriaRealDbFixture(pool, child);
    await pool.end();
  });

  afterEach(async () => {
    await cleanupEvidenceAndBilans(pool, child.student);
  });

  it('with only `since`, includes evidence at/after it and excludes evidence before it', async () => {
    await seedEvidence(child.student, SKILL_A, 'CORRECT', new Date('2026-08-01T00:00:00.000Z'));
    await seedEvidence(child.student, SKILL_A, 'CORRECT', new Date('2026-09-01T00:00:00.000Z'));

    const rows = await prismaLearningEvidenceRepository.listForStudent(child.student, {
      courseKey: REAL_COURSE_KEY,
      since: new Date('2026-08-15T00:00:00.000Z'),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.observedAt.toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('with only `until`, includes evidence at/before it and excludes evidence after it', async () => {
    await seedEvidence(child.student, SKILL_A, 'CORRECT', new Date('2026-08-01T00:00:00.000Z'));
    await seedEvidence(child.student, SKILL_A, 'CORRECT', new Date('2026-09-01T00:00:00.000Z'));

    const rows = await prismaLearningEvidenceRepository.listForStudent(child.student, {
      courseKey: REAL_COURSE_KEY,
      until: new Date('2026-08-15T00:00:00.000Z'),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.observedAt.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });
});

describe('listAriaPeriodicBilansForParent (P7b-2 discoverability)', () => {
  let pool: Pool;
  let family: AriaRealDbFixtureIds;
  let otherFamily: AriaRealDbFixtureIds;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    family = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    otherFamily = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    // Periodic bilans are a SUIVI+ parent-reporting capability — the base
    // fixture's default ARIA_AUTONOMIE entitlement would otherwise deny
    // every positive-path test below.
    await pool.query(`UPDATE entitlements SET "ariaTier" = 'ARIA_SUIVI' WHERE id = $1`, [family.entitlement]);
  });

  afterAll(async () => {
    await cleanupAriaRealDbFixture(pool, family);
    await cleanupAriaRealDbFixture(pool, otherFamily);
    await pool.end();
  });

  afterEach(async () => {
    await prisma.bilan.deleteMany({ where: { studentId: { in: [family.student, otherFamily.student] } } });
  });

  async function createBilan(studentId: string, overrides: Partial<{
    isPublished: boolean;
    type: 'ARIA_PERIODIC' | 'STAGE_POST';
    parentsMarkdown: string | null;
    publishedAt: Date | null;
  }> = {}) {
    const bilan = await prisma.bilan.create({
      data: {
        type: overrides.type ?? 'ARIA_PERIODIC',
        subject: 'MATHEMATIQUES',
        studentId,
        studentEmail: `${randomUUID()}@invalid.test`,
        studentName: 'Test Student',
        status: 'COMPLETED',
        isPublished: overrides.isPublished ?? true,
        publishedAt: overrides.publishedAt !== undefined ? overrides.publishedAt : new Date(),
        parentsMarkdown: overrides.parentsMarkdown !== undefined ? overrides.parentsMarkdown : 'Vue parent réelle',
        studentMarkdown: 'Vue élève réelle',
        globalScore: 75,
      },
      select: { id: true },
    });
    return bilan.id;
  }

  it('returns a real, published ARIA_PERIODIC bilan for the real parent of the child', async () => {
    const bilanId = await createBilan(family.student);

    const result = await listAriaPeriodicBilansForParent({
      actor: { userId: family.parentUser, role: 'PARENT' },
      studentId: family.student,
    });

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(bilanId);
  });

  it('excludes an unpublished ARIA_PERIODIC bilan', async () => {
    await createBilan(family.student, { isPublished: false, publishedAt: null });

    const result = await listAriaPeriodicBilansForParent({
      actor: { userId: family.parentUser, role: 'PARENT' },
      studentId: family.student,
    });

    expect(result).toHaveLength(0);
  });

  it('excludes a published bilan of a different, non-ARIA_PERIODIC type', async () => {
    await createBilan(family.student, { type: 'STAGE_POST' });

    const result = await listAriaPeriodicBilansForParent({
      actor: { userId: family.parentUser, role: 'PARENT' },
      studentId: family.student,
    });

    expect(result).toHaveLength(0);
  });

  it('rejects a different family\'s parent — never leaks another family\'s bilan', async () => {
    await createBilan(family.student);

    await expect(
      listAriaPeriodicBilansForParent({
        actor: { userId: otherFamily.parentUser, role: 'PARENT' },
        studentId: family.student,
      }),
    ).rejects.toThrow(AriaError);
  });

  it('returns a real empty list for a real, entitled child whose tier does not include parent reporting (AUTONOMIE)', async () => {
    // otherFamily is deliberately never upgraded past the base
    // ARIA_AUTONOMIE entitlement seedAriaRealDbFixture creates.
    await createBilan(otherFamily.student);

    const result = await listAriaPeriodicBilansForParent({
      actor: { userId: otherFamily.parentUser, role: 'PARENT' },
      studentId: otherFamily.student,
    });

    expect(result).toEqual([]);
  });
});
