/**
 * Feature Catalog — Tests.
 *
 * Validates feature definitions, key uniqueness, and requires references.
 */

import {
  FEATURES,
  isValidFeatureKey,
  getFeatureDefinition,
  getAllFeatureKeys,
} from '@/lib/access/features';
import type { FeatureKey, FallbackMode } from '@/lib/access/features';

describe('FEATURES registry', () => {
  const allKeys = getAllFeatureKeys();

  it('has at least 10 features', () => {
    expect(allKeys.length).toBeGreaterThanOrEqual(10);
  });

  it('every feature has a non-empty label', () => {
    for (const key of allKeys) {
      expect(FEATURES[key].label.length).toBeGreaterThan(0);
    }
  });

  it('every feature has a non-empty description', () => {
    for (const key of allKeys) {
      expect(FEATURES[key].description.length).toBeGreaterThan(0);
    }
  });

  it('every feature has a valid fallback mode', () => {
    const validModes: FallbackMode[] = ['HIDE', 'DISABLE', 'REDIRECT'];
    for (const key of allKeys) {
      expect(validModes).toContain(FEATURES[key].fallback);
    }
  });

  it('every feature has rolesExempt as an array', () => {
    for (const key of allKeys) {
      expect(Array.isArray(FEATURES[key].rolesExempt)).toBe(true);
    }
  });

  it('every feature has requires as an array', () => {
    for (const key of allKeys) {
      expect(Array.isArray(FEATURES[key].requires)).toBe(true);
    }
  });

  it('no duplicate feature keys', () => {
    const uniqueKeys = new Set(allKeys);
    expect(uniqueKeys.size).toBe(allKeys.length);
  });

  it('admin_facturation has no entitlement requirements', () => {
    const def = FEATURES.admin_facturation;
    expect(def.requires).toHaveLength(0);
    expect(def.rolesExempt).toContain('ADMIN');
    expect(def.rolesExempt).toContain('ASSISTANTE');
  });

  it('aria features require corresponding entitlement', () => {
    expect(FEATURES.aria_maths.requires).toContain('aria_maths');
    expect(FEATURES.aria_nsi.requires).toContain('aria_nsi');
  });

  it('ADMIN is exempt from aria features', () => {
    expect(FEATURES.aria_maths.rolesExempt).toContain('ADMIN');
    expect(FEATURES.aria_nsi.rolesExempt).toContain('ADMIN');
  });

  it('credits_use requires platform_access', () => {
    expect(FEATURES.credits_use.requires).toContain('platform_access');
  });
});

describe('isValidFeatureKey', () => {
  it('returns true for known keys', () => {
    expect(isValidFeatureKey('aria_maths')).toBe(true);
    expect(isValidFeatureKey('credits_use')).toBe(true);
    expect(isValidFeatureKey('admin_facturation')).toBe(true);
  });

  it('returns false for unknown keys', () => {
    expect(isValidFeatureKey('unknown_feature')).toBe(false);
    expect(isValidFeatureKey('')).toBe(false);
  });
});

describe('getFeatureDefinition', () => {
  it('returns definition for known key', () => {
    const def = getFeatureDefinition('advanced_analytics');
    expect(def).not.toBeNull();
    expect(def!.label).toBe('Analytics Premium');
    expect(def!.requires).toContain('advanced_analytics');
  });

  it('returns null for unknown key', () => {
    expect(getFeatureDefinition('does_not_exist')).toBeNull();
  });
});
