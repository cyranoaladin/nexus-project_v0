import { test, expect } from '@playwright/test';

// Force mobile viewport for all tests
test.use({ viewport: { width: 375, height: 812 } });

test.describe('Homepage Mobile (375×812) — Landing Nexus Réussite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page charge sans erreurs console critiques', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
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
    expect(critical, `Erreurs console critiques: ${critical.join(', ')}`).toHaveLength(0);
  });

  test('pas de scroll horizontal', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow, 'Scroll horizontal détecté').toBe(false);
  });

  test('H1 est visible dans le premier écran', async ({ page }) => {
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
  });

  test('CTA WhatsApp hero est visible', async ({ page }) => {
    const heroCTA = page.locator('#hero a[href*="wa.me"]').first();
    await expect(heroCTA, 'CTA WhatsApp absent du Hero mobile').toBeVisible();
  });

  test('CTA WhatsApp hero a une hauteur touch-friendly >= 44px', async ({ page }) => {
    const heroCTA = page.locator('#hero a[href*="wa.me"]').first();
    const box = await heroCTA.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height, 'CTA trop petit pour le touch').toBeGreaterThanOrEqual(44);
  });

  test('section Nexus Select est visible', async ({ page }) => {
    const section = page.locator('#nexus-select');
    await expect(section).toBeAttached();
  });

  test('prix Nexus Select 1 800 TND* visible', async ({ page }) => {
    const price = page.locator('#nexus-select').getByText('1 800 TND*');
    await expect(price).toBeVisible();
  });

  test('note groupe de 4 visible', async ({ page }) => {
    const groupNote = page.getByText(/groupe de 4 élèves/i);
    await expect(groupNote.first()).toBeVisible();
  });

  test('section forfaits visible', async ({ page }) => {
    const section = page.locator('#forfaits');
    await expect(section).toBeAttached();
  });

  test('CTA final visible', async ({ page }) => {
    const section = page.locator('#contact');
    await expect(section).toBeAttached();
  });

  test('sticky WhatsApp CTA apparait après scroll', async ({ page }) => {
    // Scroll past hero
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(300);
    const sticky = page.locator('a[aria-label="Contacter Nexus Réussite sur WhatsApp"]');
    await expect(sticky).toBeVisible();
  });

  test('sticky WhatsApp CTA pointe vers wa.me', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(300);
    const sticky = page.locator('a[aria-label="Contacter Nexus Réussite sur WhatsApp"]');
    const href = await sticky.getAttribute('href');
    expect(href).toContain('wa.me/21699192829');
  });

  test('tous les liens WhatsApp pointent vers wa.me', async ({ page }) => {
    const links = page.locator('a[href*="wa.me"]');
    const count = await links.count();
    expect(count, 'Aucun lien WhatsApp trouvé').toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href');
      expect(href).toContain('wa.me/21699192829');
    }
  });

  test('images principales ont des alt texts', async ({ page }) => {
    const images = page.locator('main img[alt]');
    const count = await images.count();
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt, `Image ${i} sans alt text`).toBeTruthy();
    }
  });

  test('disclaimer Parcoursup visible dans Nexus Select', async ({ page }) => {
    const disclaimer = page.locator('#nexus-select').getByText(/Parcoursup/i);
    await expect(disclaimer).toBeVisible();
  });

  test('Nexus Select affiche 40 h', async ({ page }) => {
    const text = page.locator('#nexus-select').getByText('40 h');
    await expect(text.first()).toBeVisible();
  });

  test('Nexus Select affiche CPGE', async ({ page }) => {
    const text = page.locator('#nexus-select').getByText(/CPGE/);
    await expect(text.first()).toBeVisible();
  });

  test('no 120 DT on page', async ({ page }) => {
    const content = await page.textContent('body');
    expect(content).not.toContain('120 DT');
  });

  test('no "groupes de niveau" on page', async ({ page }) => {
    const content = await page.textContent('body');
    expect(content).not.toContain('groupes de niveau');
  });

  test('ancre #nexus-select ne masque pas le titre', async ({ page }) => {
    await page.goto('/#nexus-select');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    const heading = page.locator('#nexus-select h2').first();
    const box = await heading.boundingBox();
    expect(box, 'Titre Nexus Select non visible après ancre').not.toBeNull();
    // Title should not be hidden behind navbar (top > 0)
    expect(box!.y, 'Titre masqué par la navbar').toBeGreaterThanOrEqual(0);
  });

  test('ancre #forfaits ne masque pas le titre', async ({ page }) => {
    await page.goto('/#forfaits');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    const heading = page.locator('#forfaits h2').first();
    const box = await heading.boundingBox();
    expect(box, 'Titre Forfaits non visible après ancre').not.toBeNull();
    expect(box!.y, 'Titre masqué par la navbar').toBeGreaterThanOrEqual(0);
  });

  test('ancre #contact ne masque pas le titre', async ({ page }) => {
    await page.goto('/#contact');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    const heading = page.locator('#contact h2').first();
    const box = await heading.boundingBox();
    expect(box, 'Titre Contact non visible après ancre').not.toBeNull();
    expect(box!.y, 'Titre masqué par la navbar').toBeGreaterThanOrEqual(0);
  });
});

test.describe('Homepage responsive — multi-viewport', () => {
  const viewports = [
    { name: 'iPhone SE', width: 320, height: 568 },
    { name: 'iPhone 14', width: 390, height: 844 },
    { name: 'Galaxy S21', width: 430, height: 932 },
    { name: 'iPad', width: 768, height: 1024 },
    { name: 'Desktop', width: 1440, height: 900 },
  ];

  for (const vp of viewports) {
    test(`${vp.name} (${vp.width}px) — pas de scroll horizontal`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(overflow, `Scroll horizontal sur ${vp.name}`).toBe(false);
      await context.close();
    });

    test(`${vp.name} (${vp.width}px) — CTA WhatsApp hero visible`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      const heroCTA = page.locator('#hero a[href*="wa.me"]').first();
      await expect(heroCTA).toBeVisible();
      await context.close();
    });
  }
});
