/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { authorAriaActivity } from '@/lib/aria/application/practice/author';
import { startAriaPracticeAttempt } from '@/lib/aria/application/practice/start-attempt';
import { submitAriaPracticeAttempt } from '@/lib/aria/application/practice/submit-attempt';
import { makeCorrectAriaPracticeAttempt, type CorrectModelDependency } from '@/lib/aria/application/practice/correct-attempt';
import { prismaActivityRepository } from '@/lib/aria/infrastructure/prisma/activity-repository';
import { listAriaCourseMasteryForParent } from '@/lib/aria/application/mastery/list-course-mastery-for-parent';
import { AriaError } from '@/lib/aria/kernel/errors';
import type { ChatMessage } from '@/lib/aria/gateway';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const REAL_COURSE_KEY = 'eds-maths-premiere';
const SKILL_A = 'ALG_SUITE_ARITH';

const MCQ_EXPECTED_ANSWER_SHAPE = Object.freeze({ field: 'selectedOptionId', type: 'string' });
const MCQ_CORRECTION_RUBRIC = Object.freeze({ correctOptionId: 'a' });

function correctFeedback(outcome: 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT') {
  return Object.freeze({
    outcome,
    summary: `Résultat: ${outcome}`,
    strengths: outcome === 'CORRECT' ? ['Raisonnement correct'] : [],
    improvements: outcome === 'CORRECT' ? [] : ['À revoir'],
  });
}

function fakeModel(response: unknown): CorrectModelDependency {
  return (messages: readonly ChatMessage[]) => {
    void messages;
    return (async function* () {
      yield JSON.stringify(response);
    })();
  };
}

async function cleanupPractice(pool: Pool, courseKeys: readonly string[]): Promise<void> {
  await pool.query(
    `DELETE FROM aria_learning_evidence WHERE "sourceRefId" IN (
       SELECT id FROM aria_activity_attempts WHERE "courseKey" = ANY($1::text[])
     )`,
    [courseKeys],
  );
  await pool.query(
    `DELETE FROM aria_activity_results WHERE "attemptId" IN (
       SELECT id FROM aria_activity_attempts WHERE "courseKey" = ANY($1::text[])
     )`,
    [courseKeys],
  );
  await pool.query(
    `DELETE FROM aria_activity_responses WHERE "attemptId" IN (
       SELECT id FROM aria_activity_attempts WHERE "courseKey" = ANY($1::text[])
     )`,
    [courseKeys],
  );
  await pool.query('DELETE FROM aria_activity_attempts WHERE "courseKey" = ANY($1::text[])', [courseKeys]);
  await pool.query(
    `DELETE FROM aria_activity_versions WHERE "activityId" IN (
       SELECT id FROM aria_activities WHERE "courseKey" = ANY($1::text[])
     )`,
    [courseKeys],
  );
  await pool.query('DELETE FROM aria_activities WHERE "courseKey" = ANY($1::text[])', [courseKeys]);
}

async function upgradeToSuiviTier(pool: Pool, entitlementId: string): Promise<void> {
  await pool.query(`UPDATE entitlements SET "ariaTier" = 'ARIA_SUIVI' WHERE id = $1`, [entitlementId]);
}

