import { buildRecommendationOutcome } from '@/components/premium/recommendation-engine';
import { getOffersByLevel, normalizePricingLevel } from '@/lib/pricing';

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
    const outcome = buildRecommendationOutcome({ need: 'annual', track: 'scolarise' });

    expect(outcome.cards).toHaveLength(0);
    expect(outcome.emptyState).toBeDefined();
    expect(outcome.emptyState?.title).toContain('Sélectionnez un niveau');
    const hrefs = outcome.emptyState?.actions.map((action) => action.href) ?? [];
    expect(hrefs[0]).toBe('/bilan-gratuit');
    expect(hrefs[1]).toBe('/offres');
    expect(hrefs[2]).toMatch(/^https:\/\/wa\.me\/\d+/);

  });

  it('returns at least one recommendation for a valid annual request', () => {
    const outcome = buildRecommendationOutcome({
      need: 'annual',
      track: 'scolarise',
      level: 'Première',
    });

    expect(outcome.emptyState).toBeUndefined();
    expect(outcome.cards.length).toBeGreaterThan(0);
    expect(outcome.cards[0].ctaHref).toBe('/offres');
  });
});
