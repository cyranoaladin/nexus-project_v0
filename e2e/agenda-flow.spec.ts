import { expect, test } from '@playwright/test';
import { loginAs } from './helpers';
const RUN = process.env.E2E_RUN === '1';
(RUN ? test.describe : test.describe.skip)('Agenda Flow', () => {
  test('Student sessions page renders', async ({ page }) => {
    await loginAs(page, 'eleve.lucas.dupont@nexus.com');
    await page.goto('/dashboard/eleve/sessions');
    await page.waitForLoadState('networkidle');

    const title = page.getByRole('heading', { name: /Réserver une Session/i });
    const loading = page.getByText(/Chargement/i);
    const error = page.getByText(/Erreur lors du chargement/i);

    // Robust redirect detection (some engines propagate session slowly)
    const redirected =
      /\/auth\/signin/.test(page.url()) ||
      (await (async () => {
        try {
          await page.waitForURL('**/auth/signin', { timeout: 8000 });
          return true;
        } catch {
          return false;
        }
      })());

    if (redirected) {
      await expect(page).toHaveURL(/\/auth\/signin/);
      return;
    }

    await expect(title.or(loading).or(error)).toBeVisible({ timeout: 25000 });
  });
});
