import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

test.describe('Dashboard Élève — Audit Exhaustif', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'student');
  });

  test.describe('Dashboard Principal', () => {
    test('charge avec les éléments principaux', async ({ page }) => {
      await page.goto('/dashboard/eleve');
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/dashboard/eleve');
      await expect(page.getByText(/Cockpit du jour/i)).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('tab', { name: 'Réserver Session', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Réserver', exact: true })).toBeVisible();
    });

    test('navigation cockpit et parcours est visible', async ({ page }) => {
      await page.goto('/dashboard/eleve');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByRole('button', { name: 'Cockpit', exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('button', { name: 'Parcours', exact: true })).toBeVisible();
    });
  });

  test.describe('Sessions Élève', () => {
    test('page sessions charge', async ({ page }) => {
      await page.goto('/dashboard/eleve/sessions');
      await page.waitForLoadState('domcontentloaded');
      // Should load without error — either sessions list or empty state
      expect(page.url()).toContain('/dashboard/eleve');
    });
  });

  test.describe('Ressources Élève', () => {
    test('page ressources charge', async ({ page }) => {
      await page.goto('/dashboard/eleve/ressources');
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/dashboard/eleve');
    });
  });
});
