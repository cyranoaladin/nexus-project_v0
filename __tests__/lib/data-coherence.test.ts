/**
 * Data coherence — proves that lib/pricing exports match the invariants
 * of pricing.canonical.json. This is DATA-layer verification, not DOM.
 *
 * The DOM-level verification (prices rendered on pages) is in the E2E
 * suite: e2e/auth/price-render-check.spec.ts
 */

import { getFullPricingData } from '@/lib/pricing';

const data = getFullPricingData();

// Helper: format a number the way the UI formats it (French locale)
function fmtVariants(n: number): string[] {
  return [
    String(n),
    n.toLocaleString('fr-FR'),
    n.toLocaleString('fr-FR').replace(/\u00A0/g, ' '), // non-breaking space → regular space
  ];
}

describe('Rendered prices match canonical — by offer', () => {
  // We test against a snapshot of the canonical data (not the live render,
  // which requires Docker). The real render test is the E2E suite.
  // Here we verify the DATA LAYER — that lib/pricing exports the correct
  // values that components consume.

  describe('Annual offers', () => {
    const priced = data.offers.filter((o) => o.price_annual != null);

    test(`all ${priced.length} priced offers have price_annual > 0`, () => {
      for (const o of priced) {
        expect(o.price_annual).toBeGreaterThan(0);
      }
    });

    test('every priced offer has monthly_display == round(annual/10)', () => {
      for (const o of priced) {
        expect(o.monthly_display).toBe(Math.round(o.price_annual! / 10));
      }
    });

    test('every priced offer has group_max <= 5', () => {
      for (const o of priced) {
        if (o.group_max != null) {
          expect(o.group_max).toBeLessThanOrEqual(5);
        }
      }
    });

    test('no offer has line-through / prix barre fields', () => {
      for (const o of priced) {
        expect((o as any).price_annual_public).toBeUndefined();
        expect((o as any).originalPrice).toBeUndefined();
      }
    });
  });

  describe('Stage formats', () => {
    test('every stage format has group_max <= 5', () => {
      for (const f of data.stage_formats) {
        expect(f.group_max).toBeLessThanOrEqual(5);
      }
    });

    test('every stage format price >= 420 (plancher)', () => {
      for (const f of data.stage_formats) {
        expect(f.price_per_student).toBeGreaterThanOrEqual(420);
      }
    });

    test('every stage format deposit + solde == price', () => {
      for (const f of data.stage_formats) {
        expect(f.payment.deposit + f.payment.solde).toBe(f.price_per_student);
      }
    });

    test('listing formats (express/solo/renfort/duo/vacances) are all present', () => {
      const listingFormats = ['intensif-solo', 'intensif-renfort', 'intensif-duo', 'express-vacances'];
      for (const id of listingFormats) {
        const found = data.stage_formats.find((f) => f.format_id === id);
        expect(found).toBeDefined();
        expect(found!.price_per_student).toBeGreaterThan(0);
      }
    });

    test('edition-only formats (duo-plus/sprint-final/sprint-final-max) exist in canonical', () => {
      const editionFormats = ['intensif-duo-plus', 'sprint-final', 'sprint-final-max'];
      for (const id of editionFormats) {
        const found = data.stage_formats.find((f) => f.format_id === id);
        expect(found).toBeDefined();
      }
    });
  });

});
