import { test, expect } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';

test.describe('Dashboard Parent — Audit Exhaustif', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page, 'parent');
  });

  async function expectParentDashboard(page: import('@playwright/test').Page) {
    await expect(page).toHaveURL(/\/dashboard\/parent(?:[?#]|$)/);
    await expect(page.getByRole('heading', { name: /Espace Famille/i })).toBeVisible({ timeout: 15_000 });
  }

  test.describe('Dashboard Principal', () => {
    test('charge avec les éléments principaux', async ({ page }) => {
      await page.goto('/dashboard/parent');
      await page.waitForLoadState('domcontentloaded');
      await expectParentDashboard(page);
    });

    test('header affiche le nom du parent', async ({ page }) => {
      await page.goto('/dashboard/parent');
      await expectParentDashboard(page);
      await expect(page.getByText(/Marie Dupont/i).first()).toBeVisible();
    });

    test('onglet Mes Enfants est actif par défaut', async ({ page }) => {
      await page.goto('/dashboard/parent');
      await expectParentDashboard(page);
      await expect(page.getByRole('heading', { name: /Mes Enfants/i })).toBeVisible();
    });

    test('un parent peut atteindre la réservation depuis un enfant', async ({ page }) => {
      await page.goto('/dashboard/parent');
      await expectParentDashboard(page);
      await page.getByRole('link', { name: /voir la progression/i }).first().click();
      await expect(page.getByRole('button', { name: /réserver une séance/i })).toBeVisible();
    });

    test('bouton déconnexion fonctionne', async ({ page }) => {
      await page.goto('/dashboard/parent');
      await expectParentDashboard(page);
      const logoutBtn = page.getByTestId('logout-button');
      await expect(logoutBtn).toBeVisible();
      await Promise.all([
        page.waitForURL((url) => ['/', '/auth/signin'].includes(url.pathname)),
        logoutBtn.click(),
      ]);
      await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/(?:auth\/signin)?$/);
    });
  });

  test.describe('BilanGratuitBanner', () => {
    test('banner bilan gratuit est visible ou masquée', async ({ page }) => {
      // Clear localStorage to ensure banner shows
      await page.goto('/dashboard/parent');
      await page.evaluate(() => localStorage.removeItem('nexus_bilan_gratuit_dismissed'));
      await page.reload();
      await expectParentDashboard(page);
      await expect(page.getByText(/Bilan Diagnostic Gratuit/i)).toBeVisible();
    });
  });

  test.describe('Dialog Ajouter Enfant', () => {
    test('bouton Ajouter Enfant est visible', async ({ page }) => {
      await page.goto('/dashboard/parent');
      await expectParentDashboard(page);
      const addChildBtn = page.getByRole('button', { name: /ajouter.*enfant|nouvel enfant|\+/i });
      await expect(addChildBtn).toBeVisible();
    });
  });

  test.describe('Section Abonnement', () => {
    test('section abonnement est visible', async ({ page }) => {
      await page.goto('/dashboard/parent');
      await expectParentDashboard(page);
      await expect(page.getByRole('button', { name: /facturation/i })).toBeVisible();
    });
  });
});
