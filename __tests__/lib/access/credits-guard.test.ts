/** Retired credit entitlements never reactivate the removed capability. */
import { resolveAccess } from '@/lib/access/rules';
import type { FeatureKey } from '@/lib/access/features';

describe('retired credits_use capability', () => {
  describe.each(['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'])('%s', (role) => {
    it.each([{ features: [] }, { features: ['credits_use'] }, { features: ['platform_access', 'credits_use'] }])(
      'denies legacy request with active features $features', ({ features }) => {
        const result = resolveAccess({
          role,
          userId: 'user-1',
          featureKey: 'credits_use' as FeatureKey,
          activeFeatures: features,
        });
        expect(result).toEqual({
          allowed: false,
          reason: 'unknown_feature',
          mode: 'REDIRECT',
          missing: ['credits_use'],
        });
      }
    );
  });
  it('also denies an unauthenticated legacy request', () => {
    expect(resolveAccess({ role: null, userId: null, featureKey: 'credits_use' as FeatureKey, activeFeatures: [] }).reason).toBe('unknown_feature');
  });
});
