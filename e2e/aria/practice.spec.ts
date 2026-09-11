/**
 * ARIA_STUDENT_PRACTICE_GOLDEN_E2E (P6c) — the real student journey P1-P5
 * built but never exercised end to end in a real browser: login -> cockpit
 * -> course -> Next Best Action -> real practice activity -> answer ->
 * submit -> AI correction -> resulting mastery visible.
 *
 * Real disposable PostgreSQL, real Next.js production-like runtime, real
 * NextAuth session, real persisted Activity/Attempt/Response/Result/
 * Evidence, real authorization at every step. The only stand-in is the
 * external model provider (this fixture's own `/v1/chat/completions`,
 * already the established ARIA E2E mechanism — see conversation.spec.ts)
 * — and even that genuinely grades the real submitted MCQ answer against
 * the real correctionRubric rather than returning a canned verdict (see
 * aria-fixture-provider.ts's `gradedCorrectionFeedback`).
 */
import { expect, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { authorRealAriaPracticeActivity, cleanupAriaPracticeGoldenPath, completeAriaOnboardingByEmail } from '../helpers/db';
import { CREDS } from '../helpers/credentials';
import { resetFixture } from './helpers';

// Canonical skill-graph registry key — what the real Activity row, and the
// Practice/Mastery/NBA backend, are keyed on (`lib/aria/curriculum/catalog.ts`
// vs. `lib/curriculum/catalog.ts` — see `course-key-aliases.ts`).
const REAL_COURSE_KEY = 'eds-maths-premiere';
// The SAME real course, but as the cockpit UI's own product-catalog key —
// what `AriaCourseCard`'s `data-testid` actually renders.
const COCKPIT_COURSE_KEY = 'maths-premiere-eds';
const REAL_SKILL_ID = 'ALG_SUITE_ARITH';
const REAL_SKILL_LABEL = 'Suites arithmétiques (u_n, somme)';

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

test.describe.serial('ARIA-P6c real student Practice golden path', () => {
  test.beforeEach(async ({ request }) => {
    await cleanupAriaPracticeGoldenPath(REAL_COURSE_KEY);
    await resetFixture(request);
  });

  test.afterAll(async () => {
    await cleanupAriaPracticeGoldenPath(REAL_COURSE_KEY);
  });

  test('E2E_ARIA_STUDENT_PRACTICE_GOLDEN — real login through real correction to real mastery', async ({ page }) => {
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
    await page.goto('/dashboard/eleve/aria', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('aria-cockpit-page')).toBeVisible();

    await page.getByTestId('aria-nav-CURRICULUM').click();
    await page.getByTestId(`aria-course-card-${COCKPIT_COURSE_KEY}`).getByRole('button', { name: 'Ouvrir' }).click();
    await expect(page.getByText('Domaines et compétences')).toBeVisible();

    // Real Next Best Action: the only real skill with real content, never
    // attempted -> NOT_STARTED -> the sole real candidate -> recommended.
    // The skill label renders as a sibling of the CTA itself
    // (AriaCourseWorkspace.tsx), not inside the `aria-next-best-action`
    // testid — that id is on the "Commencer" link/button alone.
    await expect(page.getByText(REAL_SKILL_LABEL)).toBeVisible();
    const nba = page.getByTestId('aria-next-best-action');
    await expect(nba).toBeVisible();

    await nba.click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/eleve/aria/practice/${activity.activityId}`));
    await expect(page.getByText(MCQ_PROMPT.questionText)).toBeVisible();

    // The real correct option, per the real correctionRubric.
    await page.getByLabel('3', { exact: true }).click();
    await page.getByTestId('aria-practice-submit').click();

    await expect(page.getByTestId('aria-practice-result')).toBeVisible();
    await expect(page.getByText('Correct', { exact: true })).toBeVisible();

    // Real mastery, recomputed from the real LearningEvidence row the real
    // correction just wrote — one real CORRECT attempt -> DEVELOPING.
    await page.getByRole('button', { name: 'Retour au cockpit' }).click();
    await expect(page.getByTestId('aria-cockpit-page')).toBeVisible();
    await page.getByTestId('aria-nav-CURRICULUM').click();
    await page.getByTestId(`aria-course-card-${COCKPIT_COURSE_KEY}`).getByRole('button', { name: 'Ouvrir' }).click();
    await expect(page.getByText('En progrès')).toBeVisible();
  });
});
