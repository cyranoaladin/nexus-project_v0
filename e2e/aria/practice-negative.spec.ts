/**
 * ARIA_UNENTITLED_NEGATIVE_E2E / ARIA_IDOR_NEGATIVE_E2E (P6d) — the two
 * real negative golden paths the Autonomie qualification's Definition of
 * Done requires alongside the positive one (practice.spec.ts): a real,
 * authenticated session that legitimately reaches ARIA but has no
 * commercial entitlement for the course must never see Practice/Mastery/
 * Next-Best-Action for it (UNENTITLED), and a real, authenticated
 * different student must never be able to act on another student's real
 * attempt (IDOR) — through the actual HTTP routes, not just the real-DB
 * suite's direct application-function calls
 * (aria-practice.real.test.ts / aria-practice-correction.real.test.ts
 * already cover the same ownership check at that lower layer).
 */
import { expect, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { authorRealAriaPracticeActivity, cleanupAriaPracticeGoldenPath } from '../helpers/db';
import { resetFixture } from './helpers';

// Sami (`ariaNotEntitled`): real academic enrollment in this course, zero
// real entitlement for it — academically relevant, never commercially
// entitled. The exact shape the tier gate must refuse.
const UNENTITLED_COURSE_KEY = 'eds-nsi-premiere';

// A real course with a real activity, owned by ariaPremiereMaths for the
// IDOR attempt-ownership check — the course itself is incidental here.
const IDOR_COURSE_KEY = 'eds-maths-premiere';

const MCQ_PROMPT = Object.freeze({
  questionText: 'Quelle est la raison de la suite arithmétique (u_n) définie par u_n = 3n + 1 ?',
  options: [
    { id: 'a', label: '3' },
    { id: 'b', label: '1' },
  ],
});
const MCQ_EXPECTED_ANSWER_SHAPE = Object.freeze({ field: 'selectedOptionId', type: 'string' });
const MCQ_CORRECTION_RUBRIC = Object.freeze({ correctOptionId: 'a' });

test.describe.serial('ARIA-P6d real negative golden paths', () => {
  test.beforeEach(async ({ request }) => {
    await cleanupAriaPracticeGoldenPath(UNENTITLED_COURSE_KEY);
    await cleanupAriaPracticeGoldenPath(IDOR_COURSE_KEY);
    await resetFixture(request);
  });

  test.afterAll(async () => {
    await cleanupAriaPracticeGoldenPath(UNENTITLED_COURSE_KEY);
    await cleanupAriaPracticeGoldenPath(IDOR_COURSE_KEY);
  });

  test('E2E_ARIA_UNENTITLED_NEGATIVE — a real, academically-enrolled but unentitled student is refused Practice/Mastery/NBA', async ({ page }) => {
    await loginAsUser(page, 'ariaNotEntitled');

    const activitiesResponse = await page.request.get(
      `/api/aria/practice/activities?courseKey=${UNENTITLED_COURSE_KEY}`,
    );
    expect(activitiesResponse.status()).toBe(403);

    const masteryResponse = await page.request.get(
      `/api/aria/mastery/course?courseKey=${UNENTITLED_COURSE_KEY}`,
    );
    expect(masteryResponse.status()).toBe(403);

    const nbaResponse = await page.request.get(
      `/api/aria/next-best-action?courseKey=${UNENTITLED_COURSE_KEY}`,
    );
    expect(nbaResponse.status()).toBe(403);
  });

  test('E2E_ARIA_IDOR_NEGATIVE — a real, different, authenticated student cannot act on another student\'s real attempt', async ({ browser }) => {
    const activity = await authorRealAriaPracticeActivity({
      courseKey: IDOR_COURSE_KEY,
      skillId: 'ALG_SUITE_ARITH',
      curriculumVersion: '2026-v1',
      prompt: MCQ_PROMPT,
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: MCQ_CORRECTION_RUBRIC,
    });

    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await loginAsUser(ownerPage, 'ariaPremiereMaths');
    const startResponse = await ownerPage.request.post('/api/aria/practice/attempts', {
      data: { activityId: activity.activityId },
    });
    expect(startResponse.status()).toBe(200);
    const { attempt } = (await startResponse.json()) as { attempt: { id: string } };
    await ownerContext.close();

    // A real, different, authenticated ARIA student — not the owner, not
    // an admin/parent bypassing the ELEVE role gate (that's a separate
    // authz dimension already covered elsewhere), a genuine peer.
    const attackerContext = await browser.newContext();
    const attackerPage = await attackerContext.newPage();
    await loginAsUser(attackerPage, 'ariaNsi');

    // Same "attempt not found" shape as a genuinely nonexistent attempt —
    // ownership must never be revealed to a non-owner (submit-attempt.ts).
    const submitResponse = await attackerPage.request.post(`/api/aria/practice/attempts/${attempt.id}/submit`, {
      data: { payload: { selectedOptionId: 'a' } },
    });
    expect(submitResponse.status()).toBe(404);

    const correctResponse = await attackerPage.request.post(`/api/aria/practice/attempts/${attempt.id}/correct`);
    expect(correctResponse.status()).toBe(404);
    await attackerContext.close();
  });
});
