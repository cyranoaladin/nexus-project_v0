import { expect, test } from '@playwright/test';

test.describe('Homepage (/) - Landing Nexus Reussite', () => {
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
      (error) =>
        !error.includes('favicon') &&
        !error.includes('404') &&
        !error.includes('hydration') &&
        !error.includes('Warning') &&
        !error.includes('Failed to load resource') &&
        !error.includes('net::ERR_') &&
        !error.includes('NEXT_REDIRECT') &&
        !error.includes('ClientFetchError') &&
        !error.includes('authjs')
    );

    expect(critical, `Erreurs console critiques: ${critical.join(', ')}`).toHaveLength(0);
  });

  test('H1 est visible et contient le texte exact', async ({ page }) => {
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Préparer le bac français avec méthode, suivi et exigence.');
  });

  test('hero CTA principal pointe vers /recommandation', async ({ page }) => {
    await expect(page.locator('section a[href="/recommandation"]').first()).toBeVisible();
  });

  test('hero CTA secondaire pointe vers /offres', async ({ page }) => {
    await expect(page.locator('section a[href="/offres"]').first()).toBeVisible();
  });

  test('10 sections principales dans <main>', async ({ page }) => {
    const sections = page.locator('main > section');
    await expect(sections).toHaveCount(10);
  });

  test('exactement 4 liens WhatsApp sur la page', async ({ page }) => {
    const waLinks = page.locator('a[href*="wa.me"]');
    await expect(waLinks).toHaveCount(4);
  });

  test('tous les liens footer internes ne retournent pas 404', async ({ page }) => {
    const footerLinks = page.locator('footer a[href^="/"]');
    const count = await footerLinks.count();

    for (let index = 0; index < Math.min(count, 15); index += 1) {
      const href = await footerLinks.nth(index).getAttribute('href');
      if (href) {
        const response = await page.request.get(href);
        expect(response.status(), `Footer link ${href} returned ${response.status()}`).not.toBe(404);
      }
    }
  });

  test('images landing ont des alt texts', async ({ page }) => {
    const landingImages = page.locator('img[alt]');
    const count = await landingImages.count();

    expect(count).toBeGreaterThanOrEqual(1);

    for (let index = 0; index < count; index += 1) {
      const alt = await landingImages.nth(index).getAttribute('alt');
      expect(alt, `Image ${index} has empty alt`).toBeTruthy();
    }
  });
});
