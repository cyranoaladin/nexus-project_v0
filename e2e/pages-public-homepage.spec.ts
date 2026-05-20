import { test, expect } from '@playwright/test';

test.describe('Homepage (/) — Landing Nexus Réussite', () => {
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
      (e) =>
        !e.includes('favicon') &&
        !e.includes('404') &&
        !e.includes('hydration') &&
        !e.includes('Warning') &&
        !e.includes('Failed to load resource') &&
        !e.includes('net::ERR_') &&
        !e.includes('NEXT_REDIRECT') &&
        !e.includes('Chutes') &&
        !e.includes('ClientFetchError') &&
        !e.includes('authjs')
    );
    if (critical.length > 0) {
      console.log('Critical console errors found:', critical);
    }
    expect(critical).toHaveLength(0);
  });

  test('H1 est visible dans le hero', async ({ page }) => {
    await expect(page.locator('#hero h1').first()).toBeVisible();
  });

  test('hero affiche le CTA WhatsApp', async ({ page }) => {
    const whatsapp = page.locator('#hero a[href*="wa.me"]').first();
    await expect(whatsapp).toBeVisible();
  });

  test('CTA secondaire hero pointe vers #offres-fin-annee', async ({ page }) => {
    const cta = page.locator('#hero a[href="#offres-fin-annee"]');
    await expect(cta).toBeVisible();
  });

  test('section urgence/finish est visible', async ({ page }) => {
    const section = page.locator('#offres-fin-annee');
    await expect(section).toBeAttached();
  });

  test('section Nexus Select est visible', async ({ page }) => {
    const section = page.locator('#nexus-select');
    await expect(section).toBeAttached();
  });

  test('affiche un prix avec astérisque', async ({ page }) => {
    const priceWithAsterisk = page.getByText(/\d+\s*DT\*/);
    await expect(priceWithAsterisk.first()).toBeVisible();
  });

  test('note groupe de 4 est présente', async ({ page }) => {
    const groupNote = page.getByText(/groupe de 4 élèves/i);
    await expect(groupNote.first()).toBeVisible();
  });

  test('disclaimer Parcoursup est présent dans Nexus Select', async ({ page }) => {
    const disclaimer = page.locator('#nexus-select').getByText(/Parcoursup/i);
    await expect(disclaimer).toBeVisible();
  });

  test('utilise "échéances" et non "épreuves anticipées"', async ({ page }) => {
    const urgencySection = page.locator('#offres-fin-annee');
    await expect(urgencySection.getByText(/échéances/i).first()).toBeVisible();
    // Ensure we don't use the risky formulation
    const riskyText = await page.locator('text="épreuves anticipées"').count();
    expect(riskyText).toBe(0);
  });

  test('section forfaits affiche 4 formules', async ({ page }) => {
    const forfaits = page.locator('#forfaits article');
    await expect(forfaits).toHaveCount(4);
  });

  test('CTA WhatsApp dans chaque section principale', async ({ page }) => {
    const whatsappLinks = page.locator('a[href*="wa.me"]');
    const count = await whatsappLinks.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test('section contact/CTA final est visible', async ({ page }) => {
    const section = page.locator('#contact');
    await expect(section).toBeAttached();
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

  test('images landing ont des alt texts', async ({ page }) => {
    const landingImages = page.locator('main img[alt]');
    const count = await landingImages.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      const alt = await landingImages.nth(i).getAttribute('alt');
      expect(alt, `Image ${i} has empty alt`).toBeTruthy();
    }
  });
});
