/** @jest-environment node */

import { Pool } from 'pg';
import { authorAriaActivity } from '@/lib/aria/application/practice/author';
import { startAriaPracticeAttempt } from '@/lib/aria/application/practice/start-attempt';
import { submitAriaPracticeAttempt } from '@/lib/aria/application/practice/submit-attempt';
import { makeCorrectAriaPracticeAttempt, type CorrectModelDependency } from '@/lib/aria/application/practice/correct-attempt';
import { prismaActivityRepository } from '@/lib/aria/infrastructure/prisma/activity-repository';
import { getAriaNextBestActionForActor } from '@/lib/aria/application/mastery/get-next-best-action';
import { AriaError } from '@/lib/aria/kernel/errors';
import type { ChatMessage } from '@/lib/aria/gateway';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const REAL_COURSE_KEY = 'eds-maths-premiere';
// Two real, distinct skills from the compiled maths-premiere skill graph.
const SKILL_A = 'ALG_SUITE_ARITH';
const SKILL_B = 'ALG_SUITE_GEO';

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

describe('ARIA Next Best Action (P4a) on PostgreSQL', () => {
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

  async function authorActivityForSkill(skillId: string) {
    return authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId,
      curriculumVersion: '2026-v1',
      activityType: 'MCQ',
      versionLabel: `v-${Date.now()}-${Math.random()}`,
      prompt: {
        questionText: 'Quelle est la raison de la suite (u_n) définie par u_n = 3n + 1 ?',
        options: [{ id: 'a', label: '3' }, { id: 'b', label: '1' }],
      },
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: MCQ_CORRECTION_RUBRIC,
    });
  }

  async function submitAndCorrect(activityId: string, outcome: 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT') {
    const attempt = await startAriaPracticeAttempt({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      activityId,
    });
    await submitAriaPracticeAttempt({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      attemptId: attempt.id,
      payload: { selectedOptionId: 'a' },
    });
    const correctAttempt = makeCorrectAriaPracticeAttempt({
      repository: prismaActivityRepository,
      streamModel: fakeModel(correctFeedback(outcome)),
    });
    await correctAttempt({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      attemptId: attempt.id,
    });
  }

  it('returns null when the course has no authored practice content at all (must run before any activity is authored below)', async () => {
    const action = await getAriaNextBestActionForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
    });
    expect(action).toBeNull();
  });

  it('a real skill-less activity (author.ts allows skillId: null) is never a candidate — its own real evidence row (skillId: null) is skipped too, and NBA still returns null on its own', async () => {
    const skillLess = await authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      activityType: 'MCQ',
      versionLabel: `v-skill-less-${Date.now()}`,
      prompt: {
        questionText: 'Question générale sans compétence associée.',
        options: [{ id: 'a', label: 'Oui' }, { id: 'b', label: 'Non' }],
      },
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: MCQ_CORRECTION_RUBRIC,
    });
    // A real, corrected attempt produces a real LearningEvidence row with
    // skillId: null (recordLearningEvidence carries the activity's own
    // skillId through unchanged) — exercises the evidence-grouping skip,
    // not just the activity-listing skip above.
    await submitAndCorrect(skillLess.id, 'CORRECT');

    const action = await getAriaNextBestActionForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
    });
    expect(action).toBeNull();
  });

  it('recommends a real, freshly-authored skill (NOT_STARTED) once at least one activity exists for it', async () => {
    const activity = await authorActivityForSkill(SKILL_A);
    const action = await getAriaNextBestActionForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
    });
    expect(action).toEqual({
      courseKey: REAL_COURSE_KEY,
      skillId: SKILL_A,
      skillLabel: expect.any(String),
      level: 'NOT_STARTED',
      activityId: activity.id,
    });
  });

  it('prioritizes a real DEVELOPING skill (one real INCORRECT correction) over a NOT_STARTED one', async () => {
    const activityB = await authorActivityForSkill(SKILL_B);
    // SKILL_A already has a NOT_STARTED activity from the previous test —
    // give it a real INCORRECT correction so it becomes DEVELOPING and
    // should now be preferred over SKILL_B's still-NOT_STARTED activity.
    const activities = await prismaActivityRepository.listActivitiesForCourse(REAL_COURSE_KEY);
    const activityA = activities.find((entry) => entry.skillId === SKILL_A)!;
    await submitAndCorrect(activityA.id, 'INCORRECT');

    const action = await getAriaNextBestActionForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
    });
    expect(action?.skillId).toBe(SKILL_A);
    expect(action?.level).toBe('DEVELOPING');
    expect(action?.activityId).toBe(activityA.id);
    void activityB;
  });

  it('returns null once every skill with authored content is real MASTERED', async () => {
    const activities = await prismaActivityRepository.listActivitiesForCourse(REAL_COURSE_KEY);
    const activityA = activities.find((entry) => entry.skillId === SKILL_A)!;
    const activityB = activities.find((entry) => entry.skillId === SKILL_B)!;
    // Drive SKILL_A to MASTERED (3 consecutive real CORRECT corrections —
    // a fresh attempt each time, mirroring the P3 DB test's own pattern).
    for (let i = 0; i < 3; i += 1) {
      const attempt = await startAriaPracticeAttempt({
        actor: { userId: student.studentUser, role: 'ELEVE' },
        activityId: activityA.id,
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
    }
    // And SKILL_B too, so nothing else is left to recommend.
    for (let i = 0; i < 3; i += 1) {
      const attempt = await startAriaPracticeAttempt({
        actor: { userId: student.studentUser, role: 'ELEVE' },
        activityId: activityB.id,
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
    }

    const action = await getAriaNextBestActionForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
    });
    expect(action).toBeNull();
  });

  it('rejects a course the student is not academically enrolled in', async () => {
    await expect(getAriaNextBestActionForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: 'eds-nsi-premiere',
    })).rejects.toThrow(AriaError);
  });

  it('rejects an unknown courseKey', async () => {
    await expect(getAriaNextBestActionForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: 'not-a-real-course-key',
    })).rejects.toThrow(AriaError);
  });
});
