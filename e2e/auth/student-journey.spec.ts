import { expect, test } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

const LEGACY_URL = '/programme/maths-1ere';
const CANONICAL_URL = '/dashboard/eleve/programme/maths';
const STORE_KEY = 'nexus-maths-lab-v2';

test.describe('Student journey — canonical Maths Première', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'student');
  });

  test('legacy URL redirects the student to the dashboard-owned programme', async ({ page }) => {
    await page.goto(LEGACY_URL);
    await expect(page).toHaveURL(new RegExp(`${CANONICAL_URL}$`));
  });

  test('canonical programme renders the student navigation without staff controls', async ({ page }) => {
    await page.goto(CANONICAL_URL);
    await expect(page.getByRole('heading', { name: 'Nexus Maths' }).first()).toBeVisible();
    for (const tab of ['Cockpit Pédagogique', 'Programme & Cours', 'Objectif Épreuve', 'Mon Plan Final']) {
      await expect(page.getByRole('button', { name: tab })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Pilotage Enseignant' })).toHaveCount(0);
  });

  test('local learning progress survives a reload on the canonical URL', async ({ page }) => {
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [
      STORE_KEY,
      JSON.stringify({ state: { totalXP: 50, completedChapters: ['second-degre'] }, version: 4 }),
    ]);
    await page.goto(CANONICAL_URL);
    await page.reload();

    const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), STORE_KEY);
    expect(persisted.state.totalXP).toBe(50);
    expect(persisted.state.completedChapters).toContain('second-degre');
  });
});
