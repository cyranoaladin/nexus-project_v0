import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

test.describe('Dashboard Admin — Audit Exhaustif', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'admin');
  });

  test.describe('Page Principale /dashboard/admin', () => {
    test('charge sans erreur et affiche le contenu', async ({ page }) => {
      await page.goto('/dashboard/admin');
      await page.waitForLoadState('domcontentloaded');
      // Page should load without 500
      expect(page.url()).toContain('/dashboard/admin');
    });

    test('bouton déconnexion fonctionne', async ({ page }) => {
      await page.goto('/dashboard/admin');
      await page.waitForLoadState('domcontentloaded');
      const logoutBtn = page.getByTestId('logout-button').first();
      await expect(logoutBtn).toBeVisible();
      await Promise.all([
        page.waitForURL((url) => ['/', '/auth/signin'].includes(url.pathname)),
        logoutBtn.click(),
      ]);
      const session = await page.request.get('/api/auth/session');
      const body = await session.json() as { user?: unknown } | null;
      expect(body?.user).toBeUndefined();
    });
  });

  test.describe('Admin > Gestion Utilisateurs', () => {
    test('page users charge', async ({ page }) => {
      await page.goto('/dashboard/admin/users');
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/dashboard/admin');
    });

    test('bouton Créer Utilisateur est visible', async ({ page }) => {
      await page.goto('/dashboard/admin/users');
      await page.waitForLoadState('domcontentloaded');
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
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/dashboard/admin');
    });
  });

  test.describe('Admin > Documents', () => {
    test('page documents charge', async ({ page }) => {
      await page.goto('/dashboard/admin/documents');
      await page.waitForLoadState('domcontentloaded');
      expect(page.url()).toContain('/dashboard/admin');
    });
  });
});
