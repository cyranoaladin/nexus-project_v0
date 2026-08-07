import { test, expect } from '@playwright/test';

// Requires an authenticated ELEVE fixture and the migration/seed described in README.md.
test.describe('candidate diagnostic portal', () => {
  test.skip(!process.env.E2E_STUDENT_STORAGE_STATE, 'E2E_STUDENT_STORAGE_STATE is required');
  test.use({ storageState: process.env.E2E_STUDENT_STORAGE_STATE });

  test('creates, autosaves and resumes the first module', async ({ page }) => {
    await page.goto('/dashboard/eleve/diagnostic-candidat-libre');
    const start = page.getByRole('button', { name: /commencer mon diagnostic/i });
    if (await start.isVisible().catch(() => false)) await start.click();
    await page.getByRole('button', { name: /ouvrir le module/i }).first().click();
    await page.getByText(/je réalise les épreuves seul/i).waitFor();
    await page.getByRole('button', { name: /je confirme cette déclaration/i }).click();
    await page.waitForTimeout(2200);
    await page.getByRole('button', { name: /fermer/i }).click();
    await page.reload();
    await expect(page.getByText(/diagnostic de/i)).toBeVisible();
  });
});
