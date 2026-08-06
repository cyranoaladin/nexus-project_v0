import { expect, test } from '@playwright/test';

import { loginAsUser } from './helpers/auth';

test.describe('Canonical bilan pilot surfaces with flags off', () => {
  test('student sees the fail-closed start state while no pack is activated', async ({ page }) => {
    await loginAsUser(page, 'student');
    await page.goto('/bilan-gratuit/assessment');
    await expect(page.getByRole('heading', { name: 'Commencer mon questionnaire' })).toBeVisible();
    await expect(page.getByText('Aucun questionnaire n’est ouvert actuellement.')).toBeVisible();
  });

  test('parent receives a restrained denial for an unknown report', async ({ page }) => {
    await loginAsUser(page, 'parent');
    await page.goto('/bilan-gratuit/assessment/attempt-inexistant/report');
    await expect(
      page.getByRole('alert').filter({ hasText: 'Ce bilan n’est pas accessible avec ce compte.' }),
    ).toBeVisible();
  });
});
