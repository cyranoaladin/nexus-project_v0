import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

// ── Navy band screenshots (cropped per band) ──

const NAVY_BANDS = [
  { testId: 'mega-annee', label: 'mega-annee' },
  { testId: 'mega-stages', label: 'mega-stages' },
  { testId: 'mega-surmesure', label: 'mega-surmesure' },
];

for (const vp of VIEWPORTS) {
  for (const band of NAVY_BANDS) {
    test(`screenshot navy band ${band.label} @ ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto('/offres', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);

      const el = page.locator(`[data-testid="${band.testId}"]`);
      await el.screenshot({
        path: `e2e/screenshots/offres-${band.label}-${vp.name}-${vp.width}.png`,
      });

      await ctx.close();
    });
  }
}

// ── Navy bands exist and have correct bg ──

test('3 navy separator bands present with bg-lux-ink', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  for (const testId of ['mega-annee', 'mega-stages', 'mega-surmesure']) {
    const band = page.locator(`[data-testid="${testId}"]`);
    await expect(band).toBeVisible();
    // Verify dark background (navy)
    const bg = await band.evaluate((el) => getComputedStyle(el).backgroundColor);
    // lux-ink should compute to a dark navy — check luminance
    const match = bg.match(/\d+/g);
    if (match) {
      const [r, g, b] = match.map(Number);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      expect(luminance, `${testId} bg is dark`).toBeLessThan(0.25);
    }
  }

  await ctx.close();
});

// ── Contrast AA on navy bands ──

test('navy band text meets AA contrast', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  for (const testId of ['mega-annee', 'mega-stages', 'mega-surmesure']) {
    const band = page.locator(`[data-testid="${testId}"]`);
    // Check h2 color is light (lux-ivory)
    const h2Color = await band.locator('h2').evaluate((el) => getComputedStyle(el).color);
    const match = h2Color.match(/\d+/g);
    if (match) {
      const [r, g, b] = match.map(Number);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      expect(luminance, `${testId} h2 text is light`).toBeGreaterThan(0.8);
    }
  }

  await ctx.close();
});

// ── Paper/white alternation ──

test('sections alternate bg-lux-paper and bg-lux-white', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Mega 1: annual=white, libre=paper, plateforme=white
  const annual = page.locator('[data-testid="section-annual"]');
  const libre = page.locator('[data-testid="section-libre"]');
  const plateforme = page.locator('[data-testid="section-plateforme"]');

  const annualBg = await annual.evaluate((el) => getComputedStyle(el).backgroundColor);
  const libreBg = await libre.evaluate((el) => getComputedStyle(el).backgroundColor);
  const platformeBg = await plateforme.evaluate((el) => getComputedStyle(el).backgroundColor);

  // They should alternate (not all the same)
  expect(annualBg, 'annual != libre bg').not.toBe(libreBg);
  expect(libreBg, 'libre != plateforme bg').not.toBe(platformeBg);

  // Mega 2: intensifs=white, ponctuel=paper
  const intensifs = page.locator('[data-testid="section-intensifs"]');
  const ponctuel = page.locator('[data-testid="section-ponctuel"]');
  const intensifsBg = await intensifs.evaluate((el) => getComputedStyle(el).backgroundColor);
  const ponctuelBg = await ponctuel.evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(intensifsBg, 'intensifs != ponctuel bg').not.toBe(ponctuelBg);

  await ctx.close();
});

// ── Filter still works with mega layout ──

for (const vp of VIEWPORTS) {
  test(`filter works correctly @ ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/offres', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Click "Parcours annuels" filter
    await page.getByRole('button', { name: 'Parcours annuels' }).click();
    await page.waitForTimeout(500);

    // Annual section visible
    await expect(page.locator('[data-testid="section-annual"]')).toBeVisible();
    // Mega-annee band visible
    await expect(page.locator('[data-testid="mega-annee"]')).toBeVisible();
    // Other mega bands hidden
    await expect(page.locator('[data-testid="mega-stages"]')).toBeHidden();
    await expect(page.locator('[data-testid="mega-surmesure"]')).toBeHidden();
    // Libre section hidden (different filter)
    await expect(page.locator('[data-testid="section-libre"]')).toBeHidden();

    // Click "Les Intensifs" filter
    await page.getByRole('button', { name: 'Les Intensifs' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="mega-stages"]')).toBeVisible();
    await expect(page.locator('[data-testid="section-intensifs"]')).toBeVisible();
    await expect(page.locator('[data-testid="mega-annee"]')).toBeHidden();

    // Click "Tout voir" to restore
    await page.getByRole('button', { name: 'Tout voir' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('[data-testid="mega-annee"]')).toBeVisible();
    await expect(page.locator('[data-testid="mega-stages"]')).toBeVisible();
    await expect(page.locator('[data-testid="mega-surmesure"]')).toBeVisible();

    await ctx.close();
  });
}

// ── No overflow at 375/768/1280 ──

for (const vp of VIEWPORTS) {
  test(`no horizontal overflow @ ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/offres', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow, 'no horizontal overflow').toBe(false);

    await ctx.close();
  });
}
