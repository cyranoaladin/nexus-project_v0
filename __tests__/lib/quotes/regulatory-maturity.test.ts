import { getLegacyRegulatoryDisclaimer, LEGACY_REGULATORY_DISCLAIMER } from '@/lib/quotes/regulatory-maturity';

describe('getLegacyRegulatoryDisclaimer', () => {
  test('returns the disclaimer text for LEGACY_ESTIMATE_UNVERIFIED', () => {
    expect(getLegacyRegulatoryDisclaimer('LEGACY_ESTIMATE_UNVERIFIED')).toBe(LEGACY_REGULATORY_DISCLAIMER);
  });

  test('returns null for CARTE_VALIDATED_DEFINITIVE', () => {
    expect(getLegacyRegulatoryDisclaimer('CARTE_VALIDATED_DEFINITIVE')).toBeNull();
  });
});
