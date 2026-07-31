import { buildRecommendationOutcome, type RecommendationData } from '@/components/premium/recommendation-engine';
import {
  getAllOffers,
  getAnnualOfferPaymentSchedule,
  getCarte,
  getOffersByLevel,
  getPonctuelOffers,
  getRules,
  getStageFormats,
  normalizePricingLevel,
} from '@/lib/pricing';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

function buildTestData(): RecommendationData {
  const rules = getRules();
  const carte = getCarte();
  return {
    rules: {
      group_max: rules.group_max,
      group_min_open: {
        lycee: rules.group_min_open.lycee,
        college: rules.group_min_open.college,
      },
      payment: {
        deposit_pct_annual: rules.payment.deposit_pct_annual,
        reservation_flat_tnd: rules.payment.reservation_flat_tnd,
        annual_uses_flat_reservation: rules.payment.annual_uses_flat_reservation,
        deposit_non_refundable_except_group_not_opened:
          rules.payment.deposit_non_refundable_except_group_not_opened,
        deposit_deductible_to_annual: rules.payment.deposit_deductible_to_annual,
      },
    },
    offers: getAllOffers().map((offer) => {
      const payment = getAnnualOfferPaymentSchedule(offer);
      return {
        id: offer.id, level: offer.level, track: offer.track, title: offer.title,
        subjects: offer.subjects, hours_per_week: offer.hours_per_week, hours_per_year: offer.hours_per_year,
        group_max: offer.group_max, group_min_open: offer.group_min_open, price_annual: offer.price_annual,
        included: offer.included, pricing_display: offer.pricing_display,
        payment: payment ?? undefined,
        normalizedLevel: normalizePricingLevel(offer.level),
      };
    }),
    stageFormats: getStageFormats().map((f) => ({
      title: f.title, hours: f.hours, group_max: f.group_max, group_min_open: f.group_min_open,
      price_per_student: f.price_per_student, payment: { deposit: f.payment.deposit, solde: f.payment.solde },
    })),
    ponctuelOffers: getPonctuelOffers().map((o) => ({
      title: o.title, description: o.description, public: o.public, price_per_student: o.price_per_student,
      group_max: o.group_max, group_min_open: o.group_min_open,
      payment: { full_at_booking: o.payment.full_at_booking, deposit: o.payment.deposit, solde: o.payment.solde },
      normalizedPublic: normalizePricingLevel(o.public),
    })),
    carte: { title: carte.title, price_annual: carte.price_annual, includes: carte.includes },
    whatsappUrl: buildWhatsAppUrl(),
  };
}

describe('recommendation engine', () => {
  it('normalizes legacy level labels to canonical pricing levels', () => {
    expect(normalizePricingLevel('Première')).toBe('premiere');
    expect(normalizePricingLevel('Terminale')).toBe('terminale');
    expect(normalizePricingLevel('Seconde')).toBe('seconde');
    expect(normalizePricingLevel('Troisième')).toBe('troisieme');
    expect(normalizePricingLevel('unknown')).toBeNull();
  });

  it('returns the same offers for legacy and canonical level labels', () => {
    const canonical = getOffersByLevel('premiere');
    const legacy = getOffersByLevel('Première');
    expect(legacy.map((offer) => offer.id)).toEqual(canonical.map((offer) => offer.id));
  });

  it('exposes a clear empty state when the level is missing', () => {
    const data = buildTestData();
    const outcome = buildRecommendationOutcome({ need: 'annual', track: 'scolarise' }, data);
    expect(outcome.cards).toHaveLength(0);
    expect(outcome.emptyState).toBeDefined();
    expect(outcome.emptyState?.title).toContain('Sélectionnez un niveau');
    const hrefs = outcome.emptyState?.actions.map((action) => action.href) ?? [];
    expect(hrefs[0]).toBe('/bilan-gratuit');
    expect(hrefs[1]).toBe('/offres');
    expect(hrefs[2]).toMatch(/^https:\/\/wa\.me\/\d+/);
  });

  it('returns at least one recommendation for a valid annual request', () => {
    const data = buildTestData();
    const outcome = buildRecommendationOutcome({ need: 'annual', track: 'scolarise', level: 'premiere' }, data);
    expect(outcome.emptyState).toBeUndefined();
    expect(outcome.cards.length).toBeGreaterThan(0);
    expect(outcome.cards[0].ctaHref).toBe('/offres');
  });

  it('normalizes accented legacy level labels in the wizard (e.g. Première)', () => {
    const data = buildTestData();
    const outcome = buildRecommendationOutcome({ need: 'annual', track: 'scolarise', level: 'Première' }, data);
    expect(outcome.cards.length).toBeGreaterThan(0);
  });

  it('uses the canonical flat reservation policy for annual recommendations', () => {
    const rules = getRules();
    const data = buildTestData();
    const outcome = buildRecommendationOutcome({ need: 'annual', track: 'scolarise', level: 'premiere' }, data);

    expect(outcome.cards[0].payment).toMatchObject({
      deposit: rules.payment.reservation_flat_tnd,
      depositLabel: 'Réservation',
      refundableIfGroupNotOpened: rules.payment.deposit_non_refundable_except_group_not_opened,
      deductibleToAnnual: rules.payment.deposit_deductible_to_annual,
    });
    expect(outcome.cards[0].payment?.depositPct).toBeUndefined();
  });

  it('uses rules.group_max when an annual offer has no explicit capacity', () => {
    const rules = getRules();
    const baseData = buildTestData();
    const premiereOffer = baseData.offers.find((offer) => offer.normalizedLevel === 'premiere');
    expect(premiereOffer).toBeDefined();

    const data = {
      ...baseData,
      offers: [{ ...premiereOffer!, group_max: null }],
    };
    const outcome = buildRecommendationOutcome({ need: 'annual', track: 'scolarise', level: 'premiere' }, data);

    expect(outcome.cards[0].groupMax).toBe(rules.group_max);
  });

  it('describes Carte Nexus through its in-kind benefits, without discounts', () => {
    const data = buildTestData();
    const outcome = buildRecommendationOutcome({ need: 'platform' }, data);

    expect(outcome.cards[0].price).toBe(getCarte().price_annual);
    expect(outcome.cards[0].subtitle).toBe(
      'ARIA Autonomie, diagnostic offert, épreuve blanche offerte et réservation prioritaire',
    );
    expect(outcome.cards[0].subtitle?.toLowerCase()).not.toMatch(/remise|réduction|rabais/);
  });
});
