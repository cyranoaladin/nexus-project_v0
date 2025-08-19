import { expect, test } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './accessibility-check';
const RUN = process.env.E2E_RUN === '1';
(RUN ? test.describe : test.describe.skip)('Auth Flow', () => {
  test('Login page loads and allows typing', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    // Cibler explicitement le champ input par son id pour éviter la collision avec le bouton "afficher le mot de passe"
    await expect(page.locator('input#password')).toBeVisible();
    await page.getByLabel(/Email/i).fill('user@test.com');
    await page.locator('input#password').fill('password123');
  });

  test('La page de connexion ne doit avoir aucune violation d\'accessibilité critique', async ({ page }) => {
    await page.goto('/auth/signin');
    await expectNoCriticalA11yViolations(page);
  });
});
