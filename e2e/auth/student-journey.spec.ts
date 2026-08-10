import { expect, test, type Page } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

const LEGACY_URL = '/programme/maths-1ere';
const CANONICAL_URL = '/dashboard/eleve/programme/maths';
const STORE_KEY = 'nexus-maths-lab-v2';

function progressPayload(totalXP = 0, completedChapters: string[] = []) {
  return {
    completed_chapters: completedChapters,
    mastered_chapters: [],
    total_xp: totalXP,
    quiz_score: 0,
    combo_count: 0,
    best_combo: 0,
    streak: 0,
    streak_freezes: 0,
    last_activity_date: null,
    daily_challenge: { lastCompletedDate: null, todayChallengeId: null, completedToday: false },
    exercise_results: {},
    hint_usage: {},
    badges: [],
    srs_queue: {},
    diagnostic_results: {},
    time_per_chapter: {},
    formulaire_viewed: false,
    grand_oral_seen: 0,
    lab_archimede_opened: false,
    euler_max_steps: 0,
    newton_best_iterations: null,
    printed_fiche: false,
  };
}

function persistedState(totalXP: number, completedChapters: string[] = []) {
  return {
    state: {
      completedChapters,
      unlockedChapters: ['second-degre', 'derivation', 'produit-scalaire', 'probabilites-cond', 'algorithmique-python'],
      masteredChapters: [],
      totalXP,
      quizScore: 0,
      levelUpCount: 0,
      lastLevelUpName: null,
      comboCount: 0,
      bestCombo: 0,
      streak: 0,
      lastActivityDate: null,
      streakFreezes: 0,
      dailyChallenge: { lastCompletedDate: null, todayChallengeId: null, completedToday: false },
      exerciseResults: {},
      hintUsage: {},
      badges: [],
      srsQueue: {},
      diagnosticResults: {},
      timePerChapter: {},
      formulaireViewed: false,
      grandOralSeen: 0,
      labArchimedeOpened: false,
      eulerMaxSteps: 0,
      newtonBestIterations: null,
      printedFiche: false,
    },
    version: 5,
  };
}

async function setRemoteProgress(page: Page, totalXP = 0, completedChapters: string[] = []) {
  const response = await page.request.post('/api/programme/maths-1ere/progress', {
    data: progressPayload(totalXP, completedChapters),
    failOnStatusCode: false,
  });
  expect(response.status()).toBe(200);
}

async function openCanonicalProgramme(page: Page) {
  await page.goto(CANONICAL_URL);
  await expect(page.getByRole('heading', { name: 'Nexus Maths' }).first()).toBeVisible();
}

async function openDerivation(page: Page) {
  await openCanonicalProgramme(page);
  await page.getByRole('button', { name: 'Programme & Cours' }).click();
  await page.getByRole('button', { name: 'Dérivation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dérivation', exact: true })).toBeVisible();
}

