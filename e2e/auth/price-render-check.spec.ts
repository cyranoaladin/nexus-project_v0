import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * DOM-level price render check — reads RENDERED pages and asserts
 * canonical prices appear in the DOM.
 */

const canonicalPath = path.join(__dirname, '../../data/pricing.canonical.json');
const data = JSON.parse(fs.readFileSync(canonicalPath, 'utf8'));

const pricedOffers = data.offers.filter((o: any) => o.price_annual != null);
// /stages renders stage_calendar entries, each with a format price from stage_formats
// The calendar entries reference format_id; the rendered price comes from stage_formats
const calendarFormatIds: string[] = [...new Set(data.stage_calendar.map((c: any) => c.format_id))] as string[];
const calendarPrices = calendarFormatIds
  .map((fid) => data.stage_formats.find((f: any) => f.format_id === fid))
  .filter(Boolean)
  .map((f: any) => ({ format_id: f.format_id, price: f.price_per_student }));

test.describe('Price render check — DOM vs canonical', () => {
  test('/offres renders every annual offer price in the DOM', async ({ page }) => {
    await page.goto('/offres', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const body = await page.locator('body').innerText();

    let found = 0;
    const missing: string[] = [];
    for (const o of pricedOffers) {
      const price = String(o.price_annual);
      const priceFr = o.price_annual.toLocaleString('fr-FR');
      if (body.includes(price) || body.includes(priceFr) || body.includes(priceFr.replace(/\u00A0/g, ' '))) {
        found++;
      } else {
        missing.push(`${o.id}: ${price}`);
      }
    }

    if (missing.length > 0) {
      console.log('Missing prices on /offres:', missing);
    }
    expect(found).toBe(pricedOffers.length);
  });

  test('/offres shows group <= 5 mention', async ({ page }) => {
    await page.goto('/offres', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/5 max|5 élèves|groupe de 5/i).first()).toBeVisible();
  });

  test('/offres has zero line-through pricing elements', async ({ page }) => {
    await page.goto('/offres', { waitUntil: 'domcontentloaded' });
    const lineThrough = await page.locator('.line-through').count();
    expect(lineThrough).toBe(0);
  });

  test('/stages renders every calendar-assigned format price (innerText)', async ({ page }) => {
    await page.goto('/stages', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const text = await page.locator('body').innerText();

    let found = 0;
    const missing: string[] = [];
    for (const cp of calendarPrices) {
      const plain = String(cp.price);
      const frFR = cp.price.toLocaleString('fr-FR');
      // innerText may use non-breaking space (U+00A0) from toLocaleString
      if (text.includes(plain) || text.includes(frFR) || text.includes(frFR.replace(/\u00A0/g, ' '))) {
        found++;
      } else {
        missing.push(`${cp.format_id}: ${cp.price}`);
      }
    }

    if (missing.length > 0) {
      console.log('Missing calendar format prices on /stages (innerText):', missing);
    }
    // Every format assigned to a calendar period must have its price visible
    expect(found).toBe(calendarPrices.length);
  });

  test('/stages has zero line-through elements', async ({ page }) => {
    await page.goto('/stages', { waitUntil: 'domcontentloaded' });
    const lineThrough = await page.locator('.line-through').count();
    expect(lineThrough).toBe(0);
  });

  test('/stages shows group <= 5', async ({ page }) => {
    await page.goto('/stages', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/5 max|5 élèves|groupe de 5/i).first()).toBeVisible();
  });

  // ── Homepage ──

  // ── Homepage findings ──

  test('homepage shows "TND" currency label', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const text = await page.locator('body').innerText();
    expect(text).toContain('TND');
  });

  // FINDING: homepage reperes tarifaires prix numeriques are client-rendered
  // and do NOT appear in innerText even after full hydration (3s wait + load).
  // The "TND" label appears but not the numerical values (240, 270, 390...).
  // The Nexus Select price (1800) is also absent from visible text.
  // Decision required: are prices intentionally hidden on homepage?

  // FINDING: /recommandation wizard completes but shows offer cards WITHOUT
  // any price in the visible text. TND is absent from the results.
  // The recommendation-engine.ts derives prices from canonical but ExamCard
  // does not render them in the recommendation context.
  // Decision required: should recommended offers show their price?

  // Dashboard dialogs (aria-addon, subscription-change) are verified by
  // data-coherence.test.ts (data-layer, gated by role).

  // Note: Dashboard dialogs (aria-addon, subscription-change) are verified
  // by unit tests in data-coherence.test.ts (data-layer, not DOM) since they
  // require authenticated sessions and derive from the same canonical source.
});
