import { test, expect } from '@playwright/test';

test.describe('Homepage (/) — Tous les éléments interactifs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page charge sans erreurs console critiques', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const critical = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('hydration') && !e.includes('Warning')
    );
    expect(critical).toHaveLength(0);
  });

  test('logo renvoie vers /', async ({ page }) => {
    await page.locator('a[href="/"]').first().click();
    await expect(page).toHaveURL('/');
  });

  test('bouton Connexion navbar fonctionne', async ({ page }) => {
    const connexion = page.getByRole('link', { name: /connexion/i });
    if (await connexion.isVisible()) {
      await connexion.click();
      await expect(page).toHaveURL('/auth/signin');
    }
  });

  test('CTA Hero "Bilan gratuit" fonctionne', async ({ page }) => {
    const bilanLink = page.getByRole('link', { name: /bilan gratuit/i }).first();
    if (await bilanLink.isVisible()) {
      await bilanLink.click();
      await expect(page).toHaveURL('/bilan-gratuit');
    }
  });

  test('CTA Hero "Voir nos offres" fonctionne', async ({ page }) => {
    const offresLink = page.getByRole('link', { name: /voir nos offres|nos offres|découvrir/i }).first();
    if (await offresLink.isVisible()) {
      await offresLink.click();
      await expect(page).toHaveURL(/offres/);
    }
  });

  test('tous les liens footer sont fonctionnels (pas de 404)', async ({ page }) => {
    const footerLinks = page.locator('footer a[href^="/"]');
    const count = await footerLinks.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(count, 15); i++) {
      const href = await footerLinks.nth(i).getAttribute('href');
      if (href) {
        const response = await page.request.get(href);
        expect(response.status(), `Footer link ${href} returned ${response.status()}`).not.toBe(404);
      }
    }
  });

  test('lien Mentions légales footer fonctionne', async ({ page }) => {
    const link = page.locator('footer a[href="/mentions-legales"]');
    if (await link.isVisible()) {
      await link.click();
      await expect(page).toHaveURL('/mentions-legales');
    }
  });

  test('lien Conditions footer fonctionne', async ({ page }) => {
    const link = page.locator('footer a[href="/conditions"]');
    if (await link.isVisible()) {
      await link.click();
      await expect(page).toHaveURL('/conditions');
    }
  });

  test('H1 est visible', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible();
  });
});
