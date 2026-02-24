/**
 * Entitlement Types & Product Registry — Complete Test Suite
 *
 * Tests: PRODUCT_REGISTRY integrity, isValidProductCode, getProductDefinition,
 *        computeEndsAt, ActivationMode consistency
 *
 * Source: lib/entitlement/types.ts
 */

import {
  PRODUCT_REGISTRY,
  isValidProductCode,
  getProductDefinition,
  computeEndsAt,
  type ProductCode,
  type ProductDefinition,
} from '@/lib/entitlement/types';

// ─── Registry Integrity ──────────────────────────────────────────────────────

describe('PRODUCT_REGISTRY integrity', () => {
  const allCodes = Object.keys(PRODUCT_REGISTRY) as ProductCode[];

  it('should have at least 10 product codes', () => {
    expect(allCodes.length).toBeGreaterThanOrEqual(10);
  });

  it('every entry should have code matching its key', () => {
    allCodes.forEach((code) => {
      expect(PRODUCT_REGISTRY[code].code).toBe(code);
    });
  });

  it('every entry should have a non-empty label', () => {
    allCodes.forEach((code) => {
      expect(PRODUCT_REGISTRY[code].label.length).toBeGreaterThan(0);
    });
  });

  it('every entry should have a valid category', () => {
    const validCategories = ['stage', 'premium', 'abonnement', 'credits', 'addon'];
    allCodes.forEach((code) => {
      expect(validCategories).toContain(PRODUCT_REGISTRY[code].category);
    });
  });

  it('every entry should have a valid mode', () => {
    const validModes = ['SINGLE', 'EXTEND', 'STACK'];
    allCodes.forEach((code) => {
      expect(validModes).toContain(PRODUCT_REGISTRY[code].mode);
    });
  });

  it('every entry should have features as an array', () => {
    allCodes.forEach((code) => {
      expect(Array.isArray(PRODUCT_REGISTRY[code].features)).toBe(true);
    });
  });

  it('credit packs should have STACK mode', () => {
    const creditPacks = allCodes.filter((c) => c.startsWith('CREDIT_PACK'));
    creditPacks.forEach((code) => {
      expect(PRODUCT_REGISTRY[code].mode).toBe('STACK');
    });
  });

  it('credit packs should grant credits > 0', () => {
    const creditPacks = allCodes.filter((c) => c.startsWith('CREDIT_PACK'));
    creditPacks.forEach((code) => {
      expect(PRODUCT_REGISTRY[code].grantsCredits).toBeGreaterThan(0);
    });
  });

  it('credit packs should have null defaultDurationDays (permanent)', () => {
    const creditPacks = allCodes.filter((c) => c.startsWith('CREDIT_PACK'));
    creditPacks.forEach((code) => {
      expect(PRODUCT_REGISTRY[code].defaultDurationDays).toBeNull();
    });
  });

  it('stages should have SINGLE mode', () => {
    const stages = allCodes.filter((c) => c.startsWith('STAGE_'));
    stages.forEach((code) => {
      expect(PRODUCT_REGISTRY[code].mode).toBe('SINGLE');
    });
  });

  it('abonnements should have EXTEND mode', () => {
    const abonnements = allCodes.filter((c) => c.startsWith('ABONNEMENT_'));
    abonnements.forEach((code) => {
      expect(PRODUCT_REGISTRY[code].mode).toBe('EXTEND');
    });
  });

  it('abonnements should have 30-day duration', () => {
    const abonnements = allCodes.filter((c) => c.startsWith('ABONNEMENT_'));
    abonnements.forEach((code) => {
      expect(PRODUCT_REGISTRY[code].defaultDurationDays).toBe(30);
    });
  });

  it('ARIA addons should have EXTEND mode', () => {
    const addons = allCodes.filter((c) => c.startsWith('ARIA_ADDON'));
    addons.forEach((code) => {
      expect(PRODUCT_REGISTRY[code].mode).toBe('EXTEND');
    });
  });
});

// ─── isValidProductCode ──────────────────────────────────────────────────────

