import { test, expect } from '@playwright/test';

const PAGES = [
  '/',
  '/offres',
  '/contact',
  '/famille',
  '/equipe',
  '/notre-centre',
  '/accompagnement-scolaire',
  '/plateforme-aria',
  '/academy',
  '/studio',
  '/consulting',
  '/education',
  '/academies-hiver',
  '/stages',
  '/stages/fevrier-2026',
  '/mentions-legales',
  '/conditions',
  '/auth/signin',
  '/auth/mot-de-passe-oublie',
];

test.describe('Static page smoke checks', () => {
  for (const path of PAGES) {
    test(`loads ${path} with visible heading`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBeLessThan(400);

      const heading = page.locator('h1').first();
      await expect(heading).toBeVisible({ timeout: 10000 });
      await expect(heading).not.toHaveText('', { timeout: 10000 });
    });
  }
});
