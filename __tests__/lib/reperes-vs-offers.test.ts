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
  test('brevetMois == brevet-maths installment_amount', () => {
    expect(rep.brevetMois).toBe(`à partir de ${findOffer('brevet-maths').installment_amount} TND / mois hors réservation`);
  });

  test('secondeMois == 2nde-maths installment_amount', () => {
    expect(rep.secondeMois).toBe(`à partir de ${findOffer('2nde-maths').installment_amount} TND / mois hors réservation`);
  });

  test('premiereSimpleMois == 1re-eaf installment_amount', () => {
    expect(rep.premiereSimpleMois).toBe(`à partir de ${findOffer('1re-eaf').installment_amount} TND / mois hors réservation`);
  });

  test('premiereDuoMois == 1re-double-secu installment_amount', () => {
    expect(rep.premiereDuoMois).toBe(`à partir de ${findOffer('1re-double-secu').installment_amount} TND / mois hors réservation`);
  });

  test('terminaleSimpleMois == term-spe-simple installment_amount', () => {
    expect(rep.terminaleSimpleMois).toBe(`à partir de ${findOffer('term-spe-simple').installment_amount} TND / mois hors réservation`);
  });

  test('terminaleDuoMois == term-duo installment_amount', () => {
    expect(rep.terminaleDuoMois).toBe(`à partir de ${findOffer('term-duo').installment_amount} TND / mois hors réservation`);
  });

  test('plateformeAn == plateforme-autonomie price_annual', () => {
    expect(rep.plateformeAn).toBe(`à partir de ${findOffer('plateforme-autonomie').price_annual} TND / an`);
  });

  test('stagesBase == min(stage_formats.price_per_student)', () => {
    const min = Math.min(...stages.map((f) => f.price_per_student));
    expect(rep.stagesBase).toBe(`dès ${min} TND`);
  });

  test('parrainage == referral_program in-kind reward (no monetary discount)', () => {
    // Grille C: parrainage is an in-kind reward (ARIA months), not a rules.discounts
    // amount — rules.discounts.parrainage_min_tnd/max_tnd stay at 0.
    const referral = data.referral_program;
    expect(rep.parrainage).toBe(
      `${referral.reward_months} mois ARIA offert par filleul inscrit (jusqu'à ${referral.cap_months_per_family_per_year} mois/an)`,
    );
  });
});
