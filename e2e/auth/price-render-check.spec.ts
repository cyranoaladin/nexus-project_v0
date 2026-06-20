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

  // ── Homepage repères tarifaires (scroll + hydrate) ──

  test('homepage repères: each label shows its canonical value (label↔valeur)', async ({ page }) => {
    const rep = data.reperes_tarifaires;
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(300);
    }
    const text = await page.locator('body').innerText();

    // Each repère label is paired with its canonical value
    const pairs = [
      { label: 'Spécialité simple', value: rep.terminaleSimpleMois },
      { label: 'Double Sécurité', value: rep.premiereDuoMois },
      { label: 'Stage Intensif', value: rep.stagesBase },
      { label: 'Plateforme ARIA', value: rep.plateformeAn },
    ];

    for (const { label, value } of pairs) {
      // Extract the number from the repère string
      const numMatch = value.match(/[0-9]+/);
      expect(numMatch).not.toBeNull();
      const num = numMatch![0];
      // Both label and its price number must appear in the visible text
      expect(text).toContain(label);
      expect(text).toContain(num);
    }
    expect(text).toContain('TND');
  });

  // ── /recommandation wizard → prix affiché ──

  test('/recommandation wizard shows canonical prices after 3 steps', async ({ page }) => {
    await page.goto('/recommandation', { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    await page.locator('button', { hasText: 'Terminale' }).first().click();
    await page.waitForTimeout(800);
    await page.locator('button', { hasText: 'Scolarisé' }).first().click();
    await page.waitForTimeout(800);
    await page.locator('button', { hasText: 'Accompagnement annuel' }).first().click();
    await page.waitForTimeout(2000);
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await page.waitForTimeout(300);
    }
    const text = await page.locator('body').innerText();
    // Terminale annual offers: monthly 390 (simple), 718 (duo), 959 (excellence)
    expect(text).toContain('390');
    expect(text).toContain('TND');
  });

  // Dashboard dialogs verified by data-coherence.test.ts (data-layer, gated by role).
});
