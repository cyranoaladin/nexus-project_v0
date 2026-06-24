import { test, expect } from '@playwright/test';
import { getAnnualOffer } from '@/lib/pricing';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

// ── Per-card cropped screenshots at each viewport ──

const CARD_SCREENSHOTS = [
  { id: 'term-spe-simple', label: 'annual-scolarise' },
  { id: 'intensif-solo', label: 'one-shot-stage' },
  { id: 'plateforme-autonomie', label: 'aria-annual' },
];

function annualOffer(id: string) {
  const offer = getAnnualOffer(id);
  if (!offer) {
    throw new Error(`Missing annual offer ${id}`);
  }
  return offer;
}

function digitsText(text: string | null) {
  return (text ?? '').replace(/[^\d]/g, '');
}

for (const vp of VIEWPORTS) {
  for (const card of CARD_SCREENSHOTS) {
    test(`screenshot ${card.label} @ ${vp.name}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      await page.goto('/offres', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);

      const wrapper = page.locator(`#${card.id}`);
      const cardEl = wrapper.locator('[class*="@container"]');
      await cardEl.screenshot({
        path: `e2e/screenshots/${card.label}-${vp.name}-${vp.width}.png`,
      });

      await ctx.close();
    });
  }
}

// ── Annual scolarisé card: installment-first + real canonical échéancier ──
test('annual scolarisé shows installment-first, annual secondary, échéancier', async ({ browser }) => {
  const offer = annualOffer('term-spe-simple');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const card = page.locator('#term-spe-simple');

  // Primary price: canonical installment amount, not legacy price_annual / 10.
  const primary = card.locator('[data-testid="price-primary"]');
  const primaryText = await primary.textContent();
  expect(primaryText, 'primary shows installment amount').toContain(String(offer.installment_amount));
  expect(primaryText, 'primary has TND').toContain('TND');

  // Secondary: real deposit + installments + total annual.
  const secondary = card.locator('[data-testid="price-secondary"]');
  await expect(secondary).toBeVisible();
  const secText = await secondary.textContent();
  const secDigits = digitsText(secText);
  expect(secDigits, 'secondary shows deposit').toContain(String(offer.deposit));
  expect(secDigits, 'secondary shows installment amount').toContain(String(offer.installment_amount));
  expect(secDigits, 'secondary shows last installment').toContain(String(offer.last_installment));
  expect(secDigits, 'secondary shows annual').toContain(String(offer.price_annual));
  expect(secText, 'secondary shows /an').toMatch(/\/\s*an/);

  // Has /mois in pricing block
  const pricingBlock = card.locator('[data-testid="pricing-block"]');
  const pricingText = await pricingBlock.textContent();
  expect(pricingText, 'scolarisé has /mois').toMatch(/\/\s*mois/);

  // Échéancier still present
  const echeancier = card.locator('[data-testid="echeancier-acompte"]');
  await expect(echeancier).toBeVisible();
  const mensualites = card.locator('[data-testid="echeancier-mensualites"]');
  await expect(mensualites).toBeVisible();

  await ctx.close();
});

// ── Candidat libre: also installment-first ──
test('candidat libre shows installment-first', async ({ browser }) => {
  const offer = annualOffer('term-libre-online');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const card = page.locator('#term-libre-online');

  // Primary price: canonical installment amount, not legacy price_annual / 10.
  const primary = card.locator('[data-testid="price-primary"]');
  const primaryText = await primary.textContent();
  expect(primaryText, 'libre primary shows installment amount').toContain(String(offer.installment_amount));
  expect(primaryText, 'libre primary has TND').toContain('TND');

  // Has /mois in pricing block
  const pricingBlock = card.locator('[data-testid="pricing-block"]');
  const pricingText = await pricingBlock.textContent();
  expect(pricingText, 'libre has /mois').toMatch(/\/\s*mois/);

  // Secondary present
  const secondary = card.locator('[data-testid="price-secondary"]');
  await expect(secondary).toBeVisible();
  const secondaryText = await secondary.textContent();
  const secondaryDigits = digitsText(secondaryText);
  expect(secondaryDigits, 'libre secondary shows deposit').toContain(String(offer.deposit));
  expect(secondaryDigits, 'libre secondary shows annual').toContain(String(offer.price_annual));

  await ctx.close();
});

