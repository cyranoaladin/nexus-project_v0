import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

test.describe('Dashboard Coach — Audit Exhaustif', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'coach');
  });

  test.describe('Page Principale', () => {
    test('dashboard coach charge', async ({ page }) => {
      await page.goto('/dashboard/coach');
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/dashboard/coach');
    });

    test('contenu principal est visible', async ({ page }) => {
      await page.goto('/dashboard/coach');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByRole('heading', { level: 1, name: /^Coach — / })).toBeVisible();
      // Coaching does not grant the parent's/student's booking affordance.
      await expect(page.getByRole('button', { name: /réserver une session|book a session/i })).toHaveCount(0);
    });
  });

  test.describe('Disponibilités', () => {
    test('page disponibilités charge', async ({ page }) => {
      await page.goto('/dashboard/coach/availability');
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/dashboard/coach');
    });
  });
});
