import { test, expect } from '@playwright/test';
import { getAnnualOfferPricing } from '@/lib/pricing-client';
import pricingCanonical from '../../data/pricing.canonical.json';

const candidatsLibres2027 = (pricingCanonical as any).candidats_libres_2027;

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

// ── Per-card cropped screenshots at each viewport ──

const CARD_SCREENSHOTS = [
  { id: 'term-spe-simple', label: 'annual-scolarise' },
  { id: 'intensif-solo', label: 'one-shot-stage' },
];

function annualOffer(id: string) {
  const offer = getAnnualOfferPricing(id);
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

// ── Annual scolarisé card: installment-first, SANS ACOMPTE, real canonical échéancier ──
// Commercial decision 2026-09-05: the 22 "Accompagnement annuel — scolarisés"
// offers dropped their 30% acompte — 9 mensualités now recompose the exact
// unchanged annual price (see data/pricing.canonical.json, offer.deposit: 0).
test('annual scolarisé shows installment-first, sans acompte, annual secondary, échéancier', async ({ browser }) => {
  const offer = annualOffer('term-spe-simple');
  expect(offer.deposit, 'scolarisé annual offers are sans acompte since 2026-09-05').toBe(0);
  expect(offer.n_installments, 'scolarisé annual offers keep 9 installments').toBe(9);

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  const card = page.locator('#term-spe-simple');

  // Primary price: canonical installment amount, not legacy price_annual / 9.
  const primary = card.locator('[data-testid="price-primary"]');
  const primaryText = await primary.textContent();
  expect(digitsText(primaryText), 'primary shows installment amount').toContain(String(offer.installment_amount));
  expect(primaryText, 'primary has TND').toContain('TND');

  // Secondary: states no acompte explicitly, shows installments + total annual.
  const secondary = card.locator('[data-testid="price-secondary"]');
  await expect(secondary).toBeVisible();
  const secText = await secondary.textContent();
  expect(secText, 'secondary states no acompte').toMatch(/pas d.?acompte/i);
  const secDigits = digitsText(secText);
  expect(secDigits, 'secondary shows installment amount').toContain(String(offer.installment_amount));
  expect(secDigits, 'secondary shows last installment').toContain(String(offer.last_installment));
  expect(secDigits, 'secondary shows annual').toContain(String(offer.price_annual));
  expect(secText, 'secondary shows /an').toMatch(/\/\s*an/);

  // term-spe-simple's last installment (436) differs from the regular one
  // (433) — the label must say so plainly, never "mensualités identiques"
  // while also stating a different "dernière à" value (self-contradictory
  // bug found after the initial sans-acompte pricing refonte).
  expect(offer.installment_amount, 'fixture assumption: last differs from regular').not.toBe(offer.last_installment);
  expect(secText, 'secondary never claims "identiques" when the last installment differs').not.toMatch(/mensualités identiques/i);
  expect(secText, 'secondary states the differing last installment').toMatch(/dernière à/i);

  // Has /mois in pricing block, WITHOUT "hors acompte" (there is no acompte to be "hors" of).
  const pricingBlock = card.locator('[data-testid="pricing-block"]');
  const pricingText = await pricingBlock.textContent();
  expect(pricingText, 'scolarisé has /mois').toMatch(/\/\s*mois/);
  expect(pricingText, 'scolarisé never shows "hors acompte"').not.toMatch(/hors acompte/);

  // Échéancier shows NO acompte row at all (sans acompte means nothing to
  // render — not an "Aucun" placeholder), but installments remain visible.
  const echeancier = card.locator('[data-testid="echeancier-acompte"]');
  await expect(echeancier).toHaveCount(0);
  const mensualites = card.locator('[data-testid="echeancier-mensualites"]');
  await expect(mensualites).toBeVisible();

  await ctx.close();
});

// ── Uniform annual scolarisé (2700 = 9 × 300, no rounding remainder): the
// label MUST say "mensualités identiques" here — the negative case above
// (term-spe-simple) only proves the non-uniform wording; this proves the
// uniform wording is still correctly reached when it's actually true.
test('uniform annual scolarisé (9 × 300) says "mensualités identiques"', async ({ browser }) => {
  const offer = annualOffer('2nde-maths');
  expect(offer.installment_amount, 'fixture assumption: perfectly uniform offer').toBe(offer.last_installment);

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Attribute selector, not `#2nde-maths` — CSS ID selectors can't start
  // with a digit without escaping, and this offer id does.
  const card = page.locator('[id="2nde-maths"]');
  const secondary = card.locator('[data-testid="price-secondary"]');
  await expect(secondary).toBeVisible();
  const secText = await secondary.textContent();
  expect(secText, 'uniform offer says "mensualités identiques"').toMatch(/mensualités identiques/i);
  expect(secText, 'uniform offer states no acompte').toMatch(/pas d.?acompte/i);
  expect(secText, 'uniform offer never states a differing last installment').not.toMatch(/dernière à/i);

  await ctx.close();
});

// ── Candidats libres 2026-2027 : mensualité en premier, sans acompte (bloc candidats_libres_2027) ──
test('candidat libre (session 2027) shows installment-first, no acompte', async ({ browser }) => {
  const terminale = candidatsLibres2027.parcours.find((p: { id: string }) => p.id === 'terminale');

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });

  const card = page.getByTestId('section-libre').getByRole('article', { name: /Terminale/ });
  await expect(card).toBeVisible();
  const text = (await card.textContent()) ?? '';
  expect(digitsText(text), 'mensualité affichée').toContain(String(terminale.echeancier_9.mensualite));
  expect(digitsText(text), 'total annuel affiché').toContain(String(terminale.prix_annuel));
  expect(text, 'mensualité par mois').toMatch(/\/\s*mois/);
  expect(text, '9 mensualités').toMatch(/9 mensualités/);
  expect(text, 'aucun acompte').not.toMatch(/acompte/i);

  await ctx.close();
});

// ── ARIA : plus vendue seule sur /offres (décision D11) ──
test('ARIA plateforme is no longer sold on /offres', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('/offres', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="section-plateforme"]')).toHaveCount(0);
  await expect(page.locator('#plateforme-autonomie, #plateforme-suivi, #plateforme-accomp')).toHaveCount(0);
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
  expect(digitsText(homeText), 'home has canonical installment amount').toContain(String(offer.installment_amount));
  expect(digitsText(offresMonthly), 'offres has canonical installment amount').toContain(String(offer.installment_amount));

  await ctx.close();
});