// ── ARIA plateforme: annual display, NO /mois ──
test('ARIA plateforme shows annual, no /mois', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Test all 3 ARIA tiers — match full normalized price (strip whitespace → compare digits)
  for (const { id, annualPrice } of [
    { id: 'plateforme-autonomie', annualPrice: 590 },
    { id: 'plateforme-suivi', annualPrice: 1490 },
    { id: 'plateforme-accomp', annualPrice: 2900 },
  ]) {
    const card = page.locator(`#${id}`);
    const pricingBlock = card.locator('[data-testid="pricing-block"]');
    const pricingText = await pricingBlock.textContent();

    // Shows /an (with any whitespace before "an")
    expect(pricingText, `${id} shows /an`).toMatch(/\/\s*an/);
    // Does NOT show /mois
    expect(pricingText, `${id} no /mois`).not.toMatch(/\/\s*mois/);
    // No secondary line
    const secondary = card.locator('[data-testid="price-secondary"]');
    await expect(secondary).toHaveCount(0);
    // Full price match: strip all whitespace from primary, extract digits before TND
    const primary = card.locator('[data-testid="price-primary"]');
    const primaryText = await primary.textContent();
    const digits = (primaryText ?? '').replace(/\s/g, '').match(/^(\d+)TND/);
    expect(digits, `${id} primary matches "XTND" pattern`).not.toBeNull();
    expect(Number(digits![1]), `${id} exact annual price`).toBe(annualPrice);
  }

  await ctx.close();
});

// ── One-shot card (stage): NO /mois, NO /an ──
test('one-shot offer shows total only, no /mois no /an', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const card = page.locator('#intensif-solo');

  const primary = card.locator('[data-testid="price-primary"]');
  const primaryText = await primary.textContent();
  expect(primaryText, 'one-shot shows total TND').toContain('TND');

  const secondary = card.locator('[data-testid="price-secondary"]');
  await expect(secondary).toHaveCount(0);

  const pricingBlock = card.locator('[data-testid="pricing-block"]');
  const pricingText = await pricingBlock.textContent();
  expect(pricingText, 'no /mois for one-shot').not.toContain('/mois');
  expect(pricingText, 'no /an for one-shot').not.toContain('/an');

  await ctx.close();
});

// ── Consistency: installment on /offres == installment on home (same canonical source) ──
test('installment display on /offres matches home repères', async ({ browser }) => {
  const offer = annualOffer('term-spe-simple');
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

  // Both should contain the canonical installment amount.
  expect(homeText, 'home has canonical installment amount').toContain(String(offer.installment_amount));
  expect(offresMonthly, 'offres has canonical installment amount').toContain(String(offer.installment_amount));

  await ctx.close();
});

// ── Consistency: ARIA annual on /offres == home repère "590 TND / an" ──
test('ARIA annual on /offres matches home repère', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  // Home repère for "Plateforme ARIA" — look for the repère card containing both label and price
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const homeText = await page.evaluate(() => {
    // The repères section renders cards with rounded-xl containing both label and lux-price
    const cards = document.querySelectorAll('[class*="rounded-xl"]');
    for (const c of cards) {
      const text = c.textContent || '';
      if (text.includes('Plateforme ARIA') && text.includes('TND')) {
        return text;
      }
    }
    return '';
  });

  // /offres ARIA card
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const offresAria = await page.locator('#plateforme-autonomie').locator('[data-testid="price-primary"]').textContent();

  // Both show 590
  expect(homeText, 'home has 590').toContain('590');
  expect(offresAria, 'offres ARIA has 590').toContain('590');

  await ctx.close();
});
