/**
 * ARIA_BILAN_GENERATION_E2E (P7b-1) + ARIA_BILAN_REVIEW_E2E (P7b-2) — the
 * real staff-triggered golden path end to end: a real student practices
 * with ARIA (same real Activity/Attempt/Correction/LearningEvidence
 * pipeline as `practice.spec.ts`), real staff (ASSISTANTE) generates a
 * real, unpublished `Bilan` via `/api/aria/bilans/periodic`, then records a
 * real, persisted APPROVED review and publishes it — through the existing,
 * already-tested `PUT /api/bilans/[id]`, extended with a human-review gate
 * (P7b-2), no new publication endpoint, per the mission's "reuse only if
 * the business identity genuinely matches" rule (P7b's audit fork).
 *
 * Discoverability is proven through real product navigation, never a
 * staff-known id used to construct a `page.goto`: the real student clicks
 * the real, rendered link in the ARIA cockpit's own "Bilans de cette
 * matière" panel, and the real parent clicks the real, rendered link in
 * their own child-detail dashboard's new "Bilans ARIA périodiques" card.
 */
import { expect, test } from '@playwright/test';
import { loginAsUser, resetBrowserSession } from '../helpers/auth';
import {
  authorRealAriaPracticeActivity,
  cleanupAriaPeriodicBilans,
  cleanupAriaPracticeGoldenPath,
  completeAriaOnboardingByEmail,
  getPendingEmailOutboxCountForUser,
  getStudentId,
  getUserAndStudentIdsByEmail,
  upgradeAriaPersonaToSuiviTier,
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

async function studentCompletesOnePracticeAttempt(page: import('@playwright/test').Page) {
  // Parent reporting (Mastery, Next Best Action, recent activity, and now
  // periodic bilans) is a SUIVI+ capability — without this the parent's
  // own discovery steps below would correctly render nothing at all, per
  // the same real tier gate list-workshops-for-parent.ts already enforces
  // for workshops.
  await upgradeAriaPersonaToSuiviTier(CREDS.ariaPremiereMaths.email);
  const activity = await authorRealAriaPracticeActivity({
    courseKey: REAL_COURSE_KEY,
    skillId: REAL_SKILL_ID,
    curriculumVersion: '2026-v1',
    prompt: MCQ_PROMPT,
    expectedAnswerShape: MCQ_EXPECTED_ANSWER_SHAPE,
    correctionRubric: MCQ_CORRECTION_RUBRIC,
  });
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
}

async function staffGeneratesBilan(page: import('@playwright/test').Page, studentId: string): Promise<string> {
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
  return body.bilanId as string;
}

test.describe.serial('ARIA-P7b real periodic bilan generation + review + publication + discovery golden path', () => {
  test.beforeEach(async ({ request }) => {
    await cleanupAriaPeriodicBilans(CREDS.ariaPremiereMaths.email);
    await cleanupAriaPracticeGoldenPath(REAL_COURSE_KEY);
    await resetFixture(request);
  });

  test.afterAll(async () => {
    await cleanupAriaPeriodicBilans(CREDS.ariaPremiereMaths.email);
    await cleanupAriaPracticeGoldenPath(REAL_COURSE_KEY);
  });

  test('E2E_ARIA_BILAN_GOLDEN — generation, real persisted review, publication, real student and parent discovery', async ({ page }) => {
    await studentCompletesOnePracticeAttempt(page);
    const studentId = await getStudentId(CREDS.ariaPremiereMaths.email);
    const bilanId = await staffGeneratesBilan(page, studentId);

    // Real, unpublished persistence — the confidentiality/review invariant
    // this whole lot exists to guarantee.
    const unpublished = (await (await page.request.get(`/api/bilans/${bilanId}`)).json()).data;
    expect(unpublished.type).toBe('ARIA_PERIODIC');
    expect(unpublished.isPublished).toBe(false);
    expect(unpublished.reviewDecision).toBeNull(); // no review recorded yet — staff can see this field (its own internal read)

    // Staff records a real, persisted review decision — a discrete step,
    // independent of publication: isPublished stays false here.
    const reviewResponse = await page.request.put(`/api/bilans/${bilanId}`, {
      data: { reviewDecision: 'APPROVED' },
    });
    expect(reviewResponse.status()).toBe(200);
    const reviewed = (await reviewResponse.json()).data;
    expect(reviewed.reviewDecision).toBe('APPROVED');
    expect(reviewed.reviewedById).toBeTruthy();
    expect(reviewed.reviewedAt).toBeTruthy();
    expect(reviewed.isPublished).toBe(false);

    // Only now does publication succeed — because a real APPROVED review
    // is already persisted.
    const publishResponse = await page.request.put(`/api/bilans/${bilanId}`, {
      data: { isPublished: true },
    });
    expect(publishResponse.status()).toBe(200);
    const published = (await publishResponse.json()).data;
    expect(published.isPublished).toBe(true);
    expect(published.publishedAt).not.toBeNull();

    // Real parent notification (P7c): exactly one real email intent queued
    // on the real outbox for the real parent, fired by the publish above.
    const { userId: parentUserId } = await getUserAndStudentIdsByEmail(CREDS.ariaPersonasParent.email);
    expect(await getPendingEmailOutboxCountForUser(parentUserId)).toBe(1);

    // Real student, real session, real navigation: no page.goto built from
    // a staff-known id. The student opens their own cockpit, finds the
    // real "Bilans de cette matière" panel, and clicks the real rendered
    // link.
    await resetBrowserSession(page);
    await loginAsUser(page, 'ariaPremiereMaths');
    await page.goto('/dashboard/eleve/aria', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('aria-nav-CURRICULUM').click();
    await page.getByTestId('aria-course-card-maths-premiere-eds').getByRole('button', { name: 'Ouvrir' }).click();
    const bilanLink = page.getByTestId('aria-course-bilans-section').getByTestId('aria-course-bilan-item');
    await expect(bilanLink).toBeVisible();
    await bilanLink.click();
    await expect(page).toHaveURL(/\/dashboard\/eleve\/bilans\//);
    await expect(page.getByText('Bilan ARIA')).toBeVisible();
    await expect(page.getByText('Salut Mehdi', { exact: false })).toBeVisible();

    // Real parent, real session, real navigation: opens their own child's
    // dashboard (their own normal route, not a staff-known bilan id),
    // finds the real "Bilans ARIA périodiques" card, and clicks the real
    // rendered link.
    await resetBrowserSession(page);
    await loginAsUser(page, 'ariaPersonasParent');
    await page.goto(`/dashboard/parent/enfant/${studentId}`, { waitUntil: 'domcontentloaded' });
    const parentBilanLink = page.getByTestId('aria-bilans-card').getByTestId('aria-bilan-card-item');
    await expect(parentBilanLink).toBeVisible();
    await parentBilanLink.click();
    await expect(page).toHaveURL(/\/dashboard\/parent\/bilans\//);
    await expect(page.getByTestId('aria-parent-bilan-detail')).toBeVisible();
    // Real generated parentsMarkdown content (renderParentsMarkdown, P7b-1) — never the student's private chat.
    await expect(page.getByText('votre enfant a réalisé', { exact: false })).toBeVisible();
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

  test('E2E_ARIA_BILAN_PUBLISH_DENIED_NO_REVIEW — publication is refused with no recorded review, and the bilan stays unpublished', async ({ page }) => {
    await studentCompletesOnePracticeAttempt(page);
    const studentId = await getStudentId(CREDS.ariaPremiereMaths.email);
    const bilanId = await staffGeneratesBilan(page, studentId);

    const response = await page.request.put(`/api/bilans/${bilanId}`, { data: { isPublished: true } });
    expect(response.status()).toBe(403);

    const stillUnpublished = (await (await page.request.get(`/api/bilans/${bilanId}`)).json()).data;
    expect(stillUnpublished.isPublished).toBe(false);
  });

  test('E2E_ARIA_BILAN_PUBLISH_DENIED_REJECTED_REVIEW — publication stays refused after a REJECTED review, until a new APPROVED one supersedes it', async ({ page }) => {
    await studentCompletesOnePracticeAttempt(page);
    const studentId = await getStudentId(CREDS.ariaPremiereMaths.email);
    const bilanId = await staffGeneratesBilan(page, studentId);

    await page.request.put(`/api/bilans/${bilanId}`, { data: { reviewDecision: 'REJECTED' } });
    const deniedResponse = await page.request.put(`/api/bilans/${bilanId}`, { data: { isPublished: true } });
    expect(deniedResponse.status()).toBe(403);

    // A later APPROVED review does unblock it — proves the gate reacts to
    // the *current* decision, not just "a review happened once".
    await page.request.put(`/api/bilans/${bilanId}`, { data: { reviewDecision: 'APPROVED' } });
    const allowedResponse = await page.request.put(`/api/bilans/${bilanId}`, { data: { isPublished: true } });
    expect(allowedResponse.status()).toBe(200);
  });

  test('E2E_ARIA_BILAN_REVIEW_WRONG_ROLE_DENIED — a real ELEVE session cannot record a review decision', async ({ page }) => {
    await studentCompletesOnePracticeAttempt(page);
    const studentId = await getStudentId(CREDS.ariaPremiereMaths.email);
    const bilanId = await staffGeneratesBilan(page, studentId);

    await resetBrowserSession(page);
    await loginAsUser(page, 'ariaPremiereMaths');
    const response = await page.request.put(`/api/bilans/${bilanId}`, { data: { reviewDecision: 'APPROVED' } });
    expect(response.status()).toBe(403);
  });

  test('E2E_ARIA_BILAN_UNPUBLISHED_STUDENT_DENIED — the real owning student cannot read their own unpublished bilan', async ({ page }) => {
    await studentCompletesOnePracticeAttempt(page);
    const studentId = await getStudentId(CREDS.ariaPremiereMaths.email);
    const bilanId = await staffGeneratesBilan(page, studentId);

    await resetBrowserSession(page);
    await loginAsUser(page, 'ariaPremiereMaths');
    const response = await page.request.get(`/api/bilans/${bilanId}`);
    expect(response.status()).toBe(404);
  });

  test('E2E_ARIA_BILAN_UNPUBLISHED_PARENT_DENIED — the real parent cannot read their own child\'s unpublished bilan', async ({ page }) => {
    await studentCompletesOnePracticeAttempt(page);
    const studentId = await getStudentId(CREDS.ariaPremiereMaths.email);
    const bilanId = await staffGeneratesBilan(page, studentId);

    await resetBrowserSession(page);
    await loginAsUser(page, 'ariaPersonasParent');
    const response = await page.request.get(`/api/bilans/${bilanId}`);
    expect(response.status()).toBe(404);

    const listResponse = await page.request.get(`/api/parent/children/${studentId}/aria/bilans`);
    const listed = (await listResponse.json()).bilans as readonly unknown[];
    expect(listed).toHaveLength(0);
  });
});
