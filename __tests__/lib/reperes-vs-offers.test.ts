/**
 * Repères tarifaires == offres canoniques.
 * Each repère must equal the derived value from the offer it summarizes.
 * Fails if any repère diverges from its source offer.
 */

import { getFullPricingData } from '@/lib/pricing';

const data = getFullPricingData();
const rep = data.reperes_tarifaires;
const offers = data.offers;
const stages = data.stage_formats;

function findOffer(id: string) {
  const o = offers.find((o) => o.id === id);
  if (!o) throw new Error(`Offer ${id} not found in canonical`);
  return o;
}

describe('Repères tarifaires == canonical offers (no second source)', () => {
  test('brevetMois == brevet-maths monthly_display', () => {
    expect(rep.brevetMois).toBe(`à partir de ${findOffer('brevet-maths').monthly_display} TND / mois`);
  });

  test('secondeMois == 2nde-maths monthly_display', () => {
    expect(rep.secondeMois).toBe(`à partir de ${findOffer('2nde-maths').monthly_display} TND / mois`);
  });

  test('premiereSimpleMois == 1re-eaf monthly_display', () => {
    expect(rep.premiereSimpleMois).toBe(`à partir de ${findOffer('1re-eaf').monthly_display} TND / mois`);
  });

  test('premiereDuoMois == 1re-double-secu monthly_display', () => {
    expect(rep.premiereDuoMois).toBe(`à partir de ${findOffer('1re-double-secu').monthly_display} TND / mois`);
  });

  test('terminaleSimpleMois == term-spe-simple monthly_display', () => {
    expect(rep.terminaleSimpleMois).toBe(`à partir de ${findOffer('term-spe-simple').monthly_display} TND / mois`);
  });

  test('terminaleDuoMois == term-duo monthly_display', () => {
    expect(rep.terminaleDuoMois).toBe(`~ ${findOffer('term-duo').monthly_display} TND / mois`);
  });

  test('plateformeAn == plateforme-autonomie price_annual', () => {
    expect(rep.plateformeAn).toBe(`à partir de ${findOffer('plateforme-autonomie').price_annual} TND / an`);
  });

  test('stagesBase == min(stage_formats.price_per_student)', () => {
    const min = Math.min(...stages.map((f) => f.price_per_student));
    expect(rep.stagesBase).toBe(`dès ${min} TND`);
  });

  test('parrainage == rules.discounts range', () => {
    const rules = data.rules.discounts;
    expect(rep.parrainage).toBe(`${rules.parrainage_min_tnd} à ${rules.parrainage_max_tnd} TND`);
  });
});
