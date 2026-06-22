/**
 * Pricing display coherence:
 * - pricing_display field is explicit for plateforme offers (not heuristic)
 * - plateforme offers render as annual (no /mois)
 * - tutorat (scolarisé + libre) offers render as monthly-first
 * - every mensualized offer's monthly_display on /offres matches the home repère
 */

import { getFullPricingData, type PricingData } from '@/lib/pricing';

let data: PricingData;

beforeAll(() => {
  data = getFullPricingData();
});

// ── pricing_display canonical field ──

describe('pricing_display canonical invariant', () => {
  test('all plateforme offers have pricing_display == "annual"', () => {
    const plateforme = data.offers.filter((o) => o.track === 'plateforme');
    expect(plateforme.length).toBeGreaterThanOrEqual(1);
    for (const o of plateforme) {
      expect(o.pricing_display).toBe('annual');
    }
  });

  test('no scolarisé offer has pricing_display == "annual"', () => {
    const scolarise = data.offers.filter((o) => o.track === 'scolarise');
    for (const o of scolarise) {
      if (o.pricing_display) {
        expect(o.pricing_display).not.toBe('annual');
      }
    }
  });

  test('no libre offer has pricing_display == "annual"', () => {
    const libre = data.offers.filter((o) => o.track === 'libre');
    for (const o of libre) {
      if (o.pricing_display) {
        expect(o.pricing_display).not.toBe('annual');
      }
    }
  });
});

// ── Monthly / annual coherence across home repères and /offres ──

describe('monthly_display coherence: home repères == offres source', () => {
  const repereSourceMap: Record<string, { repereKey: keyof PricingData['reperes_tarifaires']; offerId: string; field: 'monthly_display' | 'price_annual' }> = {
    'brevet (mois)': { repereKey: 'brevetMois', offerId: 'brevet-maths', field: 'monthly_display' },
    'seconde (mois)': { repereKey: 'secondeMois', offerId: '2nde-maths', field: 'monthly_display' },
    'première simple (mois)': { repereKey: 'premiereSimpleMois', offerId: '1re-eaf', field: 'monthly_display' },
    'première duo (mois)': { repereKey: 'premiereDuoMois', offerId: '1re-double-secu', field: 'monthly_display' },
    'terminale simple (mois)': { repereKey: 'terminaleSimpleMois', offerId: 'term-spe-simple', field: 'monthly_display' },
    'terminale duo (mois)': { repereKey: 'terminaleDuoMois', offerId: 'term-duo', field: 'monthly_display' },
    'plateforme (annuel)': { repereKey: 'plateformeAn', offerId: 'plateforme-autonomie', field: 'price_annual' },
  };

  for (const [label, { repereKey, offerId, field }] of Object.entries(repereSourceMap)) {
    test(`repère ${label}: ${repereKey} matches ${offerId}.${field}`, () => {
      const repere = data.reperes_tarifaires[repereKey];
      const offer = data.offers.find((o) => o.id === offerId);
      expect(offer).toBeDefined();
      const value = offer![field as keyof typeof offer];
      expect(repere).toContain(String(value));
    });
  }
});

// ── Full mensualized offers table ──

describe('all mensualized offers table (scolarisé + libre)', () => {
  test('every offer with monthly_display has correct annual ≈ monthly × 10', () => {
    const mensualized = data.offers.filter(
      (o) => o.monthly_display != null && o.pricing_display !== 'annual',
    );
    expect(mensualized.length).toBeGreaterThanOrEqual(10);
    for (const o of mensualized) {
      // monthly_display × 10 should be close to price_annual (within rounding)
      const expected = o.monthly_display! * 10;
      const annual = o.price_annual!;
      expect(Math.abs(annual - expected)).toBeLessThanOrEqual(50);
    }
  });

  test('plateforme offers monthly_display × 10 ≈ price_annual', () => {
    const plateforme = data.offers.filter((o) => o.track === 'plateforme');
    for (const o of plateforme) {
      expect(o.monthly_display).toBeDefined();
      const expected = o.monthly_display! * 10;
      const annual = o.price_annual!;
      expect(Math.abs(annual - expected)).toBeLessThanOrEqual(10);
    }
  });
});
