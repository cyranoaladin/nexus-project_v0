/** @jest-environment node */

import { Pool } from 'pg';
import { authorAriaActivity } from '@/lib/aria/application/practice/author';
import { startAriaPracticeAttempt } from '@/lib/aria/application/practice/start-attempt';
import { submitAriaPracticeAttempt } from '@/lib/aria/application/practice/submit-attempt';
import { makeCorrectAriaPracticeAttempt, type CorrectModelDependency } from '@/lib/aria/application/practice/correct-attempt';
import { authorizePracticeCorrectionForActor } from '@/lib/aria/application/practice/authorize';
import { listLearningEvidenceForStudent } from '@/lib/aria/application/evidence/list';
import { prismaActivityRepository } from '@/lib/aria/infrastructure/prisma/activity-repository';
import { AriaError } from '@/lib/aria/kernel/errors';
import type { ChatMessage } from '@/lib/aria/gateway';
import type { ActivityRepository } from '@/lib/aria/application/practice/ports';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const REAL_COURSE_KEY = 'eds-maths-premiere';

/**
 * `prismaActivityRepository` is a class instance — its methods live on the
 * prototype, so a plain object spread (`{...prismaActivityRepository}`)
 * silently drops every one of them except own-enumerable fields. Bind each
 * real method explicitly, then let `overrides` replace exactly the ones
 * a test cares about.
 */
function wrapRepository(overrides: Partial<ActivityRepository>): ActivityRepository {
  const real = prismaActivityRepository;
  return {
    resolveStudentIdByUserId: real.resolveStudentIdByUserId.bind(real),
    createActivityWithVersion: real.createActivityWithVersion.bind(real),
    listActivitiesForCourse: real.listActivitiesForCourse.bind(real),
    getActivityById: real.getActivityById.bind(real),
    getVersionById: real.getVersionById.bind(real),
    startOrResumeAttempt: real.startOrResumeAttempt.bind(real),
    getAttemptById: real.getAttemptById.bind(real),
    submitAttempt: real.submitAttempt.bind(real),
    getResponseByAttemptId: real.getResponseByAttemptId.bind(real),
    beginCorrection: real.beginCorrection.bind(real),
    commitCorrectionResult: real.commitCorrectionResult.bind(real),
    ...overrides,
  };
}

const MCQ_PROMPT = Object.freeze({
  questionText: 'Quelle est la dérivée de x² ?',
  options: [
    { id: 'a', label: '2x' },
    { id: 'b', label: 'x' },
  ],
});
const MCQ_EXPECTED_ANSWER_SHAPE = Object.freeze({ field: 'selectedOptionId', type: 'string' });
const MCQ_CORRECTION_RUBRIC = Object.freeze({ correctOptionId: 'a' });

const WELL_FORMED_FEEDBACK = Object.freeze({
  outcome: 'CORRECT',
  summary: 'Bonne réponse, raisonnement correct.',
  strengths: ['Dérivée correcte'],
  improvements: [],
});

interface FakeModel {
  readonly stream: CorrectModelDependency;
  readonly calls: ChatMessage[][];
}

/** Injectable-seam fake, matching this codebase's established house style
 * (`lib/aria/n4b/import-resource-registry.ts`'s injectable mapper,
 * `lib/aria/cockpit/skill-views.ts`'s injectable lookup) for an otherwise
 * expensive-to-really-call dependency. */
