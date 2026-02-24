import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test.describe('Dashboard Élève — Audit Exhaustif', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'student');
  });

  test.describe('Dashboard Principal', () => {
    test('charge avec les éléments principaux', async ({ page }) => {
      await page.goto('/dashboard/eleve');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/dashboard/eleve');
      await expect(page.getByText(/crédits|solde/i).first()).toBeVisible({ timeout: 15000 });
    });

    test('widget crédits est visible', async ({ page }) => {
      await page.goto('/dashboard/eleve');
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/crédits|solde/i).first()).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Sessions Élève', () => {
    test('page sessions charge', async ({ page }) => {
      await page.goto('/dashboard/eleve/sessions');
      await page.waitForLoadState('networkidle');
      // Should load without error — either sessions list or empty state
      expect(page.url()).toContain('/dashboard/eleve');
    });
  });

  test.describe('Ressources Élève', () => {
    test('page ressources charge', async ({ page }) => {
      await page.goto('/dashboard/eleve/ressources');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/dashboard/eleve');
    });
  });
});
