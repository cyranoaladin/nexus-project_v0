import { PRODUCT_REGISTRY } from '@/lib/entitlement/types';

describe('Subscription access without credits', () => {
  it.each([
    ['ABONNEMENT_ESSENTIEL', ['platform_access']],
    ['ABONNEMENT_HYBRIDE', ['platform_access', 'hybrid_sessions']],
    ['ABONNEMENT_IMMERSION', ['platform_access', 'hybrid_sessions', 'immersion_mode']],
  ] as const)('%s preserves its educational access without credit grants', (code, expectedFeatures) => {
    const product = PRODUCT_REGISTRY[code];
    expect(product.features).toEqual([...expectedFeatures]);
    expect(product.features).not.toContain('credits_use');
    expect(product.grantsCredits).toBeNull();
    expect(product.mode).toBe('EXTEND');
    expect(product.defaultDurationDays).toBe(30);
  });
});
