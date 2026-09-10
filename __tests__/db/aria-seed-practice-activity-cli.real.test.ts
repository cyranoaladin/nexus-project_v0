/** @jest-environment node */

import { Pool } from 'pg';
import { seedPracticeActivityFixture } from '@/scripts/aria/seed-practice-activity-fixture';
import {
  cleanupAriaRealDbFixture,
  seedAriaRealDbFixture,
  type AriaRealDbFixtureIds,
} from '@/__tests__/helpers/aria-real-db';

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const REAL_COURSE_KEY = 'eds-maths-premiere';
const REAL_SKILL_ID = 'ALG_SUITE_ARITH';

describe('seed-practice-activity-fixture CLI, against real Postgres', () => {
  let pool: Pool;
  let student: AriaRealDbFixtureIds;

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('ARIA_TEST_DATABASE_URL_REQUIRED');
    pool = new Pool({ connectionString: databaseUrl });
    student = await seedAriaRealDbFixture(pool, REAL_COURSE_KEY);
  });

  afterAll(async () => {
    await pool.query(
      'DELETE FROM aria_activities WHERE "courseKey" = $1 AND "skillId" = $2',
      [REAL_COURSE_KEY, REAL_SKILL_ID],
    );
    await cleanupAriaRealDbFixture(pool, student);
    await pool.end();
  });

  it('writes a real Activity + ActivityVersion through the real authoring path', async () => {
    let loggedId: string | null = null;
    const spy = jest.spyOn(console, 'log').mockImplementation((message: string) => {
      const match = /^ARIA_ACTIVITY_SEED_WRITTEN_ID=(.+)$/.exec(message);
      if (match) loggedId = match[1]!;
    });
    try {
      await seedPracticeActivityFixture({
        courseKey: REAL_COURSE_KEY,
        skillId: REAL_SKILL_ID,
        curriculumVersion: '2026-v1',
        activityType: 'MCQ',
        versionLabel: 'cli-test-v1',
        prompt: { questionText: 'Combien font 2+2 ?', options: [{ id: 'a', label: '3' }, { id: 'b', label: '4' }] },
        expectedAnswerShape: { field: 'selectedOptionId', type: 'string' },
        correctionRubric: { correctOptionId: 'b' },
      });
    } finally {
      spy.mockRestore();
    }
    expect(loggedId).not.toBeNull();

    const row = await pool.query('SELECT "courseKey", "skillId" FROM aria_activities WHERE id = $1', [loggedId]);
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].courseKey).toBe(REAL_COURSE_KEY);
    expect(row.rows[0].skillId).toBe(REAL_SKILL_ID);
  });

  it('rejects an unknown courseKey (no row written)', async () => {
    await expect(
      seedPracticeActivityFixture({
        courseKey: 'not-a-real-course-key',
        skillId: null,
        curriculumVersion: '2026-v1',
        activityType: 'MCQ',
        versionLabel: 'cli-test-invalid',
        prompt: { questionText: 'Q', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
        expectedAnswerShape: { field: 'selectedOptionId', type: 'string' },
        correctionRubric: { correctOptionId: 'a' },
      }),
    ).rejects.toThrow();
  });
});