test.describe.serial('Student journey — canonical Maths Première', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'student');
    await setRemoteProgress(page);
    await page.evaluate((key) => localStorage.removeItem(key), STORE_KEY);
  });

  test('legacy URL redirects the student to the dashboard-owned programme', async ({ page }) => {
    await page.goto(LEGACY_URL);
    await expect(page).toHaveURL(new RegExp(`${CANONICAL_URL}$`));
  });

  test('canonical programme renders the student navigation without staff controls', async ({ page }) => {
    await openCanonicalProgramme(page);
    for (const tab of ['Cockpit Pédagogique', 'Programme & Cours', 'Objectif Épreuve', 'Mon Plan Final']) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Pilotage Enseignant' })).toHaveCount(0);
  });

  test('renders formulas through KaTeX without leaking raw LaTeX', async ({ page }) => {
    await openDerivation(page);
    await expect.poll(async () => page.locator('.katex').count()).toBeGreaterThan(0);

    const renderedText = await page.locator('body').innerText();
    for (const rawLatex of [
      /\\frac\{[^}]+\}\{[^}]+\}/,
      /\$\$[^$]+\$\$/,
      /\\sqrt\{[^}]+\}/,
      /\\text\{[^}]+\}/,
      /\\begin\{(?:align|equation)\}/,
    ]) {
      expect(renderedText).not.toMatch(rawLatex);
    }
  });

  test('manipulates the lab, solves an exercise, earns real XP and persists it', async ({ page }) => {
    test.setTimeout(90_000);
    await openDerivation(page);

    await page.getByRole('button', { name: /La Tangente Glissante/ }).click();
    const slider = page.locator('input[type="range"]').first();
    await expect(slider).toBeVisible();
    const sliderBefore = await slider.inputValue();
    await slider.focus();
    await slider.press('ArrowRight');
    await expect.poll(async () => slider.inputValue()).not.toBe(sliderBefore);

    const exerciseHeading = page.getByRole('heading', { name: 'Exercices interactifs' });
    const exercisePanel = page.locator('div.bg-slate-900').filter({ has: exerciseHeading }).first();
    await exercisePanel.getByRole('button', { name: '2', exact: true }).click();
    await exercisePanel.getByPlaceholder('Votre réponse...').fill('1');
    await exercisePanel.getByRole('button', { name: 'Valider', exact: true }).click();
    await expect(exercisePanel.getByText('Correct', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Terminer', exact: true }).click();
    await page.getByRole('button', { name: 'Algèbre & Suites', exact: true }).click();
    await page.getByRole('button', { name: 'Second Degré', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Second Degré', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Terminer', exact: true }).click();

    await expect.poll(async () => {
      const response = await page.request.get('/api/programme/maths-1ere/progress');
      const body = await response.json() as { data?: { total_xp?: number } };
      return body.data?.total_xp ?? 0;
    }).toBeGreaterThanOrEqual(50);

    await page.reload();
    const xpLabel = page.getByText(/\d+ XP cumulés/).first();
    await expect(xpLabel).toBeVisible();
    expect(Number((await xpLabel.innerText()).match(/\d+/)?.[0] ?? 0)).toBeGreaterThanOrEqual(50);
  });

  test('navigates between valid chapter titles and keeps internal routes healthy', async ({ page }) => {
    await openDerivation(page);
    await page.getByRole('button', { name: 'Variations et Courbes', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Variations et Courbes', exact: true })).toBeVisible();
    expect((await page.locator('body').innerText()).toLowerCase()).not.toContain('undefined');

    for (const route of [CANONICAL_URL, '/dashboard/eleve']) {
      const response = await page.request.get(route);
      expect(response.status(), `Route interne en erreur: ${route}`).toBeLessThan(400);
    }
  });

  test('rehydrates XP and completed chapters after a reload', async ({ page }) => {
    await setRemoteProgress(page, 50, ['second-degre']);
    await page.addInitScript(
      ([key, state]: [string, unknown]) => localStorage.setItem(key, JSON.stringify(state)),
      [STORE_KEY, persistedState(50, ['second-degre'])] as [string, unknown],
    );

    await openCanonicalProgramme(page);
    await expect(page.getByText('50 XP cumulés', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('50 XP cumulés', { exact: true })).toBeVisible();

    const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORE_KEY);
    expect(persisted.state.totalXP).toBe(50);
    expect(persisted.state.completedChapters).toContain('second-degre');
  });

  test('stays usable offline and recovers after reconnecting', async ({ page, context }) => {
    await openCanonicalProgramme(page);
    await page.getByRole('button', { name: 'Programme & Cours' }).click();
    await expect(page.getByRole('heading', { name: 'Second Degré', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /Le Contrôleur de Parabole/ }).click();
    const offlineSlider = page.locator('input[type="range"]').first();
    await expect(offlineSlider).toBeVisible();
    const sliderBefore = await offlineSlider.inputValue();

    // Load the course surface before losing the network: the offline contract
    // covers already visited pedagogical content, not first-time chunk download.
    await context.setOffline(true);
    await offlineSlider.focus();
    await offlineSlider.press('ArrowRight');
    await expect.poll(async () => offlineSlider.inputValue()).not.toBe(sliderBefore);

    await context.setOffline(false);
    await expect.poll(async () => {
      const response = await page.request.get('/api/auth/session', { failOnStatusCode: false });
      return response.status();
    }).toBe(200);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Nexus Maths' }).first()).toBeVisible();
  });
});
