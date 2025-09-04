import { expect, test } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

test.describe('Business flows smoke', () => {
  test('Home credits CTA leads to parent payment', async ({ page }) => {
    await page.goto(`${BASE}/`);
    const cta = page.getByRole('link', { name: /Charger mon compte/i }).first();
    await expect(cta).toBeVisible();
    const [nav] = await Promise.all([
      page.waitForNavigation(),
      cta.click(),
    ]);
    expect(page.url()).toContain('/dashboard/parent/paiement');
  });

  test('Bilan gratuit shows "Déjà inscrit ?" and sign-in link active', async ({ page }) => {
    await page.goto(`${BASE}/bilan-gratuit`);
    await expect(page.locator('text=Déjà inscrit')).toBeVisible();
    const signin = page.getByRole('main').getByRole('link', { name: /Se Connecter/i }).first();
    await expect(signin).toBeVisible();
    await signin.click();
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test('Offers pages reachable and have a primary CTA', async ({ page }) => {
    for (const path of ['/offres/nexus-cortex', '/offres/studio-flex', '/offres/academies-nexus', '/offres/programme-odyssee', '/offres/sos-devoirs']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading').first()).toBeVisible();
      await expect(page.locator('a,button')).toContainText(/Activer|Réserver|S’inscrire|Rejoindre|Demander/i);
    }
  });

  test.fixme(true, 'Admin RAG UI requires session role=ADMIN or bypass; tested separately');
});