describe('ARIA Parent Course Mastery (P6a) on PostgreSQL', () => {
  let pool: Pool;
  let child: AriaRealDbFixtureIds;
  let otherFamily: AriaRealDbFixtureIds;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    child = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    otherFamily = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    // Parent Mastery is a SUIVI+ capability — the base fixture's default
    // ARIA_AUTONOMIE entitlement would otherwise deny every positive-path
    // test below.
    await upgradeToSuiviTier(pool, child.entitlement);
  });

  afterAll(async () => {
    await cleanupPractice(pool, [REAL_COURSE_KEY]);
    await cleanupAriaRealDbFixture(pool, child);
    await cleanupAriaRealDbFixture(pool, otherFamily);
    await pool.end();
  });

  it('lets the real linked parent see their real child’s mastery, matching what the student itself would see', async () => {
    const activity = await authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: SKILL_A,
      curriculumVersion: '2026-v1',
      activityType: 'MCQ',
      versionLabel: `v-${Date.now()}`,
      prompt: {
        questionText: 'Quelle est la raison de la suite (u_n) définie par u_n = 3n + 1 ?',
        options: [{ id: 'a', label: '3' }, { id: 'b', label: '1' }],
      },
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: MCQ_CORRECTION_RUBRIC,
    });
    const attempt = await startAriaPracticeAttempt({
      actor: { userId: child.studentUser, role: 'ELEVE' },
      activityId: activity.id,
    });
    await submitAriaPracticeAttempt({
      actor: { userId: child.studentUser, role: 'ELEVE' },
      attemptId: attempt.id,
      payload: { selectedOptionId: 'a' },
    });
    const correctAttempt = makeCorrectAriaPracticeAttempt({
      repository: prismaActivityRepository,
      streamModel: fakeModel(correctFeedback('CORRECT')),
    });
    await correctAttempt({ actor: { userId: child.studentUser, role: 'ELEVE' }, attemptId: attempt.id });

    const skills = await listAriaCourseMasteryForParent({
      actor: { userId: child.parentUser, role: 'PARENT' },
      studentId: child.student,
      courseKey: REAL_COURSE_KEY,
    });
    const skillA = skills.find((entry) => entry.skillId === SKILL_A);
    expect(skillA).toEqual({
      skillId: SKILL_A,
      skillLabel: expect.any(String),
      level: 'DEVELOPING',
      activityId: activity.id,
    });
  });

  it('rejects a parent trying to view a child from a different family (real cross-family isolation)', async () => {
    await expect(listAriaCourseMasteryForParent({
      actor: { userId: otherFamily.parentUser, role: 'PARENT' },
      studentId: child.student,
      courseKey: REAL_COURSE_KEY,
    })).rejects.toThrow(AriaError);
  });

  it('rejects a non-existent studentId with the same error as a real cross-family attempt (no existence leak)', async () => {
    await expect(listAriaCourseMasteryForParent({
      actor: { userId: child.parentUser, role: 'PARENT' },
      studentId: 'not-a-real-student-id',
      courseKey: REAL_COURSE_KEY,
    })).rejects.toThrow(AriaError);
  });

  it('rejects an ELEVE session even with a real parent-shaped studentId/courseKey pair', async () => {
    await expect(listAriaCourseMasteryForParent({
      actor: { userId: child.parentUser, role: 'ELEVE' },
      studentId: child.student,
      courseKey: REAL_COURSE_KEY,
    })).rejects.toThrow(AriaError);
  });

  it('rejects an unknown courseKey', async () => {
    await expect(listAriaCourseMasteryForParent({
      actor: { userId: child.parentUser, role: 'PARENT' },
      studentId: child.student,
      courseKey: 'not-a-real-course-key',
    })).rejects.toThrow(AriaError);
  });

  it('rejects a real course the child is not academically enrolled in', async () => {
    await expect(listAriaCourseMasteryForParent({
      actor: { userId: child.parentUser, role: 'PARENT' },
      studentId: child.student,
      courseKey: 'eds-nsi-premiere',
    })).rejects.toThrow(AriaError);
  });

  it('rejects a real course the child is academically enrolled in but has no ARIA entitlement scope for', async () => {
    const enrolledButNotEntitled = 'eds-nsi-premiere';
    await pool.query(
      `INSERT INTO student_academic_enrollments
       (id, "studentId", "courseKey", kind, source, "curriculumVersion", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW())`,
      [randomUUID(), child.student, enrolledButNotEntitled],
    );
    await expect(listAriaCourseMasteryForParent({
      actor: { userId: child.parentUser, role: 'PARENT' },
      studentId: child.student,
      courseKey: enrolledButNotEntitled,
    })).rejects.toThrow(AriaError);
  });

  it('returns a real empty list for a real, entitled child whose tier does not include parent reporting (AUTONOMIE)', async () => {
    // A fresh fixture, deliberately never upgraded past the base
    // ARIA_AUTONOMIE entitlement seedAriaRealDbFixture creates.
    const autonomieFamily = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    try {
      const result = await listAriaCourseMasteryForParent({
        actor: { userId: autonomieFamily.parentUser, role: 'PARENT' },
        studentId: autonomieFamily.student,
        courseKey: REAL_COURSE_KEY,
      });
      expect(result).toEqual([]);
    } finally {
      await cleanupAriaRealDbFixture(pool, autonomieFamily);
    }
  });
});
