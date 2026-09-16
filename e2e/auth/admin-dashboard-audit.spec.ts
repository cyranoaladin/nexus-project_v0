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

    test('ouvre le formulaire utilisateur après vérification canonique différée', async ({ page }) => {
      // A loading shell must not count as a successful creation-form audit.
      let releaseSession!: () => void;
      const sessionGate = new Promise<void>((resolve) => { releaseSession = resolve; });
      let markSessionHeld!: () => void;
      const sessionHeld = new Promise<void>((resolve) => { markSessionHeld = resolve; });
      await page.route('**/api/auth/session', async (route) => {
        markSessionHeld();
        await sessionGate;
        await route.continue();
      });
      try {
        await page.goto('/dashboard/admin/users');
        await sessionHeld;
        await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'LOADING');
      } finally {
        releaseSession();
        await page.unrouteAll({ behavior: 'wait' });
      }
      await expect(page.locator('[data-session-observation]')).toHaveAttribute('data-session-observation', 'AUTHENTICATED');
      const createButton = page.getByRole('button', { name: 'Ajouter Utilisateur', exact: true });
      await expect(createButton).toBeVisible();
      await createButton.click();
      const dialog = page.getByRole('dialog', { name: 'Ajouter Utilisateur', exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel('Email *', { exact: true })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Créer', exact: true })).toBeVisible();
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