describe('isValidProductCode', () => {
  it('should return true for all known product codes', () => {
    const allCodes = Object.keys(PRODUCT_REGISTRY);
    allCodes.forEach((code) => {
      expect(isValidProductCode(code)).toBe(true);
    });
  });

  it('should return false for unknown codes', () => {
    expect(isValidProductCode('UNKNOWN_PRODUCT')).toBe(false);
    expect(isValidProductCode('')).toBe(false);
    expect(isValidProductCode('stage_maths_p1')).toBe(false); // lowercase
  });

  it('should return false for partial matches', () => {
    expect(isValidProductCode('STAGE')).toBe(false);
    expect(isValidProductCode('CREDIT_PACK')).toBe(false);
  });
});

// ─── getProductDefinition ────────────────────────────────────────────────────

describe('getProductDefinition', () => {
  it('should return definition for valid code', () => {
    const def = getProductDefinition('PREMIUM_LITE');
    expect(def).not.toBeNull();
    expect(def!.code).toBe('PREMIUM_LITE');
    expect(def!.label).toContain('Premium');
    expect(def!.features).toContain('ai_feedback');
  });

  it('should return null for unknown code', () => {
    expect(getProductDefinition('INVALID')).toBeNull();
  });

  it('should return correct features for ABONNEMENT_HYBRIDE', () => {
    const def = getProductDefinition('ABONNEMENT_HYBRIDE');
    expect(def).not.toBeNull();
    expect(def!.features).toContain('platform_access');
    expect(def!.features).toContain('hybrid_sessions');
    expect(def!.features).toContain('credits_use');
  });

  it('should return correct grantsCredits for credit packs', () => {
    expect(getProductDefinition('CREDIT_PACK_5')!.grantsCredits).toBe(5);
    expect(getProductDefinition('CREDIT_PACK_10')!.grantsCredits).toBe(10);
    expect(getProductDefinition('CREDIT_PACK_20')!.grantsCredits).toBe(20);
  });

  it('should return null grantsCredits for stages', () => {
    expect(getProductDefinition('STAGE_MATHS_P1')!.grantsCredits).toBeNull();
  });
});

// ─── computeEndsAt ───────────────────────────────────────────────────────────

describe('computeEndsAt', () => {
  it('should return null for permanent products (null duration)', () => {
    const product = getProductDefinition('CREDIT_PACK_5')!;
    expect(computeEndsAt(product)).toBeNull();
  });

  it('should compute correct end date for 30-day product', () => {
    const product = getProductDefinition('ABONNEMENT_ESSENTIEL')!;
    const startsAt = new Date('2026-01-01T00:00:00Z');
    const endsAt = computeEndsAt(product, startsAt);
    expect(endsAt).not.toBeNull();
    expect(endsAt!.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('should compute correct end date for 90-day product', () => {
    const product = getProductDefinition('STAGE_MATHS_P1')!;
    const startsAt = new Date('2026-01-01T00:00:00Z');
    const endsAt = computeEndsAt(product, startsAt);
    expect(endsAt).not.toBeNull();
    // 90 days from Jan 1 = April 1
    const expected = new Date(startsAt.getTime() + 90 * 24 * 60 * 60 * 1000);
    expect(endsAt!.getTime()).toBe(expected.getTime());
  });

  it('should compute correct end date for 365-day product', () => {
    const product = getProductDefinition('PREMIUM_LITE')!;
    const startsAt = new Date('2026-01-01T00:00:00Z');
    const endsAt = computeEndsAt(product, startsAt);
    expect(endsAt).not.toBeNull();
    const expected = new Date(startsAt.getTime() + 365 * 24 * 60 * 60 * 1000);
    expect(endsAt!.getTime()).toBe(expected.getTime());
  });

  it('should default to now when no startsAt provided', () => {
    const product = getProductDefinition('ABONNEMENT_ESSENTIEL')!;
    const before = Date.now();
    const endsAt = computeEndsAt(product);
    const after = Date.now();
    expect(endsAt).not.toBeNull();
    // Should be ~30 days from now
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    expect(endsAt!.getTime()).toBeGreaterThanOrEqual(before + thirtyDaysMs);
    expect(endsAt!.getTime()).toBeLessThanOrEqual(after + thirtyDaysMs);
  });
});
