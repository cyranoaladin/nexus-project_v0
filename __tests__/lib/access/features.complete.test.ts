/**
 * Feature Catalog — Complete Test Suite
 *
 * Tests: FEATURES registry integrity, isValidFeatureKey, getFeatureDefinition,
 *        getAllFeatureKeys, fallback modes, role exemptions
 *
 * Source: lib/access/features.ts
 */

import {
  FEATURES,
  isValidFeatureKey,
  getFeatureDefinition,
  getAllFeatureKeys,
  type FeatureKey,
  type FallbackMode,
} from '@/lib/access/features';

// ─── Registry Integrity ──────────────────────────────────────────────────────

describe('FEATURES registry integrity', () => {
  const allKeys = Object.keys(FEATURES) as FeatureKey[];

  it('should have exactly 10 feature keys', () => {
    expect(allKeys).toHaveLength(10);
  });

  it('every feature should have a non-empty label', () => {
    allKeys.forEach((key) => {
      expect(FEATURES[key].label.length).toBeGreaterThan(0);
    });
  });

  it('every feature should have a non-empty description', () => {
    allKeys.forEach((key) => {
      expect(FEATURES[key].description.length).toBeGreaterThan(0);
    });
  });

  it('every feature should have a valid fallback mode', () => {
    const validModes: FallbackMode[] = ['HIDE', 'DISABLE', 'REDIRECT'];
    allKeys.forEach((key) => {
      expect(validModes).toContain(FEATURES[key].fallback);
    });
  });

  it('every feature should have requires as a non-empty array', () => {
    allKeys.forEach((key) => {
      expect(Array.isArray(FEATURES[key].requires)).toBe(true);
      expect(FEATURES[key].requires.length).toBeGreaterThan(0);
    });
  });

  it('every feature should have rolesExempt as an array', () => {
    allKeys.forEach((key) => {
      expect(Array.isArray(FEATURES[key].rolesExempt)).toBe(true);
    });
  });

  it('ADMIN should be exempt from all features', () => {
    allKeys.forEach((key) => {
      expect(FEATURES[key].rolesExempt).toContain('ADMIN');
    });
  });

  it('platform_access should exempt ADMIN, ASSISTANTE, COACH', () => {
    expect(FEATURES.platform_access.rolesExempt).toContain('ADMIN');
    expect(FEATURES.platform_access.rolesExempt).toContain('ASSISTANTE');
    expect(FEATURES.platform_access.rolesExempt).toContain('COACH');
  });

  it('aria_maths should only exempt ADMIN', () => {
    expect(FEATURES.aria_maths.rolesExempt).toEqual(['ADMIN']);
  });

  it('credits_use should exempt ADMIN and ASSISTANTE', () => {
    expect(FEATURES.credits_use.rolesExempt).toContain('ADMIN');
    expect(FEATURES.credits_use.rolesExempt).toContain('ASSISTANTE');
  });
});

// ─── Fallback Mode Distribution ──────────────────────────────────────────────

describe('Fallback mode distribution', () => {
  const allKeys = Object.keys(FEATURES) as FeatureKey[];

  it('should have at least one REDIRECT fallback', () => {
    const redirectFeatures = allKeys.filter((k) => FEATURES[k].fallback === 'REDIRECT');
    expect(redirectFeatures.length).toBeGreaterThan(0);
  });

  it('should have at least one DISABLE fallback', () => {
    const disableFeatures = allKeys.filter((k) => FEATURES[k].fallback === 'DISABLE');
    expect(disableFeatures.length).toBeGreaterThan(0);
  });

  it('should have at least one HIDE fallback', () => {
    const hideFeatures = allKeys.filter((k) => FEATURES[k].fallback === 'HIDE');
    expect(hideFeatures.length).toBeGreaterThan(0);
  });
});

// ─── isValidFeatureKey ───────────────────────────────────────────────────────

describe('isValidFeatureKey', () => {
  it('should return true for all known feature keys', () => {
    const allKeys = Object.keys(FEATURES);
    allKeys.forEach((key) => {
      expect(isValidFeatureKey(key)).toBe(true);
    });
  });

  it('should return false for unknown keys', () => {
    expect(isValidFeatureKey('unknown_feature')).toBe(false);
    expect(isValidFeatureKey('')).toBe(false);
    expect(isValidFeatureKey('PLATFORM_ACCESS')).toBe(false); // uppercase
  });

  it('should return false for partial matches', () => {
    expect(isValidFeatureKey('platform')).toBe(false);
    expect(isValidFeatureKey('aria')).toBe(false);
  });
});

// ─── getFeatureDefinition ────────────────────────────────────────────────────

describe('getFeatureDefinition', () => {
  it('should return definition for valid key', () => {
    const def = getFeatureDefinition('aria_maths');
    expect(def).not.toBeNull();
    expect(def!.label).toContain('ARIA');
    expect(def!.requires).toContain('aria_maths');
  });

  it('should return null for unknown key', () => {
    expect(getFeatureDefinition('nonexistent')).toBeNull();
  });

  it('should return correct fallback for admin_facturation', () => {
    const def = getFeatureDefinition('admin_facturation');
    expect(def!.fallback).toBe('REDIRECT');
  });

  it('should return correct fallback for advanced_analytics', () => {
    const def = getFeatureDefinition('advanced_analytics');
    expect(def!.fallback).toBe('HIDE');
  });
});

// ─── getAllFeatureKeys ────────────────────────────────────────────────────────

describe('getAllFeatureKeys', () => {
  it('should return all 10 feature keys', () => {
    const keys = getAllFeatureKeys();
    expect(keys).toHaveLength(10);
  });

  it('should include platform_access', () => {
    expect(getAllFeatureKeys()).toContain('platform_access');
  });

  it('should include aria_maths and aria_nsi', () => {
    const keys = getAllFeatureKeys();
    expect(keys).toContain('aria_maths');
    expect(keys).toContain('aria_nsi');
  });

  it('should return an array of strings', () => {
    const keys = getAllFeatureKeys();
    keys.forEach((key) => {
      expect(typeof key).toBe('string');
    });
  });
});
