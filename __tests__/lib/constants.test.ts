import { ARIA_ADDONS, CREDIT_COSTS, SPECIAL_PACKS, SUBSCRIPTION_PLANS } from '@/lib/constants';

describe('constants', () => {
  it('defines subscription plans with prices and credits', () => {
    expect(SUBSCRIPTION_PLANS.HYBRIDE.price).toBeGreaterThan(0);
    expect(SUBSCRIPTION_PLANS.IMMERSION.credits).toBeGreaterThan(0);
  });

  it('defines special packs', () => {
    expect(SPECIAL_PACKS.GRAND_ORAL.features.length).toBeGreaterThan(0);
    expect(SPECIAL_PACKS.BAC_FRANCAIS.price).toBeGreaterThan(0);
  });

  it('defines ARIA add-ons', () => {
    expect(ARIA_ADDONS.MATIERE_SUPPLEMENTAIRE.price).toBeGreaterThan(0);
  });

  it('defines credit costs', () => {
    expect(CREDIT_COSTS.COURS_ONLINE).toBeGreaterThan(0);
  });
});
