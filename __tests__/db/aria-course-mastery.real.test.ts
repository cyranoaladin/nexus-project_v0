/** @jest-environment node */

import { Pool } from 'pg';
import { authorAriaActivity } from '@/lib/aria/application/practice/author';
import { startAriaPracticeAttempt } from '@/lib/aria/application/practice/start-attempt';
import { submitAriaPracticeAttempt } from '@/lib/aria/application/practice/submit-attempt';
import { makeCorrectAriaPracticeAttempt, type CorrectModelDependency } from '@/lib/aria/application/practice/correct-attempt';
import { prismaActivityRepository } from '@/lib/aria/infrastructure/prisma/activity-repository';
import { listAriaCourseMasteryForActor } from '@/lib/aria/application/mastery/list-course-mastery';
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

describe('ARIA Course Mastery list (P5) on PostgreSQL', () => {
  let pool: Pool;
  let student: AriaRealDbFixtureIds;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    student = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
  });

  afterAll(async () => {
    await cleanupPractice(pool, [REAL_COURSE_KEY]);
    await cleanupAriaRealDbFixture(pool, student);
    await pool.end();
  });

  it('lists every real skill from the compiled skill graph, with activityId: null for skills with no authored content', async () => {
    const skills = await listAriaCourseMasteryForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
    });
    expect(skills.length).toBeGreaterThan(0);
    const skillA = skills.find((entry) => entry.skillId === SKILL_A);
    expect(skillA).toEqual({
      skillId: SKILL_A,
      skillLabel: expect.any(String),
      level: 'NOT_STARTED',
      activityId: null,
    });
  });

  it('reflects a real authored activity and a real correction, matching what NBA itself would compute', async () => {
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
      actor: { userId: student.studentUser, role: 'ELEVE' },
      activityId: activity.id,
    });
    await submitAriaPracticeAttempt({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      attemptId: attempt.id,
      payload: { selectedOptionId: 'a' },
    });
    const correctAttempt = makeCorrectAriaPracticeAttempt({
      repository: prismaActivityRepository,
      streamModel: fakeModel(correctFeedback('CORRECT')),
    });
    await correctAttempt({ actor: { userId: student.studentUser, role: 'ELEVE' }, attemptId: attempt.id });

    const skills = await listAriaCourseMasteryForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
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

  it('rejects a course the student is not academically enrolled in', async () => {
    await expect(listAriaCourseMasteryForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: 'eds-nsi-premiere',
    })).rejects.toThrow(AriaError);
  });

  it('rejects an unknown courseKey', async () => {
    await expect(listAriaCourseMasteryForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: 'not-a-real-course-key',
    })).rejects.toThrow(AriaError);
  });
});
