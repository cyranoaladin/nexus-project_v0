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

  test('H1 est visible dans le hero', async ({ page }) => {
    await expect(page.locator('.hero h1').first()).toBeVisible();
  });

  test('hero affiche le CTA WhatsApp', async ({ page }) => {
    await expect(page.locator('.hero a[href*="wa.me"]').first()).toBeVisible();
  });

  test('CTA secondaire hero pointe vers la methode', async ({ page }) => {
    await expect(page.locator('.hero a[href="#methode"]').first()).toBeVisible();
  });

  test('sections principales sont presentes', async ({ page }) => {
    await expect(page.locator('#methode')).toBeAttached();
    await expect(page.locator('#pourquoi')).toBeAttached();
    await expect(page.locator('#offres')).toBeAttached();
    await expect(page.locator('#stages')).toBeAttached();
    await expect(page.locator('#candidats')).toBeAttached();
    await expect(page.locator('#enligne')).toBeAttached();
    await expect(page.locator('#contact')).toBeAttached();
  });

  test('CTA WhatsApp dans les sections principales', async ({ page }) => {
    const whatsappLinks = page.locator('a[href*="wa.me"]');
    const count = await whatsappLinks.count();

    expect(count).toBeGreaterThanOrEqual(6);
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
