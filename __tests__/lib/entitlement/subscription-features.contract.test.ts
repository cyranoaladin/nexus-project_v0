import { PRODUCT_REGISTRY } from '@/lib/entitlement/types';

describe('Subscription products include credits_use feature', () => {
  it('all subscription plans grant credits_use', () => {
    expect(PRODUCT_REGISTRY.ABONNEMENT_ESSENTIEL.features).toContain('credits_use');
    expect(PRODUCT_REGISTRY.ABONNEMENT_HYBRIDE.features).toContain('credits_use');
    expect(PRODUCT_REGISTRY.ABONNEMENT_IMMERSION.features).toContain('credits_use');
  });
});
