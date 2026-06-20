import { expect, test } from '@playwright/test';

test.describe('Audit E2E de la Page d\'Accueil (redesign 2026)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Disable animations to ensure all content is immediately visible
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; opacity: revert !important; }' });
  });

  test('La page se charge avec header, main et footer', async ({ page }) => {
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('Le h1 est visible avec le bon texte', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).toHaveText(
      'Préparer le bac français avec méthode, suivi et exigence.',
    );
  });

  test('Les 10 sections du main sont présentes', async ({ page }) => {
    const sections = page.locator('main > section');
    await expect(sections).toHaveCount(10);
  });

  test('Les liens CTA du hero sont visibles', async ({ page }) => {
    // Target hero CTAs by visible text (not menu overlay links which share the same hrefs)
    const ctaReco = page.getByRole('link', { name: /Trouver ma formule/i });
    const ctaOffres = page.getByRole('link', { name: /Voir les offres/i });
    await expect(ctaReco).toBeVisible();
    await expect(ctaOffres).toBeVisible();
  });

  test('4 liens WhatsApp sont présents', async ({ page }) => {
    const whatsappLinks = page.locator('main a[href*="wa.me"]');
    await expect(whatsappLinks).toHaveCount(4);
  });

  test('Le LevelRouter affiche 5 niveaux', async ({ page }) => {
    const levels = ['Terminale', 'Première', 'Seconde', 'Troisième', 'Candidat libre'];
    for (const level of levels) {
      await expect(page.getByText(level, { exact: true }).first()).toBeVisible();
    }
  });

  test('Les anciens IDs de section n\'existent plus', async ({ page }) => {
    const oldIds = ['#methode', '#pourquoi', '#offres', '#stages', '#candidats', '#enligne', '#contact'];
    for (const id of oldIds) {
      await expect(page.locator(id)).toHaveCount(0);
    }
  });

  test('Clic sur le CTA /offres navigue correctement', async ({ page }) => {
    const ctaOffres = page.getByRole('link', { name: /Voir les offres/i });
    await expect(ctaOffres).toBeVisible();
    await ctaOffres.click();
    await expect(page).toHaveURL(/\/offres/);
    await expect(page.locator('h1')).toContainText(/Offres/i);
  });

  test('Clic sur le CTA /recommandation navigue correctement', async ({ page }) => {
    const ctaReco = page.getByRole('link', { name: /Trouver ma formule/i });
    await expect(ctaReco).toBeVisible();
    await ctaReco.click();
    await expect(page).toHaveURL(/\/recommandation/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('Le logo est visible dans le header', async ({ page }) => {
    const logo = page.locator('header a[href="/"] img');
    await expect(logo.first()).toBeVisible();
  });

  test('Les images ont des attributs alt', async ({ page }) => {
    const images = page.locator('main img');
    const count = await images.count();
    for (let i = 0; i < Math.min(count, 10); i++) {
      await expect(images.nth(i)).toHaveAttribute('alt');
    }
  });

  test('Les liens ont des attributs href', async ({ page }) => {
    const links = page.locator('main a');
    const count = await links.count();
    for (let i = 0; i < Math.min(count, 15); i++) {
      await expect(links.nth(i)).toHaveAttribute('href');
    }
  });

  test('La navigation mobile fonctionne', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const burger = page.locator('button[aria-label="Ouvrir le menu"]');
    await expect(burger).toBeVisible();
    await burger.click();
    await expect(page.locator('nav[aria-label="Menu principal"]')).toBeVisible();
  });

  test('La page se charge en moins de 5 secondes', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(Date.now() - start).toBeLessThan(5000);
  });

  test('Les erreurs 404 sont gérées correctement', async ({ page }) => {
    const response = await page.goto('/page-inexistante');
    expect(response?.status()).toBe(404);
  });
});
