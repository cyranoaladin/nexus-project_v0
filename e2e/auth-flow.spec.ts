import { expect, test } from '@playwright/test';
import { expectNoCriticalA11yViolations } from './accessibility-check';
import { captureConsole } from './helpers';
const RUN = process.env.E2E_RUN === '1';
(RUN ? test.describe : test.describe.skip)('Auth Flow', () => {
  test('Login page loads and allows typing', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    try {
      await page.goto('/auth/signin');
      await expect(page.getByLabel(/Email/i)).toBeVisible();
      // Cibler explicitement le champ input par son id pour éviter la collision avec le bouton "afficher le mot de passe"
      await expect(page.locator('input#password')).toBeVisible();
      await page.getByLabel(/Email/i).fill('user@test.com');
      await page.locator('input#password').fill('password123');
    } finally {
      await cap.attach('console.auth.login.json');
    }
  });

  test('La page de connexion ne doit avoir aucune violation d\'accessibilité critique', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    try {
      await page.goto('/auth/signin');
      await expectNoCriticalA11yViolations(page);
    } finally {
      await cap.attach('console.auth.a11y.json');
    }
  });
});
