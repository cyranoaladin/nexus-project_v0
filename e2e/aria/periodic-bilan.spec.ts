/**
 * ARIA_BILAN_GENERATION_E2E (P7b-1) — the real staff-triggered golden path:
 * a real student practices with ARIA (same real Activity/Attempt/
 * Correction/LearningEvidence pipeline as `practice.spec.ts`), then real
 * staff (ASSISTANTE) calls the real `/api/aria/bilans/periodic` route and a
 * real, unpublished `Bilan` row is persisted from that evidence.
 *
 * Deliberately stops there: publication/visibility to the student or
 * parent is P7b-2's own golden path, reusing the existing, already-tested
 * `PUT /api/bilans/[id]`.
 */
import { expect, test } from '@playwright/test';
import { loginAsUser, resetBrowserSession } from '../helpers/auth';
import {
  authorRealAriaPracticeActivity,
  cleanupAriaPeriodicBilans,
  cleanupAriaPracticeGoldenPath,
  completeAriaOnboardingByEmail,
  getStudentId,
} from '../helpers/db';
import { CREDS } from '../helpers/credentials';
import { resetFixture } from './helpers';

const REAL_COURSE_KEY = 'eds-maths-premiere';
const REAL_SKILL_ID = 'ALG_SUITE_ARITH';

const MCQ_PROMPT = Object.freeze({
  questionText: 'Quelle est la raison de la suite arithmétique (u_n) définie par u_n = 3n + 1 ?',
  options: [
    { id: 'a', label: '3' },
    { id: 'b', label: '1' },
    { id: 'c', label: 'n' },
  ],
});
const MCQ_EXPECTED_ANSWER_SHAPE = Object.freeze({ field: 'selectedOptionId', type: 'string' });
const MCQ_CORRECTION_RUBRIC = Object.freeze({ correctOptionId: 'a' });

test.describe.serial('ARIA-P7b real periodic bilan generation golden path', () => {
  test.beforeEach(async ({ request }) => {
    await cleanupAriaPeriodicBilans(CREDS.ariaPremiereMaths.email);
    await cleanupAriaPracticeGoldenPath(REAL_COURSE_KEY);
    await resetFixture(request);
  });

  test.afterAll(async () => {
    await cleanupAriaPeriodicBilans(CREDS.ariaPremiereMaths.email);
    await cleanupAriaPracticeGoldenPath(REAL_COURSE_KEY);
  });

  test('E2E_ARIA_BILAN_GENERATION — staff generates a real periodic bilan from a real practice attempt', async ({ page }) => {
    const activity = await authorRealAriaPracticeActivity({
      courseKey: REAL_COURSE_KEY,
      skillId: REAL_SKILL_ID,
      curriculumVersion: '2026-v1',
      prompt: MCQ_PROMPT,
      expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
      correctionRubric: MCQ_CORRECTION_RUBRIC,
    });

    // Real student produces real LearningEvidence via the same practice
    // pipeline as practice.spec.ts (P6c) — no shortcut, no direct SQL
    // insertion of evidence.
    await completeAriaOnboardingByEmail(CREDS.ariaPremiereMaths.email);
    await loginAsUser(page, 'ariaPremiereMaths');
    await page.goto(`/dashboard/eleve/aria/practice/${activity.activityId}?courseKey=${REAL_COURSE_KEY}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByText(MCQ_PROMPT.questionText)).toBeVisible();
    await page.getByLabel('3', { exact: true }).click();
    await page.getByTestId('aria-practice-submit').click();
    await expect(page.getByTestId('aria-practice-result')).toBeVisible();
    await expect(page.getByText('Correct', { exact: true })).toBeVisible();

    const studentId = await getStudentId(CREDS.ariaPremiereMaths.email);

    // A different, real, authenticated browser context: staff calling the
    // real API — never the student's own session.
    await resetBrowserSession(page);
    await loginAsUser(page, 'assistante');

    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 14 * 24 * 60 * 60 * 1000);
    const response = await page.request.post('/api/aria/bilans/periodic', {
      data: {
        studentId,
        courseKey: REAL_COURSE_KEY,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.totalAttemptsInPeriod).toBe(1);
    expect(typeof body.bilanId).toBe('string');

    // Real, unpublished persistence — the confidentiality/review invariant
    // this whole lot exists to guarantee (P7b-2 owns publication).
    const bilanResponse = await page.request.get(`/api/bilans/${body.bilanId}`);
    expect(bilanResponse.status()).toBe(200);
    const bilan = (await bilanResponse.json()).data;
    expect(bilan.type).toBe('ARIA_PERIODIC');
    expect(bilan.isPublished).toBe(false);
    expect(bilan.status).toBe('COMPLETED');
  });

  test('E2E_ARIA_BILAN_GENERATION_NO_ACTIVITY — refuses to generate when the student has no ARIA activity in the period', async ({ page }) => {
    const studentId = await getStudentId(CREDS.ariaPremiereMaths.email);
    await loginAsUser(page, 'assistante');

    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 14 * 24 * 60 * 60 * 1000);
    const response = await page.request.post('/api/aria/bilans/periodic', {
      data: {
        studentId,
        courseKey: REAL_COURSE_KEY,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
    });
    expect(response.status()).toBe(400);
  });

  test('E2E_ARIA_BILAN_GENERATION_STUDENT_DENIED — a real ELEVE session cannot call the staff-only generation route', async ({ page }) => {
    const studentId = await getStudentId(CREDS.ariaPremiereMaths.email);
    await loginAsUser(page, 'ariaPremiereMaths');

    const periodEnd = new Date();
    const periodStart = new Date(periodEnd.getTime() - 14 * 24 * 60 * 60 * 1000);
    const response = await page.request.post('/api/aria/bilans/periodic', {
      data: {
        studentId,
        courseKey: REAL_COURSE_KEY,
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
      },
    });
    expect(response.status()).toBe(403);
  });
});
