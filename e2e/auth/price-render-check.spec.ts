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
// /stages renders composite pack prices (from composite_stage_packs), not individual format prices
const compositePacks = data.composite_stage_packs || [];

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
      if (body.includes(price) || body.includes(priceFr)) {
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

  test('/stages renders at least one canonical composite price in the DOM', async ({ page }) => {
    await page.goto('/stages', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    // Get full page HTML (includes SSR + hydrated content)
    const html = await page.content();

    let found = 0;
    for (const p of compositePacks) {
      if (html.includes(String(p.price_per_student))) {
        found++;
      }
    }
    // Composite prices are derived from getCompositeStagePackPrice() which
    // reads the canonical JSON — if ANY appear, the derivation chain works
    expect(found).toBeGreaterThanOrEqual(1);
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
});
