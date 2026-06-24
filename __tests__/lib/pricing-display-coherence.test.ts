/**
 * Pricing display coherence:
 * - pricing_display field is explicit for plateforme offers (not heuristic)
 * - plateforme offers render as annual (no /mois)
 * - tutorat (scolarisé + libre) offers render from canonical installments
 * - every mensualized home repère matches the canonical installment amount
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

// ── Installment / annual coherence across home repères and /offres ──

describe('installment display coherence: home repères == offres source', () => {
  const repereSourceMap: Record<string, { repereKey: keyof PricingData['reperes_tarifaires']; offerId: string; field: 'installment_amount' | 'price_annual' }> = {
    'brevet (mois)': { repereKey: 'brevetMois', offerId: 'brevet-maths', field: 'installment_amount' },
    'seconde (mois)': { repereKey: 'secondeMois', offerId: '2nde-maths', field: 'installment_amount' },
    'première simple (mois)': { repereKey: 'premiereSimpleMois', offerId: '1re-eaf', field: 'installment_amount' },
    'première duo (mois)': { repereKey: 'premiereDuoMois', offerId: '1re-double-secu', field: 'installment_amount' },
    'terminale simple (mois)': { repereKey: 'terminaleSimpleMois', offerId: 'term-spe-simple', field: 'installment_amount' },
    'terminale duo (mois)': { repereKey: 'terminaleDuoMois', offerId: 'term-duo', field: 'installment_amount' },
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

// ── Full installment offers table ──

describe('all installment-backed offers table (scolarisé + libre)', () => {
  test('every offer with installments recomposes annual price exactly', () => {
    const mensualized = data.offers.filter(
      (o) => o.deposit != null && o.installment_amount != null && o.pricing_display !== 'annual',
    );
    expect(mensualized.length).toBeGreaterThanOrEqual(10);
    for (const o of mensualized) {
      const expected =
        o.deposit! +
        o.installment_amount! * (o.n_installments! - 1) +
        (o.last_installment ?? o.installment_amount!);

      expect(expected).toBe(o.price_annual);
    }
  });

  test('all offers omit deprecated monthly_display', () => {
    for (const o of data.offers) {
      expect((o as unknown as Record<string, unknown>).monthly_display).toBeUndefined();
    }
  });
});
