/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { authorAriaActivity } from '@/lib/aria/application/practice/author';
import { listAriaPracticeActivitiesForActor } from '@/lib/aria/application/practice/list-activities';
import { startAriaPracticeAttempt } from '@/lib/aria/application/practice/start-attempt';
import { submitAriaPracticeAttempt } from '@/lib/aria/application/practice/submit-attempt';
import { prismaActivityRepository } from '@/lib/aria/infrastructure/prisma/activity-repository';
import { AriaError } from '@/lib/aria/kernel/errors';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const REAL_COURSE_KEY = 'eds-maths-premiere';
const OTHER_REAL_COURSE_KEY = 'eds-nsi-premiere';

const MCQ_PROMPT = Object.freeze({
  questionText: 'Quelle est la dérivée de x² ?',
  options: [
    { id: 'a', label: '2x' },
    { id: 'b', label: 'x' },
  ],
});
const MCQ_EXPECTED_ANSWER_SHAPE = Object.freeze({ field: 'selectedOptionId', type: 'string' });
const MCQ_CORRECTION_RUBRIC = Object.freeze({ correctOptionId: 'a' });

async function cleanupPractice(pool: Pool, courseKeys: readonly string[]): Promise<void> {
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

describe('ARIA Practice (P2a) on PostgreSQL', () => {
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
    await cleanupPractice(pool, [REAL_COURSE_KEY, OTHER_REAL_COURSE_KEY]);
    await cleanupAriaRealDbFixture(pool, studentA);
    await cleanupAriaRealDbFixture(pool, studentB);
    await pool.end();
  });

  it('authors a real MCQ activity, then lists it for an entitled, academically-relevant student', async () => {
    const activity = await authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      activityType: 'MCQ',
      versionLabel: 'v1',
      prompt: MCQ_PROMPT,
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: MCQ_CORRECTION_RUBRIC,
    });
    expect(activity.activeVersion).not.toBeNull();

    const activities = await listAriaPracticeActivitiesForActor({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      courseKey: REAL_COURSE_KEY,
    });
    expect(activities.some((a) => a.activityId === activity.id)).toBe(true);
    const listed = activities.find((a) => a.activityId === activity.id)!;
    expect(listed.prompt).toEqual(MCQ_PROMPT);
    expect(listed.expectedAnswerShape).toEqual(MCQ_EXPECTED_ANSWER_SHAPE);
    // correctionRubric must never leak to a client-facing read.
    expect(listed as unknown as Record<string, unknown>).not.toHaveProperty('correctionRubric');
  });

  it('rejects listing a course the student is not academically enrolled in', async () => {
    await expect(listAriaPracticeActivitiesForActor({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      courseKey: OTHER_REAL_COURSE_KEY,
    })).rejects.toThrow(AriaError);
  });

  it('rejects listing an entirely unknown courseKey (COURSE_NOT_FOUND, before touching the student lookup)', async () => {
    await expect(listAriaPracticeActivitiesForActor({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      courseKey: 'not-a-real-course-key',
    })).rejects.toThrow(AriaError);
  });

  it('starting the same activity twice returns the same IN_PROGRESS attempt (idempotent, real DB proof)', async () => {
    const activity = await authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      activityType: 'SHORT_ANSWER',
      versionLabel: 'v1',
      prompt: { questionText: 'Formule de la dérivée de x^n ?' },
      expectedAnswerShape: { field: 'answerText', type: 'string' },
      correctionRubric: { acceptableAnswers: ['n*x^(n-1)'], caseSensitive: false },
    });

    const first = await startAriaPracticeAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      activityId: activity.id,
    });
    const second = await startAriaPracticeAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      activityId: activity.id,
    });
    expect(second.id).toBe(first.id);

    const rows = await pool.query(
      'SELECT id FROM aria_activity_attempts WHERE "studentId" = $1 AND "activityVersionId" = $2',
      [studentA.student, activity.activeVersion!.id],
    );
    expect(rows.rows).toHaveLength(1);
  });

  it('submits a real payload, marks the attempt SUBMITTED, and rejects a second submit', async () => {
    const activity = await authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      activityType: 'MCQ',
      versionLabel: 'v1',
      prompt: MCQ_PROMPT,
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: MCQ_CORRECTION_RUBRIC,
    });
    const attempt = await startAriaPracticeAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      activityId: activity.id,
    });

    const { attempt: submitted, response } = await submitAriaPracticeAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId: attempt.id,
      payload: { selectedOptionId: 'a' },
    });
    expect(submitted.status).toBe('SUBMITTED');
    expect(response.payload).toEqual({ selectedOptionId: 'a' });

    await expect(submitAriaPracticeAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId: attempt.id,
      payload: { selectedOptionId: 'b' },
    })).rejects.toThrow(AriaError);
  });

  it('rejects a malformed payload against the activity’s real response schema', async () => {
    const activity = await authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      activityType: 'MCQ',
      versionLabel: 'v1',
      prompt: MCQ_PROMPT,
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: MCQ_CORRECTION_RUBRIC,
    });
    const attempt = await startAriaPracticeAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      activityId: activity.id,
    });
    await expect(submitAriaPracticeAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId: attempt.id,
      payload: { wrongField: 'a' },
    })).rejects.toThrow(AriaError);
  });

  it('IDOR: a different student cannot submit into this student’s attempt', async () => {
    const activity = await authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      activityType: 'MCQ',
      versionLabel: 'v1',
      prompt: MCQ_PROMPT,
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: MCQ_CORRECTION_RUBRIC,
    });
    const attempt = await startAriaPracticeAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      activityId: activity.id,
    });
    await expect(submitAriaPracticeAttempt({
      actor: { userId: studentB.studentUser, role: 'ELEVE' },
      attemptId: attempt.id,
      payload: { selectedOptionId: 'a' },
    })).rejects.toThrow(AriaError);

    const row = await pool.query('SELECT status FROM aria_activity_attempts WHERE id = $1', [attempt.id]);
    expect(row.rows[0].status).toBe('IN_PROGRESS');
  });

  it('rejects starting an attempt on an unknown activity', async () => {
    await expect(startAriaPracticeAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      activityId: 'not-a-real-activity-id',
    })).rejects.toThrow(AriaError);
  });

  it('rejects submitting into a non-existent attempt', async () => {
    await expect(submitAriaPracticeAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      attemptId: 'not-a-real-attempt-id',
      payload: { selectedOptionId: 'a' },
    })).rejects.toThrow(AriaError);
  });

  it('rejects authoring an activity for an unknown course (no row written)', async () => {
    await expect(authorAriaActivity({
      courseKey: 'not-a-real-course-key',
      skillId: null,
      curriculumVersion: '2026-v1',
      activityType: 'MCQ',
      versionLabel: 'v1',
      prompt: MCQ_PROMPT,
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: MCQ_CORRECTION_RUBRIC,
    })).rejects.toThrow(AriaError);
  });

  it('rejects authoring an activity with a skillId that does not match the course', async () => {
    await expect(authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: 'not-a-real-skill-id',
      curriculumVersion: '2026-v1',
      activityType: 'MCQ',
      versionLabel: 'v1',
      prompt: MCQ_PROMPT,
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: MCQ_CORRECTION_RUBRIC,
    })).rejects.toThrow(AriaError);
  });

  it('rejects submission from a user with no matching Student row (orphan user)', async () => {
    const orphanUserId = randomUUID();
    await pool.query(
      `INSERT INTO users (id, email, role, "updatedAt") VALUES ($1, $2, 'ELEVE', NOW())`,
      [orphanUserId, `orphan-${orphanUserId}@example.test`],
    );
    try {
      await expect(submitAriaPracticeAttempt({
        actor: { userId: orphanUserId, role: 'ELEVE' },
        attemptId: 'irrelevant-attempt-id',
        payload: { selectedOptionId: 'a' },
      })).rejects.toThrow(AriaError);
    } finally {
      await pool.query('DELETE FROM users WHERE id = $1', [orphanUserId]);
    }
  });

  it('repository.submitAttempt rejects a non-existent attemptId directly (port-level, bypassing the application layer)', async () => {
    await expect(
      prismaActivityRepository.submitAttempt({
        attemptId: 'not-a-real-attempt-id-at-all',
        payload: { selectedOptionId: 'a' },
      }),
    ).rejects.toThrow(AriaError);
  });

  it('repository.getActivityById returns activeVersion: null once the only version is retired', async () => {
    const activity = await authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      activityType: 'MCQ',
      versionLabel: `v-retired-${Date.now()}`,
      prompt: MCQ_PROMPT,
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: MCQ_CORRECTION_RUBRIC,
    });
    await pool.query(`UPDATE aria_activity_versions SET status = 'RETIRED' WHERE id = $1`, [
      activity.activeVersion!.id,
    ]);

    const reloaded = await prismaActivityRepository.getActivityById(activity.id);
    expect(reloaded).not.toBeNull();
    expect(reloaded!.activeVersion).toBeNull();
  });

  it('repository.getVersionById returns null for an unknown activityVersionId', async () => {
    await expect(
      prismaActivityRepository.getVersionById('not-a-real-activity-version-id'),
    ).resolves.toBeNull();
  });

  it('repository.getResponseByAttemptId returns null before an attempt has been submitted', async () => {
    const activity = await authorAriaActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: '2026-v1',
      activityType: 'MCQ',
      versionLabel: `v-no-response-${Date.now()}`,
      prompt: MCQ_PROMPT,
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: MCQ_CORRECTION_RUBRIC,
    });
    const attempt = await startAriaPracticeAttempt({
      actor: { userId: studentA.studentUser, role: 'ELEVE' },
      activityId: activity.id,
    });

    await expect(
      prismaActivityRepository.getResponseByAttemptId(attempt.id),
    ).resolves.toBeNull();
  });
});
