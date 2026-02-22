/**
 * Access Rules — Tests.
 *
 * Validates resolveAccess() pure function with all role/entitlement combinations.
 */

import { resolveAccess } from '@/lib/access/rules';
import type { AccessRequest } from '@/lib/access/rules';

// ─── ADMIN always allowed ────────────────────────────────────────────────────

describe('ADMIN access', () => {
  it('ADMIN allowed for all features', () => {
    const features = [
      'platform_access', 'hybrid_sessions', 'immersion_mode',
      'aria_maths', 'aria_nsi', 'ai_feedback',
      'advanced_analytics', 'priority_support', 'credits_use',
      'admin_facturation',
    ] as const;

    for (const featureKey of features) {
      const result = resolveAccess({
        role: 'ADMIN',
        userId: 'admin-1',
        featureKey,
        activeFeatures: [], // ADMIN needs no entitlements
      });
      expect(result.allowed).toBe(true);
      expect(result.missing).toHaveLength(0);
    }
  });
});

// ─── ASSISTANTE access ───────────────────────────────────────────────────────

describe('ASSISTANTE access', () => {
  it('denied for admin_facturation without entitlement', () => {
    const result = resolveAccess({
      role: 'ASSISTANTE',
      userId: 'assist-1',
      featureKey: 'admin_facturation',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('missing_entitlement');
    expect(result.missing).toContain('admin_facturation');
  });

  it('allowed for admin_facturation with entitlement', () => {
    const result = resolveAccess({
      role: 'ASSISTANTE',
      userId: 'assist-1',
      featureKey: 'admin_facturation',
      activeFeatures: ['admin_facturation'],
    });
    expect(result.allowed).toBe(true);
  });

  it('allowed for credits_use (exempt)', () => {
    const result = resolveAccess({
      role: 'ASSISTANTE',
      userId: 'assist-1',
      featureKey: 'credits_use',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(true);
  });

  it('denied for aria_maths (not exempt)', () => {
    const result = resolveAccess({
      role: 'ASSISTANTE',
      userId: 'assist-1',
      featureKey: 'aria_maths',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('missing_entitlement');
    expect(result.missing).toContain('aria_maths');
  });
});

// ─── PARENT denied if missing feature ────────────────────────────────────────

describe('PARENT access', () => {
  it('denied for aria_maths without entitlement', () => {
    const result = resolveAccess({
      role: 'PARENT',
      userId: 'parent-1',
      featureKey: 'aria_maths',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('missing_entitlement');
    expect(result.missing).toContain('aria_maths');
  });

  it('denied for advanced_analytics without entitlement', () => {
    const result = resolveAccess({
      role: 'PARENT',
      userId: 'parent-1',
      featureKey: 'advanced_analytics',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('advanced_analytics');
  });

  it('allowed for advanced_analytics with entitlement', () => {
    const result = resolveAccess({
      role: 'PARENT',
      userId: 'parent-1',
      featureKey: 'advanced_analytics',
      activeFeatures: ['advanced_analytics'],
    });
    expect(result.allowed).toBe(true);
    expect(result.missing).toHaveLength(0);
  });
});

// ─── COACH denied if missing feature ─────────────────────────────────────────

describe('COACH access', () => {
  it('allowed for platform_access (exempt)', () => {
    const result = resolveAccess({
      role: 'COACH',
      userId: 'coach-1',
      featureKey: 'platform_access',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(true);
  });

  it('denied for aria_maths without entitlement', () => {
    const result = resolveAccess({
      role: 'COACH',
      userId: 'coach-1',
      featureKey: 'aria_maths',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('aria_maths');
  });
});

// ─── ELEVE denied if missing feature ─────────────────────────────────────────

describe('ELEVE access', () => {
  it('denied for aria_nsi without entitlement', () => {
    const result = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'aria_nsi',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('aria_nsi');
  });

  it('allowed for aria_nsi with entitlement', () => {
    const result = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'aria_nsi',
      activeFeatures: ['aria_nsi'],
    });
    expect(result.allowed).toBe(true);
  });

  it('denied for credits_use without credits_use entitlement', () => {
    const result = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'credits_use',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.missing).toContain('credits_use');
  });

  it('allowed for credits_use with entitlement', () => {
    const result = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'credits_use',
      activeFeatures: ['credits_use'],
    });
    expect(result.allowed).toBe(true);
  });
});

// ─── Auth required ───────────────────────────────────────────────────────────

describe('auth required', () => {
  it('denied if no userId', () => {
    const result = resolveAccess({
      role: 'ELEVE',
      userId: null,
      featureKey: 'platform_access',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('auth_required');
  });

  it('denied if no role', () => {
    const result = resolveAccess({
      role: null,
      userId: 'user-1',
      featureKey: 'platform_access',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('no_role');
  });

  it('denied if undefined userId', () => {
    const result = resolveAccess({
      role: 'ELEVE',
      userId: undefined,
      featureKey: 'aria_maths',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('auth_required');
  });
});

// ─── Unknown feature ─────────────────────────────────────────────────────────

describe('unknown feature', () => {
  it('denied for unknown feature key', () => {
    const result = resolveAccess({
      role: 'ADMIN',
      userId: 'admin-1',
      featureKey: 'does_not_exist' as any,
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('unknown_feature');
  });
});

// ─── missing[] correctness ───────────────────────────────────────────────────

describe('missing[] accuracy', () => {
  it('contains exactly the missing features', () => {
    const result = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'aria_maths',
      activeFeatures: ['platform_access'], // has platform but not aria_maths
    });
    expect(result.allowed).toBe(false);
    expect(result.missing).toEqual(['aria_maths']);
  });

  it('empty when all features present', () => {
    const result = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'aria_maths',
      activeFeatures: ['aria_maths', 'platform_access'],
    });
    expect(result.allowed).toBe(true);
    expect(result.missing).toHaveLength(0);
  });
});

// ─── Fallback mode ───────────────────────────────────────────────────────────

describe('fallback mode', () => {
  it('REDIRECT for aria features', () => {
    const result = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'aria_maths',
      activeFeatures: [],
    });
    expect(result.mode).toBe('REDIRECT');
  });

  it('DISABLE for hybrid_sessions', () => {
    const result = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'hybrid_sessions',
      activeFeatures: [],
    });
    expect(result.mode).toBe('DISABLE');
  });
});
