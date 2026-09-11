/** @jest-environment node */

import { Pool } from 'pg';
import { authorAriaActivity } from '@/lib/aria/application/practice/author';
import { startAriaPracticeAttempt } from '@/lib/aria/application/practice/start-attempt';
import { submitAriaPracticeAttempt } from '@/lib/aria/application/practice/submit-attempt';
import { makeCorrectAriaPracticeAttempt, type CorrectModelDependency } from '@/lib/aria/application/practice/correct-attempt';
import { prismaActivityRepository } from '@/lib/aria/infrastructure/prisma/activity-repository';
import { getAriaSkillMasteryForActor } from '@/lib/aria/application/mastery/get-mastery';
import { AriaError } from '@/lib/aria/kernel/errors';
import type { ChatMessage } from '@/lib/aria/gateway';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const REAL_COURSE_KEY = 'eds-maths-premiere';
// A real skillId from the compiled maths-premiere skill graph
// (lib/diagnostics/definitions/generated/maths-premiere-p2.domains.json) —
// not a fixture-only fictional value, mirroring `author.ts`'s own
// courseKey/skillId cross-validation.
const REAL_SKILL_ID = 'ALG_SUITE_ARITH';

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

/** Injectable-seam fake, same house style as
 * `__tests__/db/aria-practice-correction.real.test.ts`'s own `fakeModel`. */
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

describe('ARIA Mastery (P3) on PostgreSQL', () => {
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

  async function submitAndCorrect(outcome: 'CORRECT' | 'PARTIALLY_CORRECT' | 'INCORRECT') {
    const activity = await authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: REAL_SKILL_ID,
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
      streamModel: fakeModel(correctFeedback(outcome)),
    });
    await correctAttempt({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      attemptId: attempt.id,
    });
  }

  it('returns NOT_STARTED for a skill with no practice evidence at all', async () => {
    const mastery = await getAriaSkillMasteryForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
      skillId: 'ALG_SUITE_GEO', // a real, distinct skill this student never attempted
    });
    expect(mastery).toEqual({
      courseKey: REAL_COURSE_KEY,
      skillId: 'ALG_SUITE_GEO',
      level: 'NOT_STARTED',
      attemptsConsidered: 0,
    });
  });

  it('climbs DEVELOPING -> PROFICIENT -> MASTERED as real corrected attempts accumulate, driven entirely by real LearningEvidence rows', async () => {
    await submitAndCorrect('CORRECT');
    let mastery = await getAriaSkillMasteryForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
      skillId: REAL_SKILL_ID,
    });
    expect(mastery.level).toBe('DEVELOPING');
    expect(mastery.attemptsConsidered).toBe(1);

    await submitAndCorrect('CORRECT');
    mastery = await getAriaSkillMasteryForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
      skillId: REAL_SKILL_ID,
    });
    expect(mastery.level).toBe('PROFICIENT');
    expect(mastery.attemptsConsidered).toBe(2);

    await submitAndCorrect('CORRECT');
    mastery = await getAriaSkillMasteryForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
      skillId: REAL_SKILL_ID,
    });
    expect(mastery.level).toBe('MASTERED');
    expect(mastery.attemptsConsidered).toBe(3);
  });

  it('a real INCORRECT correction resets the streak back to DEVELOPING', async () => {
    await submitAndCorrect('INCORRECT');
    const mastery = await getAriaSkillMasteryForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
      skillId: REAL_SKILL_ID,
    });
    expect(mastery.level).toBe('DEVELOPING');
  });

  it('rejects an unknown courseKey', async () => {
    await expect(getAriaSkillMasteryForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: 'not-a-real-course-key',
      skillId: REAL_SKILL_ID,
    })).rejects.toThrow(AriaError);
  });

  it('rejects a skillId that does not belong to the given course (real SKILL_MISMATCH)', async () => {
    await expect(getAriaSkillMasteryForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
      skillId: 'not-a-real-skill-id',
    })).rejects.toThrow(AriaError);
  });

  it('rejects a course the student is not academically enrolled in', async () => {
    await expect(getAriaSkillMasteryForActor({
      actor: { userId: student.studentUser, role: 'ELEVE' },
      courseKey: 'eds-nsi-premiere',
      skillId: REAL_SKILL_ID,
    })).rejects.toThrow(AriaError);
  });
});
