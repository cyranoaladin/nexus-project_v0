/**
 * Access Rules — Complete Matrix Test (10 features × 5 roles × entitlement present/absent)
 *
 * Generates 100 test cases covering every feature × role combination.
 *
 * Source: lib/access/rules.ts + lib/access/features.ts
 */

import { resolveAccess } from '@/lib/access/rules';
import { FEATURES, getAllFeatureKeys, type FeatureKey } from '@/lib/access/features';

const FEATURE_KEYS = getAllFeatureKeys();
const ROLES = ['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'] as const;

// ─── Complete Matrix ─────────────────────────────────────────────────────────

describe('Access Rules Matrix (10 features × 5 roles)', () => {
  FEATURE_KEYS.forEach((featureKey) => {
    const feature = FEATURES[featureKey];

    describe(`Feature: ${featureKey}`, () => {
      ROLES.forEach((role) => {
        const isExempt = feature.rolesExempt.includes(role);
        const hasRequirements = feature.requires.length > 0;

        describe(`Role: ${role}`, () => {
          if (isExempt) {
            it(`should grant access (role ${role} is exempt)`, () => {
              // Arrange
              const result = resolveAccess({
                role,
                userId: `${role.toLowerCase()}-1`,
                featureKey,
                activeFeatures: [], // no entitlements needed
              });

              // Assert
              expect(result.allowed).toBe(true);
              expect(result.reason).toBeNull();
              expect(result.missing).toHaveLength(0);
            });
          } else if (hasRequirements) {
            it(`should grant access when entitlement is ACTIVE`, () => {
              // Arrange
              const result = resolveAccess({
                role,
                userId: `${role.toLowerCase()}-1`,
                featureKey,
                activeFeatures: [...feature.requires],
              });

              // Assert
              expect(result.allowed).toBe(true);
              expect(result.reason).toBeNull();
              expect(result.missing).toHaveLength(0);
            });

            it(`should deny access when no entitlement exists`, () => {
              // Arrange
              const result = resolveAccess({
                role,
                userId: `${role.toLowerCase()}-1`,
                featureKey,
                activeFeatures: [],
              });

              // Assert
              expect(result.allowed).toBe(false);
              expect(result.reason).toBe('missing_entitlement');
              expect(result.missing.length).toBeGreaterThan(0);
            });

            it(`should apply correct fallback mode (${feature.fallback})`, () => {
              // Arrange
              const result = resolveAccess({
                role,
                userId: `${role.toLowerCase()}-1`,
                featureKey,
                activeFeatures: [],
              });

              // Assert
              expect(result.mode).toBe(feature.fallback);
            });
          } else {
            it(`should grant access (no entitlement required)`, () => {
              // Arrange
              const result = resolveAccess({
                role,
                userId: `${role.toLowerCase()}-1`,
                featureKey,
                activeFeatures: [],
              });

              // Assert
              expect(result.allowed).toBe(true);
            });
          }
        });
      });

      // Unauthenticated access
      it('should deny access when unauthenticated', () => {
        // Arrange
        const result = resolveAccess({
          role: null,
          userId: null,
          featureKey,
          activeFeatures: [],
        });

        // Assert
        expect(result.allowed).toBe(false);
        expect(result.reason).toBe('auth_required');
      });
    });
  });
});

// ─── Edge Cases ──────────────────────────────────────────────────────────────

describe('Access Rules Edge Cases', () => {
  it('should deny for unknown feature key', () => {
    const result = resolveAccess({
      role: 'ADMIN',
      userId: 'admin-1',
      featureKey: 'nonexistent_feature' as FeatureKey,
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('unknown_feature');
  });

  it('should deny when userId is undefined', () => {
    const result = resolveAccess({
      role: 'ELEVE',
      userId: undefined,
      featureKey: 'platform_access',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('auth_required');
  });

  it('should deny when role is undefined', () => {
    const result = resolveAccess({
      role: undefined,
      userId: 'user-1',
      featureKey: 'platform_access',
      activeFeatures: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('no_role');
  });

  it('should deny when role is empty string', () => {
    const result = resolveAccess({
      role: '',
      userId: 'user-1',
      featureKey: 'aria_maths',
      activeFeatures: [],
    });
    // Empty string role is not in rolesExempt, and has no entitlement
    expect(result.allowed).toBe(false);
  });

  it('should return correct missing array with partial entitlements', () => {
    const result = resolveAccess({
      role: 'ELEVE',
      userId: 'eleve-1',
      featureKey: 'aria_maths',
      activeFeatures: ['platform_access'], // has platform but not aria_maths
    });
    expect(result.allowed).toBe(false);
    expect(result.missing).toEqual(['aria_maths']);
  });
});

// ─── Feature Count Validation ────────────────────────────────────────────────

describe('Feature Catalog Integrity', () => {
  it('should have exactly 10 features defined', () => {
    expect(FEATURE_KEYS).toHaveLength(10);
  });

  it('should have all expected feature keys', () => {
    const expected = [
      'platform_access', 'hybrid_sessions', 'immersion_mode',
      'aria_maths', 'aria_nsi', 'ai_feedback',
      'advanced_analytics', 'priority_support', 'credits_use',
      'admin_facturation',
    ];
    expect(FEATURE_KEYS.sort()).toEqual(expected.sort());
  });

  it('every feature should have ADMIN in rolesExempt', () => {
    FEATURE_KEYS.forEach((key) => {
      expect(FEATURES[key].rolesExempt).toContain('ADMIN');
    });
  });

  it('every feature should have a non-empty label', () => {
    FEATURE_KEYS.forEach((key) => {
      expect(FEATURES[key].label.length).toBeGreaterThan(0);
    });
  });

  it('every feature should have a valid fallback mode', () => {
    FEATURE_KEYS.forEach((key) => {
      expect(['HIDE', 'DISABLE', 'REDIRECT']).toContain(FEATURES[key].fallback);
    });
  });
});
