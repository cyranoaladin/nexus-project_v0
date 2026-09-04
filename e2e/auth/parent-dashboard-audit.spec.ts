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

    test('un parent peut demander un créneau depuis un enfant', async ({ page }) => {
      await page.goto('/dashboard/parent');
      await expectParentDashboard(page);
      await page.getByRole('link', { name: /voir la progression/i }).first().click();
      const requestSlot = page.getByRole('link', { name: /demander un créneau/i });
      await expect(requestSlot).toBeVisible();
      await expect(requestSlot).toHaveAttribute('href', /^https:\/\/wa\.me\/21699192829\?text=/);
      await expect(requestSlot).toHaveAttribute('target', '_blank');
      await expect(requestSlot).toHaveAttribute('rel', 'noopener noreferrer');
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
      // Le titre annonce « visible OU masquée » ; l'assertion, elle, exigeait la
      // bannière apres avoir seulement vide le drapeau localStorage. Or la
      // fermeture est aussi persistee COTE SERVEUR (`bilanGratuitDismissedAt`,
      // pose par /api/bilan-gratuit/dismiss) : une fois qu'une autre spec l'a
      // fermee, la bannière ne revient plus et ce test echouait selon l'ordre
      // d'execution.
      //
      // L'invariant reellement utile ne depend pas de cet ordre : l'affichage
      // doit REFLETER l'etat persiste. On lit donc le statut, puis on verifie la
      // correspondance dans les deux sens — ce qui teste davantage que
      // l'ancienne version, tout en devenant deterministe.
      await page.goto('/dashboard/parent');
      await page.evaluate(() => localStorage.removeItem('nexus_bilan_gratuit_dismissed'));
      await page.reload();
      await expectParentDashboard(page);

      const status = await page.request.get('/api/bilan-gratuit/status', { failOnStatusCode: false });
      expect(status.status()).toBe(200);
      const { dismissed, completed } = (await status.json()) as { dismissed: boolean; completed: boolean };

      const banner = page.getByText(/Bilan Diagnostic Gratuit/i);
      if (dismissed || completed) {
        await expect(banner).toHaveCount(0);
      } else {
        await expect(banner).toBeVisible();
      }
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
