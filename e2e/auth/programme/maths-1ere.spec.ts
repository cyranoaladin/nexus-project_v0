import { expect, test } from '@playwright/test';
import { loginAsUser } from '../../helpers/auth';

const URL = '/programme/maths-1ere';

test.describe('Maths Première — client canonique', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'parent', { navigate: false, targetPath: URL });
    await page.goto(URL);
    await expect(page.getByRole('heading', { name: 'Nexus Maths' }).first()).toBeVisible();
  });

  test('les quatre vues produit sont accessibles sans 404', async ({ page }) => {
    for (const tab of ['Cockpit Pédagogique', 'Programme & Cours', 'Objectif Épreuve', 'Mon Plan Final']) {
      await page.getByRole('button', { name: tab }).click();
      await expect(page.getByText('404', { exact: true })).toHaveCount(0);
    }
  });

  test('le programme affiche ses chapitres sans LaTeX brut', async ({ page }) => {
    await page.getByRole('button', { name: 'Programme & Cours' }).click();
    await expect(page.getByText(/Second degré/i).first()).toBeVisible();
    const visibleText = await page.locator('main').innerText();
    expect(visibleText).not.toMatch(/\\frac\{|\$\$[^$]+\$\$|\\sqrt\{/);
  });
});