function fakeModel(responses: readonly unknown[]): FakeModel {
  const calls: ChatMessage[][] = [];
  let callIndex = 0;
  const stream: CorrectModelDependency = (messages) => {
    calls.push([...messages]);
    const response = responses[Math.min(callIndex, responses.length - 1)];
    callIndex += 1;
    return (async function* () {
      yield typeof response === 'string' ? response : JSON.stringify(response);
    })();
  };
  return { stream, calls };
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

describe('ARIA Practice correction (P2b) on PostgreSQL', () => {
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
    await cleanupPractice(pool, [REAL_COURSE_KEY]);
    await cleanupAriaRealDbFixture(pool, studentA);
    await cleanupAriaRealDbFixture(pool, studentB);
    await pool.end();
  });

  async function seedSubmittedAttempt(student: AriaRealDbFixtureIds, selectedOptionId = 'a') {
    const activity = await authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      activityType: 'MCQ',
      versionLabel: `v-${Date.now()}-${Math.random()}`,
      prompt: MCQ_PROMPT,
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
      payload: { selectedOptionId },
    });
    return { activity, attemptId: attempt.id };
  }

  it('corrects a real submitted attempt: real ActivityResult, CORRECTED status, real LearningEvidence row', async () => {
    const { attemptId } = await seedSubmittedAttempt(studentA);
    const model = fakeModel([WELL_FORMED_FEEDBACK]);
    const correctAttempt = makeCorrectAriaPracticeAttempt({
      repository: prismaActivityRepository,
      streamModel: model.stream,
    });

    const { result, alreadyCorrected } = await correctAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId,
    });
    expect(alreadyCorrected).toBe(false);
    expect(result.outcome).toBe('CORRECT');
    expect(result.feedback).toEqual(WELL_FORMED_FEEDBACK);
    expect(model.calls).toHaveLength(1);

    const attemptRow = await pool.query('SELECT status FROM aria_activity_attempts WHERE id = $1', [attemptId]);
    expect(attemptRow.rows[0].status).toBe('CORRECTED');

    const evidence = await listLearningEvidenceForStudent({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      filters: { source: 'PRACTICE_ATTEMPT' },
    });
    const matching = evidence.find((row) => row.sourceRefId === attemptId);
    expect(matching).toBeDefined();
    expect(matching!.outcome).toEqual({ outcome: 'CORRECT', activityAttemptId: attemptId });
    expect(matching!.courseKey).toBe(REAL_COURSE_KEY);
  });

  it('idempotency: correcting an already-corrected attempt returns the same result and never re-calls the model', async () => {
    const { attemptId } = await seedSubmittedAttempt(studentA);
    const model = fakeModel([WELL_FORMED_FEEDBACK]);
    const correctAttempt = makeCorrectAriaPracticeAttempt({
      repository: prismaActivityRepository,
      streamModel: model.stream,
    });

    const first = await correctAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId,
    });
    expect(first.alreadyCorrected).toBe(false);
    expect(model.calls).toHaveLength(1);

    const second = await correctAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId,
    });
    expect(second.alreadyCorrected).toBe(true);
    expect(second.result.id).toBe(first.result.id);
    // The model was never called a second time — the whole point of the
    // idempotency guard.
    expect(model.calls).toHaveLength(1);

    const resultRows = await pool.query('SELECT id FROM aria_activity_results WHERE "attemptId" = $1', [attemptId]);
    expect(resultRows.rows).toHaveLength(1);
  });

  it('rejects correcting an attempt that is still IN_PROGRESS (not yet submitted)', async () => {
    const activity = await authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      activityType: 'MCQ',
      versionLabel: `v-${Date.now()}-${Math.random()}`,
      prompt: MCQ_PROMPT,
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: MCQ_CORRECTION_RUBRIC,
    });
    const attempt = await startAriaPracticeAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      activityId: activity.id,
    });
    const model = fakeModel([WELL_FORMED_FEEDBACK]);
    const correctAttempt = makeCorrectAriaPracticeAttempt({
      repository: prismaActivityRepository,
      streamModel: model.stream,
    });

    await expect(correctAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId: attempt.id,
    })).rejects.toThrow(AriaError);
    expect(model.calls).toHaveLength(0);
  });

  it('IDOR: a different student cannot trigger correction of this student’s attempt', async () => {
    const { attemptId } = await seedSubmittedAttempt(studentA);
    const model = fakeModel([WELL_FORMED_FEEDBACK]);
    const correctAttempt = makeCorrectAriaPracticeAttempt({
      repository: prismaActivityRepository,
      streamModel: model.stream,
    });

    await expect(correctAttempt({
      actor: { userId: studentB.studentUser, role: 'ELEVE' },
      attemptId,
    })).rejects.toThrow(AriaError);
    expect(model.calls).toHaveLength(0);

    const resultRows = await pool.query('SELECT id FROM aria_activity_results WHERE "attemptId" = $1', [attemptId]);
    expect(resultRows.rows).toHaveLength(0);
  });

  it('retries once on malformed model output, then succeeds with the retry’s well-formed response', async () => {
    const { attemptId } = await seedSubmittedAttempt(studentA, 'b');
    const model = fakeModel(['this is not json at all', WELL_FORMED_FEEDBACK]);
    const correctAttempt = makeCorrectAriaPracticeAttempt({
      repository: prismaActivityRepository,
      streamModel: model.stream,
    });

    const { result } = await correctAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId,
    });
    expect(result.feedback).toEqual(WELL_FORMED_FEEDBACK);
    expect(model.calls).toHaveLength(2);
  });

  it('fails closed (real typed error) when both the initial and the retried model response are malformed', async () => {
    const { attemptId } = await seedSubmittedAttempt(studentA);
    const model = fakeModel(['not json', 'still not json']);
    const correctAttempt = makeCorrectAriaPracticeAttempt({
      repository: prismaActivityRepository,
      streamModel: model.stream,
    });

    await expect(correctAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId,
    })).rejects.toThrow(AriaError);
    expect(model.calls).toHaveLength(2);

    const attemptRow = await pool.query('SELECT status FROM aria_activity_attempts WHERE id = $1', [attemptId]);
    expect(attemptRow.rows[0].status).toBe('SUBMITTED');
  });

  it('corrects against the exact version the attempt was created against, not a later republished version', async () => {
    const activity = await authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      activityType: 'MCQ',
      versionLabel: `v-original-${Date.now()}`,
      prompt: MCQ_PROMPT,
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: { correctOptionId: 'a' },
    });
    const attempt = await startAriaPracticeAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      activityId: activity.id,
    });
    await submitAriaPracticeAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId: attempt.id,
      payload: { selectedOptionId: 'a' },
    });

    // Republish a new ACTIVE version with a DIFFERENT correct answer, on
    // the same activity, after the attempt was submitted.
    await pool.query('UPDATE aria_activity_versions SET status = $1 WHERE "activityId" = $2', ['RETIRED', activity.id]);
    await pool.query(
      `INSERT INTO aria_activity_versions
       (id, "activityId", "versionLabel", prompt, "expectedAnswerShape", "correctionRubric", status, "publishedAt", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW(), NOW())`,
      [
        `v2-${Date.now()}`,
        activity.id,
        `v2-${Date.now()}`,
        JSON.stringify(MCQ_PROMPT),
        JSON.stringify(MCQ_EXPECTED_ANSWER_SHAPE),
        JSON.stringify({ correctOptionId: 'b' }),
      ],
    );

    const model = fakeModel([WELL_FORMED_FEEDBACK]);
    const correctAttempt = makeCorrectAriaPracticeAttempt({
      repository: prismaActivityRepository,
      streamModel: model.stream,
    });
    await correctAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId: attempt.id,
    });

    // The prompt sent to the model must carry the ORIGINAL rubric
    // (correctOptionId: 'a'), never the newly-published one (correctOptionId: 'b').
    const sentMessages = model.calls[0]!;
    const systemMessage = sentMessages.find((m) => m.role === 'system')!;
    expect(systemMessage.content).toContain('"correctOptionId":"a"');
    expect(systemMessage.content).not.toContain('"correctOptionId":"b"');
  });

  // The four cases below guard genuinely-unreachable-via-real-data defensive
  // branches: aria_activity_attempts.activityId cascades on Activity delete,
  // .activityVersionId RESTRICTs on ActivityVersion delete, and a SUBMITTED
  // attempt always has a response written atomically by submitAttempt — none
  // of these can actually go missing through the real Prisma repository.
  // Exercised directly via the injectable `repository` seam (this module's
  // own established pattern for its `streamModel` dependency), wrapping the
  // real repository and overriding exactly one method per case, so every
  // OTHER step (authorization, attempt/version/response lookup) still runs
  // for real against real seeded data.
  it('fails closed when the acting user has no Student row', async () => {
    const { attemptId } = await seedSubmittedAttempt(studentA);
    const correctAttempt = makeCorrectAriaPracticeAttempt({
      repository: wrapRepository({ resolveStudentIdByUserId: async () => null }),
      streamModel: fakeModel([WELL_FORMED_FEEDBACK]).stream,
    });
    await expect(correctAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId,
    })).rejects.toThrow(AriaError);
  });

  it('fails closed when the attempt’s Activity cannot be found (real repository still resolves the attempt)', async () => {
    const { attemptId } = await seedSubmittedAttempt(studentA);
    const correctAttempt = makeCorrectAriaPracticeAttempt({
      repository: wrapRepository({ getActivityById: async () => null }),
      streamModel: fakeModel([WELL_FORMED_FEEDBACK]).stream,
    });
    await expect(correctAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId,
    })).rejects.toThrow(AriaError);
  });

  it('fails closed when the attempt’s exact ActivityVersion cannot be found', async () => {
    const { attemptId } = await seedSubmittedAttempt(studentA);
    const correctAttempt = makeCorrectAriaPracticeAttempt({
      repository: wrapRepository({ getVersionById: async () => null }),
      streamModel: fakeModel([WELL_FORMED_FEEDBACK]).stream,
    });
    await expect(correctAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId,
    })).rejects.toThrow(AriaError);
  });

  it('fails closed when the attempt’s ActivityResponse cannot be found', async () => {
    const { attemptId } = await seedSubmittedAttempt(studentA);
    const correctAttempt = makeCorrectAriaPracticeAttempt({
      repository: wrapRepository({ getResponseByAttemptId: async () => null }),
      streamModel: fakeModel([WELL_FORMED_FEEDBACK]).stream,
    });
    await expect(correctAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId,
    })).rejects.toThrow(AriaError);
  });

  it('authorizePracticeCorrectionForActor rejects an unknown courseKey directly (real async-wrapper COURSE_NOT_FOUND)', async () => {
    await expect(authorizePracticeCorrectionForActor({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      courseKey: 'not-a-real-course-key',
    })).rejects.toThrow(AriaError);
  });
});
