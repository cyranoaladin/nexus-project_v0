import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test.describe('Homepage Mobile (390x844) - Landing candidat libre', () => {
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

  test('pas de scroll horizontal', async ({ page }) => {
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );

    expect(hasHorizontalOverflow, 'Scroll horizontal detecte').toBe(false);
  });

  test('hero mobile cible candidat libre et double cursus', async ({ page }) => {
    await expect(page.locator('.hero-segment')).toHaveText(/CANDIDAT LIBRE\s*DOUBLE CURSUS/);
    await expect(page.getByRole('heading', { name: /bac français sans cadre/i })).toBeVisible();
  });

  test('CTA WhatsApp hero visible dans le premier ecran mobile 390px', async ({ page }) => {
    const heroCTA = page.locator('.hero a[href*="wa.me"]').first();

    await expect(heroCTA, 'CTA WhatsApp absent du hero mobile').toBeVisible();
    const box = await heroCTA.boundingBox();

    expect(box).not.toBeNull();
    expect(box!.y + box!.height, 'CTA hero sous le premier ecran').toBeLessThanOrEqual(844);
    expect(box!.height, 'CTA trop petit pour le touch').toBeGreaterThanOrEqual(44);
  });

  test('preuves rapides visibles dans le hero mobile', async ({ page }) => {
    const priorityBadges = page.locator('.hero .hbadge-priority');

    await expect(priorityBadges.getByText('Cyclades', { exact: true })).toBeVisible();
    await expect(priorityBadges.getByText('Bacs blancs', { exact: true })).toBeVisible();
    await expect(priorityBadges.getByText('Parents', { exact: true })).toBeVisible();
  });

  test('sections principales de conversion sont presentes', async ({ page }) => {
    await expect(page.locator('#methode')).toBeAttached();
    await expect(page.locator('#offres')).toBeAttached();
    await expect(page.locator('#candidats')).toBeAttached();
    await expect(page.locator('#contact')).toBeAttached();
  });

  test('sticky WhatsApp apparait apres scroll et pointe vers wa.me', async ({ page }) => {
    const sticky = page.locator('a.mobile-sticky-wa[href*="wa.me"]');

    await expect(sticky).toBeHidden();
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(250);

    await expect(sticky).toBeVisible();
    await expect(sticky).toHaveAttribute('href', /wa\.me\/21699192829/);
  });

  test('menu mobile ouvre les ancres et se referme apres clic', async ({ page }) => {
    const burger = page.locator('#burger');
    const menu = page.locator('#mobileMenu');

    await expect(burger).toBeVisible();
    await expect(burger).toHaveAttribute('aria-expanded', 'false');

    await burger.click();
    await expect(menu).toHaveClass(/open/);
    await expect(burger).toHaveAttribute('aria-expanded', 'true');

    await menu.getByRole('link', { name: /Candidats libres/i }).click();
    await expect(menu).not.toHaveClass(/open/);
    await expect(burger).toHaveAttribute('aria-expanded', 'false');
  });

  test('tous les liens WhatsApp pointent vers le numero Nexus', async ({ page }) => {
    const links = page.locator('a[href*="wa.me"]');
    const count = await links.count();

    expect(count, 'Aucun lien WhatsApp trouve').toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const href = await links.nth(index).getAttribute('href');
      expect(href).toContain('wa.me/21699192829');
    }
  });
});

test.describe('Homepage responsive - multi-viewport', () => {
  const viewports = [
    { name: 'iPhone SE', width: 320, height: 568 },
    { name: 'iPhone 14', width: 390, height: 844 },
    { name: 'Galaxy S21', width: 430, height: 932 },
    { name: 'iPad', width: 768, height: 1024 },
    { name: 'Desktop', width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    test(`${viewport.name} (${viewport.width}px) - pas de scroll horizontal`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();

      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );

      expect(overflow, `Scroll horizontal sur ${viewport.name}`).toBe(false);
      await context.close();
    });

    test(`${viewport.name} (${viewport.width}px) - CTA WhatsApp hero visible`, async ({
      browser,
    }) => {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
      });
      const page = await context.newPage();

      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      const heroCTA = page.locator('.hero a[href*="wa.me"]').first();
      await expect(heroCTA).toBeVisible();
      await context.close();
    });
  }
});
