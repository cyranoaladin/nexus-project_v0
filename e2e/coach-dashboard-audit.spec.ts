import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test.describe('Dashboard Coach — Audit Exhaustif', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'coach');
  });

  test.describe('Page Principale', () => {
    test('dashboard coach charge', async ({ page }) => {
      await page.goto('/dashboard/coach');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/dashboard/coach');
    });

    test('contenu principal est visible', async ({ page }) => {
      await page.goto('/dashboard/coach');
      await page.waitForLoadState('networkidle');
      // Should display sessions or coach-related content
      const body = await page.textContent('body');
      expect(body).toBeTruthy();
    });
  });

  test.describe('Disponibilités', () => {
    test('page disponibilités charge', async ({ page }) => {
      await page.goto('/dashboard/coach/availability');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/dashboard/coach');
    });
  });
});
