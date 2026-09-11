/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { authorAriaActivity } from '@/lib/aria/application/practice/author';
import { startAriaPracticeAttempt } from '@/lib/aria/application/practice/start-attempt';
import { submitAriaPracticeAttempt } from '@/lib/aria/application/practice/submit-attempt';
import { makeCorrectAriaPracticeAttempt, type CorrectModelDependency } from '@/lib/aria/application/practice/correct-attempt';
import { prismaActivityRepository } from '@/lib/aria/infrastructure/prisma/activity-repository';
import { getAriaNextBestActionForActor } from '@/lib/aria/application/mastery/get-next-best-action';
import { getAriaNextBestActionForParent } from '@/lib/aria/application/mastery/get-next-best-action-for-parent';
import { listAriaRecentActivityForParent } from '@/lib/aria/application/evidence/list-recent-activity-for-parent';
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

describe('ARIA Parent Reporting v2 (P7a: Next Best Action + recent activity) on PostgreSQL', () => {
  let pool: Pool;
  let child: AriaRealDbFixtureIds;
  let otherFamily: AriaRealDbFixtureIds;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    child = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
    otherFamily = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
  });

  afterAll(async () => {
    await cleanupPractice(pool, [REAL_COURSE_KEY]);
    await cleanupAriaRealDbFixture(pool, child);
    await cleanupAriaRealDbFixture(pool, otherFamily);
    await pool.end();
  });

  describe('getAriaNextBestActionForParent', () => {
    it('returns null, same as the child\'s own view, when the course has no authored practice content at all (must run before any activity is authored below)', async () => {
      const action = await getAriaNextBestActionForParent({
        actor: { userId: child.parentUser, role: 'PARENT' },
        studentId: child.student,
        courseKey: REAL_COURSE_KEY,
      });
      expect(action).toBeNull();
    });

    it('rejects a real course the child is not academically enrolled in at all (must run before the enrollment insert below)', async () => {
      await expect(getAriaNextBestActionForParent({
        actor: { userId: child.parentUser, role: 'PARENT' },
        studentId: child.student,
        courseKey: 'eds-nsi-premiere',
      })).rejects.toThrow(AriaError);
    });

    it('recommends the exact same real skill, level and activity the child itself would see (parity, never a second opinion)', async () => {
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

      const childAction = await getAriaNextBestActionForActor({
        actor: { userId: child.studentUser, role: 'ELEVE' },
        courseKey: REAL_COURSE_KEY,
      });
      const parentAction = await getAriaNextBestActionForParent({
        actor: { userId: child.parentUser, role: 'PARENT' },
        studentId: child.student,
        courseKey: REAL_COURSE_KEY,
      });

      expect(parentAction).toEqual(childAction);
      expect(parentAction).toEqual({
        courseKey: REAL_COURSE_KEY,
        skillId: SKILL_A,
        skillLabel: expect.any(String),
        level: 'NOT_STARTED',
        activityId: activity.id,
      });
    });

    it('rejects a parent trying to view a child from a different family', async () => {
      await expect(getAriaNextBestActionForParent({
        actor: { userId: otherFamily.parentUser, role: 'PARENT' },
        studentId: child.student,
        courseKey: REAL_COURSE_KEY,
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
      await expect(getAriaNextBestActionForParent({
        actor: { userId: child.parentUser, role: 'PARENT' },
        studentId: child.student,
        courseKey: enrolledButNotEntitled,
      })).rejects.toThrow(AriaError);
    });
  });

  describe('listAriaRecentActivityForParent', () => {
    it('lists the real, recent practice outcomes for this course, most recent first, with real skill labels', async () => {
      const activity = await authorAriaActivity({
        courseKey: REAL_COURSE_KEY,
        skillId: SKILL_A,
        curriculumVersion: '2026-v1',
        activityType: 'MCQ',
        versionLabel: `v-recent-${Date.now()}`,
        prompt: {
          questionText: 'Quelle est la raison de la suite (u_n) définie par u_n = 3n + 1 ?',
          options: [{ id: 'a', label: '3' }, { id: 'b', label: '1' }],
        },
        expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
        correctionRubric: MCQ_CORRECTION_RUBRIC,
      });

      for (const outcome of ['INCORRECT', 'CORRECT'] as const) {
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
          streamModel: fakeModel(correctFeedback(outcome)),
        });
        await correctAttempt({ actor: { userId: child.studentUser, role: 'ELEVE' }, attemptId: attempt.id });
      }

      const activityFeed = await listAriaRecentActivityForParent({
        actor: { userId: child.parentUser, role: 'PARENT' },
        studentId: child.student,
        courseKey: REAL_COURSE_KEY,
      });

      expect(activityFeed).toHaveLength(2);
      // Most recent first: the second (CORRECT) correction comes before
      // the first (INCORRECT) one.
      expect(activityFeed[0]).toEqual({
        skillId: SKILL_A,
        skillLabel: expect.any(String),
        outcome: 'CORRECT',
        observedAt: expect.any(Date),
      });
      expect(activityFeed[1]).toEqual({
        skillId: SKILL_A,
        skillLabel: expect.any(String),
        outcome: 'INCORRECT',
        observedAt: expect.any(Date),
      });
    });

    it('rejects a parent trying to view a child from a different family', async () => {
      await expect(listAriaRecentActivityForParent({
        actor: { userId: otherFamily.parentUser, role: 'PARENT' },
        studentId: child.student,
        courseKey: REAL_COURSE_KEY,
      })).rejects.toThrow(AriaError);
    });

    it('rejects an unknown courseKey', async () => {
      await expect(listAriaRecentActivityForParent({
        actor: { userId: child.parentUser, role: 'PARENT' },
        studentId: child.student,
        courseKey: 'not-a-real-course-key',
      })).rejects.toThrow(AriaError);
    });

    it('skips a real skill-less activity\'s own evidence (skillId: null) — never shown to the parent as an unlabeled entry', async () => {
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
      const attempt = await startAriaPracticeAttempt({
        actor: { userId: child.studentUser, role: 'ELEVE' },
        activityId: skillLess.id,
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

      const activityFeed = await listAriaRecentActivityForParent({
        actor: { userId: child.parentUser, role: 'PARENT' },
        studentId: child.student,
        courseKey: REAL_COURSE_KEY,
      });
      // The real skill-less evidence row this test just wrote is excluded
      // — every item in the real feed still carries a real, non-null
      // skillId (the previous test's own SKILL_A rows may still be
      // present here; this test only asserts nothing null slipped in).
      expect(activityFeed.every((item) => item.skillId !== null)).toBe(true);
    });

    it('returns an empty feed for a real, fully-entitled course that has no compiled skill graph at all', async () => {
      // A real, EDS_GENERALE-compatible course this codebase's own
      // skill-graph registry (lib/aria/curriculum/skill-graph.ts) never
      // compiled — access is real (enrolled + entitled), there is simply
      // nothing to project.
      const noSkillGraphCourse = 'eds-physique-chimie-premiere';
      await pool.query(
        `INSERT INTO student_academic_enrollments
         (id, "studentId", "courseKey", kind, source, "curriculumVersion", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, 'SPECIALTY', 'ADMIN', '2026-v1', NOW(), NOW())`,
        [randomUUID(), child.student, noSkillGraphCourse],
      );
      await pool.query(
        `INSERT INTO aria_entitlement_scopes
         (id, "entitlementId", kind, "courseKey", "createdAt", "updatedAt")
         VALUES ($1, $2, 'COURSE', $3, NOW(), NOW())`,
        [randomUUID(), child.entitlement, noSkillGraphCourse],
      );
      const activityFeed = await listAriaRecentActivityForParent({
        actor: { userId: child.parentUser, role: 'PARENT' },
        studentId: child.student,
        courseKey: noSkillGraphCourse,
      });
      expect(activityFeed).toEqual([]);
    });
  });
});
