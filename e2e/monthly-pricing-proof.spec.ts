import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

// ── Screenshots ──
for (const vp of VIEWPORTS) {
  test(`offres monthly pricing @ ${vp.name}`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto('/offres', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `e2e/screenshots/offres-lotD-${vp.name}-${vp.width}.png`, fullPage: true });
    await ctx.close();
  });
}

// ── Annual card: monthly-first + "soit …/an" + échéancier ──
test('annual offer shows monthly-first, annual secondary, échéancier', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Find first annual card (term-spe-simple) — the id is on a wrapper div containing the ExamCard
  const card = page.locator('#term-spe-simple');

  // Primary price: monthly (390 TND / mois)
  const primary = card.locator('[data-testid="price-primary"]');
  const primaryText = await primary.textContent();
  expect(primaryText, 'primary shows monthly').toContain('390');
  expect(primaryText, 'primary has TND').toContain('TND');

  // Secondary: "soit 3 900 TND / an"
  const secondary = card.locator('[data-testid="price-secondary"]');
  await expect(secondary).toBeVisible();
  const secText = await secondary.textContent();
  expect(secText, 'secondary shows annual').toContain('3');
  expect(secText, 'secondary shows /an').toContain('/\u00A0an');

  // Échéancier still present
  const echeancier = card.locator('[data-testid="echeancier-acompte"]');
  await expect(echeancier).toBeVisible();
  const acompteValue = card.locator('[data-testid="echeancier-acompte-value"]');
  const acompteText = await acompteValue.textContent();
  expect(acompteText, 'acompte shown').toContain('1');

  // Mensualités present
  const mensualites = card.locator('[data-testid="echeancier-mensualites"]');
  await expect(mensualites).toBeVisible();

  // Screenshot closeup of this card
  const cardEl = card.locator('[class*="@container"]');
  await cardEl.screenshot({ path: 'e2e/screenshots/offres-annual-card-closeup.png' });

  await ctx.close();
});

// ── One-shot card: NO /mois ──
test('one-shot offer shows total only, no /mois', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Find a stage format card (intensif-solo)
  const card = page.locator('#intensif-solo');

  // Primary price: total (no /mois)
  const primary = card.locator('[data-testid="price-primary"]');
  const primaryText = await primary.textContent();
  expect(primaryText, 'one-shot shows total TND').toContain('TND');

  // No secondary price line
  const secondary = card.locator('[data-testid="price-secondary"]');
  await expect(secondary).toHaveCount(0);

  // No "/mois" anywhere in the pricing block
  const pricingBlock = card.locator('[data-testid="pricing-block"]');
  const pricingText = await pricingBlock.textContent();
  expect(pricingText, 'no /mois for one-shot').not.toContain('/mois');
  expect(pricingText, 'no /an for one-shot').not.toContain('/an');

  await ctx.close();
});

// ── Consistency: monthly on /offres == monthly on home (same canonical source) ──
test('monthly display on /offres matches home repères', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Get home repère for "Spécialité simple"
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const homeText = await page.evaluate(() => {
    const cards = document.querySelectorAll('[class*="rounded-xl"]');
    for (const c of cards) {
      if (c.textContent?.includes('Spécialité simple')) {
        return c.textContent;
      }
    }
    return '';
  });

  // Get /offres monthly for term-spe-simple
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const offresMonthly = await page.locator('#term-spe-simple').locator('[data-testid="price-primary"]').textContent();

  // Both should contain "390"
  expect(homeText, 'home has 390').toContain('390');
  expect(offresMonthly, 'offres has 390').toContain('390');

  await ctx.close();
});
