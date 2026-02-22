import { FEATURES } from '@/lib/access/features';

describe('Feature catalog contract (NAVIGATION_MAP)', () => {
  it('matches fallback modes and exemptions from contract', () => {
    expect(FEATURES.aria_maths.fallback).toBe('REDIRECT');
    expect(FEATURES.aria_nsi.fallback).toBe('REDIRECT');

    expect(FEATURES.hybrid_sessions.fallback).toBe('DISABLE');
    expect(FEATURES.immersion_mode.fallback).toBe('DISABLE');

    expect(FEATURES.advanced_analytics.fallback).toBe('HIDE');
    expect(FEATURES.advanced_analytics.rolesExempt).toEqual(['ADMIN']);

    expect(FEATURES.admin_facturation.fallback).toBe('REDIRECT');
    expect(FEATURES.admin_facturation.rolesExempt).toEqual(['ADMIN']);

    expect(FEATURES.credits_use.requires).toContain('credits_use');
  });
});
