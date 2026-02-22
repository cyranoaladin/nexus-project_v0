import { expect, test } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

const BASE_URL = '/programme/maths-1ere';
const STORE_KEY = 'nexus-maths-lab-v2';

function derivationButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: /^1\s*Dérivation/i }).first();
}

function secondDegreButton(page: import('@playwright/test').Page) {
  return page.getByRole('button', { name: /^1\s*Second Degré/i }).first();
}

function buildPersistedState(totalXP: number, completedChapters: string[] = []) {
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
    },
    version: 4,
  };
}

test.describe('Student journey - Maths 1ere', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'parent', { navigate: false, targetPath: BASE_URL });
  });

  test('MathJax critique: pas de LaTeX brut visible + rendu MathJax présent', async ({ page }) => {
    // FIXME: Maths Lab SPA hydration (MathJax) unreliable in CI headless Chrome.
    test.setTimeout(30_000);
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: /Fiches de Cours/i }).click();
    await derivationButton(page).click();
    await page.waitForSelector('mjx-container, mjx-math, .mjx-chtml', { timeout: 5000 }).catch(() => {});

    const renderedText = await page.locator('body').innerText();
    const rawLatexPatterns = [
      /\\frac\{[^}]+\}\{[^}]+\}/,
      /\$\$[^$]+\$\$/,
      /\\sqrt\{[^}]+\}/,
      /\\text\{[^}]+\}/,
      /\\begin\{(?:align|equation)\}/,
    ];

    for (const pattern of rawLatexPatterns) {
      expect(renderedText).not.toMatch(pattern);
    }

    await expect
      .poll(async () => page.locator('mjx-container, mjx-math, .mjx-chtml').count())
      .toBeGreaterThan(0);
  });

  test('Workflow élève: lab fonctions + question correcte + persistance XP/chapitres', async ({ page }) => {
    // FIXME: Maths Lab SPA hydration + interactive elements unreliable in CI.
    test.setTimeout(45_000);
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: /Fiches de Cours/i }).click();
    await derivationButton(page).click();

    // Workflow Lab "Fonctions": ouvrir et manipuler le slider
    await page.getByRole('button', { name: /Tangente Glissante/i }).click();
    const derivativeChip = page.locator('span').filter({ hasText: /f'\(/ }).first();
    const before = await derivativeChip.innerText();
    const slider = page.locator('input[type="range"]').first();
    await slider.focus();
    for (let i = 0; i < 20; i += 1) {
      await slider.press('ArrowRight');
    }
    await expect.poll(async () => derivativeChip.innerText()).not.toBe(before);

    // Répondre juste à une question
    const exerciseHeading = page.getByRole('heading', { name: /Exercices interactifs/i });
    await expect(exerciseHeading).toBeVisible();
    const panel = page.locator('section, div').filter({ has: exerciseHeading }).first();
    await panel.getByRole('button', { name: '2' }).click();
    await panel.getByPlaceholder('Votre réponse...').fill('1');
    await panel.getByRole('button', { name: /^Valider$/ }).click();
    await expect(panel.getByText(/✓ Correct/i)).toBeVisible();

    // Gagner 50 XP (2 chapitres marqués)
    await page.getByRole('button', { name: /Marquer comme lu/i }).first().click();
    await secondDegreButton(page).click();
    await page.getByRole('button', { name: /Marquer comme lu/i }).first().click();
    await expect.poll(async () => {
      const raw = await page.evaluate((key) => localStorage.getItem(key), STORE_KEY);
      if (!raw) return 0;
      return JSON.parse(raw).state?.totalXP ?? 0;
    }).toBeGreaterThanOrEqual(50);

    await page.reload();

    const persisted = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        totalXP: parsed?.state?.totalXP,
        completedChapters: parsed?.state?.completedChapters ?? [],
      };
    }, STORE_KEY);

    expect(persisted?.totalXP).toBeGreaterThanOrEqual(50);
    expect(persisted?.completedChapters).toContain('second-degre');
  });

  test('Navigation interne sans 404 + titres de chapitres valides', async ({ page }) => {
    // FIXME: Depends on full Maths Lab hydration — flaky in CI.
    test.setTimeout(30_000);
    await page.goto(BASE_URL);
    await page.getByRole('button', { name: /Fiches de Cours/i }).click();

    const invalidTitleCount = await page.evaluate(() => {
      const chapterButtons = Array.from(document.querySelectorAll('button')).filter((btn) => {
        const txt = (btn.textContent ?? '').trim();
        return txt.length > 0 && /XP/.test(txt) && /★|☆/.test(txt);
      });
      return chapterButtons.filter((btn) => {
        const txt = (btn.textContent ?? '').toLowerCase();
        return txt.includes('undefined') || txt.trim().length === 0;
      }).length;
    });
    expect(invalidTitleCount).toBe(0);

    const hrefs = await page.$$eval('a[href^="/"]', (links) => {
      const values = links
        .map((a) => a.getAttribute('href') || '')
        .filter((href) => href.startsWith('/'))
        .map((href) => href.split('#')[0]);
      return Array.from(new Set(values));
    });

    for (const href of hrefs.slice(0, 10)) {
      const res = await page.request.get(href);
      expect(res.status(), `Lien en erreur: ${href}`).toBeLessThan(400);
    }
  });

  test('Réhydratation store: XP et chapitres persistent après reload', async ({ page }) => {
    await page.addInitScript(
      ([key, state]: [string, unknown]) => localStorage.setItem(key, JSON.stringify(state)),
      [STORE_KEY, buildPersistedState(50, ['second-degre'])] as [string, unknown]
    );

    await page.goto(BASE_URL);
    await expect.poll(async () => {
      const raw = await page.evaluate((key) => localStorage.getItem(key), STORE_KEY);
      if (!raw) return 0;
      return JSON.parse(raw).state?.totalXP ?? 0;
    }).toBeGreaterThanOrEqual(50);
    await page.reload();
    await expect.poll(async () => {
      const raw = await page.evaluate((key) => localStorage.getItem(key), STORE_KEY);
      if (!raw) return 0;
      return JSON.parse(raw).state?.totalXP ?? 0;
    }).toBeGreaterThanOrEqual(50);

    const completed = await page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return { chapters: [] as string[], xp: 0 };
      return {
        chapters: (JSON.parse(raw).state?.completedChapters ?? []) as string[],
        xp: (JSON.parse(raw).state?.totalXP ?? 0) as number,
      };
    }, STORE_KEY);

    expect(completed.chapters).toContain('second-degre');
    expect(completed.xp).toBeGreaterThanOrEqual(50);
  });

  test('Résilience offline: pas de crash en hors-ligne puis retour online', async ({ page }) => {
    // FIXME: Maths Lab SPA hydration unreliable in CI headless Chrome.
    await page.goto(BASE_URL);
    await expect(page.getByText(/NEXUS MATHS LAB/i)).toBeVisible();

    await page.context().setOffline(true);
    await page.getByRole('button', { name: /Fiches de Cours/i }).click();
    await expect(page.getByText(/NEXUS MATHS LAB/i)).toBeVisible();

    await page.context().setOffline(false);
    await page.reload();
    await expect(page.getByText(/NEXUS MATHS LAB/i)).toBeVisible();
  });
});
