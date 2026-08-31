import { expect, test, type Page } from '@playwright/test';
import { loginAsUser } from '../helpers/auth';
import { attachCoreApiGuard, assertNoCoreApiFailure } from '../helpers/fail-on-core-500';

type DashboardPayload = Readonly<{
  parent: Readonly<{ id: string; firstName: string; lastName: string; email: string }>;
  children: readonly Readonly<{
    id: string;
    firstName: string;
    lastName: string;
    gradeLevel: string;
    academicTrack: string;
    subscriptionDetails: Readonly<{ monthlyPrice?: number }> | null;
  }>[];
  payments: readonly unknown[];
}>;

async function dashboardPayload(page: Page): Promise<DashboardPayload> {
  const response = await page.request.get('/api/parent/dashboard');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  return response.json() as Promise<DashboardPayload>;
}

test.describe('Parent dashboard — current production contract', () => {
  test.beforeEach(async ({ page }) => {
    attachCoreApiGuard(page);
    await loginAsUser(page, 'parent');
    await expect(page.getByRole('heading', { name: 'Espace Famille' })).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    assertNoCoreApiFailure(page);
  });

  test.describe('authenticated shell', () => {
    test('lands on the parent-owned dashboard URL', async ({ page }) => {
      await expect(page).toHaveURL(/\/dashboard\/parent(?:[?#]|$)/);
    });

    test('renders the canonical family heading', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Espace Famille' })).toBeVisible();
    });

    test('identifies the authenticated parent', async ({ page }) => {
      await expect(page.getByText('Marie Dupont', { exact: true }).first()).toBeVisible();
    });

    test('keeps the Nexus brand shell visible around the family view', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Nexus Réussite', exact: true }).first()).toBeVisible();
    });

    test('offers a visible sign-out action', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Déconnexion' })).toBeVisible();
    });

    test('does not expose staff navigation controls', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Administration|Pilotage Enseignant/i })).toHaveCount(0);
    });

    test('does not show the sign-in form after authentication', async ({ page }) => {
      await expect(page.locator('#email')).toHaveCount(0);
      await expect(page.getByTestId('btn-signin')).toHaveCount(0);
    });

    test('survives a full reload with the real session', async ({ page }) => {
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Espace Famille' })).toBeVisible();
      await expect(page).toHaveURL(/\/dashboard\/parent(?:[?#]|$)/);
    });
  });

  test.describe('seeded family and child navigation', () => {
    test('renders every seeded child', async ({ page }) => {
      for (const child of ['Yasmine', 'Karim', 'Lina']) {
        await expect(page.getByRole('heading', { name: child, exact: true })).toBeVisible();
      }
    });

    test('renders exactly one progress action per child', async ({ page }) => {
      await expect(page.getByRole('link', { name: /Voir la progression/ })).toHaveCount(3);
    });

    test('uses a distinct canonical detail URL for each child', async ({ page }) => {
      const hrefs = await page.getByRole('link', { name: /Voir la progression/ }).evaluateAll((links) => (
        links.map((link) => link.getAttribute('href'))
      ));
      expect(hrefs).toHaveLength(3);
      expect(new Set(hrefs).size).toBe(3);
      for (const href of hrefs) expect(href).toMatch(/^\/dashboard\/parent\/enfant\/[a-z0-9]+$/i);
    });

    test('shows Yasmine as a family member', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Yasmine', exact: true })).toBeVisible();
    });

    test('shows Karim as a family member', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Karim', exact: true })).toBeVisible();
    });

    test('shows Lina as a family member', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Lina', exact: true })).toBeVisible();
    });

    test('shows the canonical grade on all child cards', async ({ page }) => {
      await expect(page.getByText(/PREMIERE/)).toHaveCount(3);
    });

    test('shows the general track from the seeded family', async ({ page }) => {
      await expect(page.getByText(/EDS GENERALE/).first()).toBeVisible();
    });

    test('shows the STMG track from the seeded family', async ({ page }) => {
      await expect(page.getByText(/STMG/).first()).toBeVisible();
    });

    test('exposes one NexusIndex label per child', async ({ page }) => {
      await expect(page.getByText('NexusIndex', { exact: true })).toHaveCount(3);
    });

    test('exposes one next-session summary per child', async ({ page }) => {
      await expect(page.getByText('Prochaine séance', { exact: true })).toHaveCount(3);
    });

    test('gives every progress link an accessible name', async ({ page }) => {
      const links = page.getByRole('link', { name: /Voir la progression/ });
      for (let index = 0; index < await links.count(); index += 1) {
        await expect(links.nth(index)).toBeVisible();
      }
    });

    test('opens the canonical child detail from a card', async ({ page }) => {
      await page.getByRole('link', { name: /Voir la progression/ }).first().click();
      await expect(page).toHaveURL(/\/dashboard\/parent\/enfant\/[a-z0-9]+$/i);
      const requestSlot = page.getByRole('link', { name: /demander un créneau/i });
      await expect(requestSlot).toBeVisible();
      await expect(requestSlot).toHaveAttribute('href', /^https:\/\/wa\.me\/21699192829\?text=/);
      await expect(requestSlot).toHaveAttribute('target', '_blank');
      await expect(requestSlot).toHaveAttribute('rel', 'noopener noreferrer');
    });

    test('does not offer activation again for active seeded children', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Activer le compte élève' })).toHaveCount(0);
    });

    test('uses the same child IDs in the API and card URLs', async ({ page }) => {
      const payload = await dashboardPayload(page);
      const hrefs = await page.getByRole('link', { name: /Voir la progression/ }).evaluateAll((links) => (
        links.map((link) => link.getAttribute('href'))
      ));
      expect(new Set(hrefs)).toEqual(new Set(payload.children.map(({ id }) => `/dashboard/parent/enfant/${id}`)));
    });
  });

  test.describe('family rubriques', () => {
    test('exposes the three canonical rubrique controls', async ({ page }) => {
      for (const name of ['Mes Enfants', 'Facturation', 'Alertes']) {
        await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
      }
    });

    test('opens on the children rubrique', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Mes Enfants' })).toBeVisible();
    });

    test('opens the grouped billing rubrique', async ({ page }) => {
      await page.getByRole('button', { name: 'Facturation', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Facturation Groupée' })).toBeVisible();
    });

    test('derives the displayed monthly total from the API payload', async ({ page }) => {
      const payload = await dashboardPayload(page);
      const total = payload.children.reduce((sum, child) => sum + (child.subscriptionDetails?.monthlyPrice ?? 0), 0);
      await page.getByRole('button', { name: 'Facturation', exact: true }).click();
      await expect(page.getByText(`${total} TND`, { exact: true })).toBeVisible();
    });

    test('offers subscription management from billing', async ({ page }) => {
      await page.getByRole('button', { name: 'Facturation', exact: true }).click();
      // « Gérer mes abonnements » ne menait nulle part : remplacé par un lien réel
      // vers la page des formules.
      await expect(page.getByRole('link', { name: 'Voir les formules' })).toBeVisible();
    });

    test('does not leave child cards mounted in billing', async ({ page }) => {
      await page.getByRole('button', { name: 'Facturation', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Yasmine', exact: true })).toHaveCount(0);
    });

    test('opens the consolidated alerts rubrique', async ({ page }) => {
      await page.getByRole('button', { name: 'Alertes', exact: true }).click();
      // Le bloc « Nexus Performance » promettait un suivi « appuyé sur l'IA » et
      // un rapport annuel inexistant : remplacé par un recours humain réel.
      await expect(page.getByRole('heading', { name: 'Une question sur le suivi ?' })).toBeVisible();
    });

    test('offers a real human recourse in alerts', async ({ page }) => {
      await page.getByRole('button', { name: 'Alertes', exact: true }).click();
      await expect(page.getByRole('link', { name: 'Écrire sur WhatsApp' })).toBeVisible();
    });

    test('can return from alerts to the full children list', async ({ page }) => {
      await page.getByRole('button', { name: 'Alertes', exact: true }).click();
      await page.getByRole('button', { name: 'Mes Enfants', exact: true }).click();
      await expect(page.getByRole('link', { name: /Voir la progression/ })).toHaveCount(3);
    });

    test('resets the transient rubrique to children after reload', async ({ page }) => {
      await page.getByRole('button', { name: 'Facturation', exact: true }).click();
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Mes Enfants' })).toBeVisible();
    });
  });

  test.describe('dashboard API and access control', () => {
    test('returns the authenticated parent identity', async ({ page }) => {
      const payload = await dashboardPayload(page);
      expect(payload.parent).toEqual(expect.objectContaining({ firstName: 'Marie', lastName: 'Dupont' }));
    });

    test('returns the three seeded children', async ({ page }) => {
      const payload = await dashboardPayload(page);
      expect(payload.children.map(({ firstName }) => firstName).sort()).toEqual(['Karim', 'Lina', 'Yasmine']);
    });

    test('returns unique child identities', async ({ page }) => {
      const payload = await dashboardPayload(page);
      expect(new Set(payload.children.map(({ id }) => id)).size).toBe(payload.children.length);
    });

    test('does not serialize authentication secrets', async ({ page }) => {
      const response = await page.request.get('/api/parent/dashboard');
      const body = await response.text();
      expect(body).not.toMatch(/password|activationToken|sessionVersion/i);
    });

    test('returns a financial history collection even when empty', async ({ page }) => {
      const payload = await dashboardPayload(page);
      expect(Array.isArray(payload.payments)).toBe(true);
    });

    test('rejects an unauthenticated dashboard API request', async ({ page }) => {
      await page.context().clearCookies();
      const response = await page.request.get('/api/parent/dashboard');
      expect(response.status()).toBe(401);
    });

    test('rejects an authenticated student on the parent API', async ({ page }) => {
      await page.context().clearCookies();
      await loginAsUser(page, 'student', { navigate: false });
      const response = await page.request.get('/api/parent/dashboard');
      expect(response.status()).toBe(403);
    });
  });

  test.describe('resilience and real rendering', () => {
    test('survives repeated rubrique interactions without a core API failure', async ({ page }) => {
      for (const name of ['Facturation', 'Alertes', 'Mes Enfants', 'Facturation', 'Mes Enfants']) {
        await page.getByRole('button', { name, exact: true }).click();
      }
      await expect(page.getByRole('link', { name: /Voir la progression/ })).toHaveCount(3);
    });

    test('does not emit browser console errors during the rendered flow', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.reload();
      await page.getByRole('button', { name: 'Facturation', exact: true }).click();
      await page.getByRole('button', { name: 'Alertes', exact: true }).click();
      expect(errors).toEqual([]);
    });

    test('does not overflow horizontally on a mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Espace Famille' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test('renders the dashboard within the E2E response budget', async ({ page }) => {
      const startedAt = Date.now();
      await page.goto('/dashboard/parent', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Espace Famille' })).toBeVisible();
      expect(Date.now() - startedAt).toBeLessThan(10_000);
    });
  });
});
