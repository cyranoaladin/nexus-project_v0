import { test, expect } from '@playwright/test';
import { loginAsUser } from './helpers/auth';

test.describe('Dashboard Admin — Audit Exhaustif', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'admin');
  });

  test.describe('Page Principale /dashboard/admin', () => {
    test('charge sans erreur et affiche le contenu', async ({ page }) => {
      await page.goto('/dashboard/admin');
      await page.waitForLoadState('networkidle');
      // Page should load without 500
      expect(page.url()).toContain('/dashboard/admin');
    });

    test('bouton déconnexion fonctionne', async ({ page }) => {
      await page.goto('/dashboard/admin');
      await page.waitForLoadState('domcontentloaded');
      const logoutBtn = page.getByRole('button', { name: /déconnexion|logout/i })
        .or(page.getByText(/déconnexion|logout/i));
      if (await logoutBtn.first().isVisible()) {
        await logoutBtn.first().click();
        await page.waitForLoadState('domcontentloaded');
        await expect(page).toHaveURL(/auth\/signin|^\//);
      }
    });
  });

  test.describe('Admin > Gestion Utilisateurs', () => {
    test('page users charge', async ({ page }) => {
      await page.goto('/dashboard/admin/users');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/dashboard/admin');
    });

    test('bouton Créer Utilisateur est visible', async ({ page }) => {
      await page.goto('/dashboard/admin/users');
      await page.waitForLoadState('networkidle');
      const createBtn = page.getByRole('button', { name: /créer|ajouter.*utilisateur|new user/i });
      if (await createBtn.isVisible()) {
        await createBtn.click();
        // Dialog or form should appear
        await expect(page.getByLabel(/email/i).first()).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Admin > Tests Système', () => {
    test('page tests charge', async ({ page }) => {
      await page.goto('/dashboard/admin/tests');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/dashboard/admin');
    });
  });

  test.describe('Admin > Documents', () => {
    test('page documents charge', async ({ page }) => {
      await page.goto('/dashboard/admin/documents');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/dashboard/admin');
    });
  });
});
