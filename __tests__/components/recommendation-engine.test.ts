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
    offers: getAllOffers().map((offer) => {
      const payment = getAnnualOfferPaymentSchedule(offer);
      return {
        id: offer.id, level: offer.level, track: offer.track, title: offer.title,
        subjects: offer.subjects, hours_per_week: offer.hours_per_week, hours_per_year: offer.hours_per_year,
        group_max: offer.group_max, group_min_open: offer.group_min_open, price_annual: offer.price_annual,
        included: offer.included, pricing_display: offer.pricing_display,
        payment: payment ? { ...payment, depositPct: rules.payment.deposit_pct_annual } : undefined,
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
});
