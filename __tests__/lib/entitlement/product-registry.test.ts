/**
 * Tests for Entitlement Product Registry.
 *
 * Validates product definitions, code validation, duration computation,
 * and registry consistency.
 */

import {
  PRODUCT_REGISTRY,
  isValidProductCode,
  getProductDefinition,
  computeEndsAt,
} from '@/lib/entitlement/types';
import type { ProductCode, ProductDefinition } from '@/lib/entitlement/types';

// ─── Registry consistency ────────────────────────────────────────────────────

describe('PRODUCT_REGISTRY', () => {
  const allCodes = Object.keys(PRODUCT_REGISTRY) as ProductCode[];

  it('has at least 10 products', () => {
    expect(allCodes.length).toBeGreaterThanOrEqual(10);
  });

  it('every entry has code matching its key', () => {
    for (const code of allCodes) {
      expect(PRODUCT_REGISTRY[code].code).toBe(code);
    }
  });

  it('every entry has a non-empty label', () => {
    for (const code of allCodes) {
      expect(PRODUCT_REGISTRY[code].label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid category', () => {
    const validCategories = ['stage', 'premium', 'abonnement', 'credits', 'addon'];
    for (const code of allCodes) {
      expect(validCategories).toContain(PRODUCT_REGISTRY[code].category);
    }
  });

  it('every entry has features as an array', () => {
    for (const code of allCodes) {
      expect(Array.isArray(PRODUCT_REGISTRY[code].features)).toBe(true);
    }
  });

  it('credit packs have grantsCredits > 0', () => {
    const creditPacks = allCodes.filter((c) => PRODUCT_REGISTRY[c].category === 'credits');
    expect(creditPacks.length).toBeGreaterThanOrEqual(3);
    for (const code of creditPacks) {
      expect(PRODUCT_REGISTRY[code].grantsCredits).toBeGreaterThan(0);
    }
  });

  it('stages have defaultDurationDays > 0', () => {
    const stages = allCodes.filter((c) => PRODUCT_REGISTRY[c].category === 'stage');
    expect(stages.length).toBeGreaterThanOrEqual(2);
    for (const code of stages) {
      expect(PRODUCT_REGISTRY[code].defaultDurationDays).toBeGreaterThan(0);
    }
  });

  it('credit packs have no duration (permanent)', () => {
    const creditPacks = allCodes.filter((c) => PRODUCT_REGISTRY[c].category === 'credits');
    for (const code of creditPacks) {
      expect(PRODUCT_REGISTRY[code].defaultDurationDays).toBeNull();
    }
  });
});

// ─── isValidProductCode ──────────────────────────────────────────────────────

describe('isValidProductCode', () => {
  it('returns true for known codes', () => {
    expect(isValidProductCode('STAGE_MATHS_P1')).toBe(true);
    expect(isValidProductCode('PREMIUM_LITE')).toBe(true);
    expect(isValidProductCode('CREDIT_PACK_10')).toBe(true);
  });

  it('returns false for unknown codes', () => {
    expect(isValidProductCode('UNKNOWN_PRODUCT')).toBe(false);
    expect(isValidProductCode('')).toBe(false);
    expect(isValidProductCode('stage_maths_p1')).toBe(false); // case-sensitive
  });
});

// ─── getProductDefinition ────────────────────────────────────────────────────

describe('getProductDefinition', () => {
  it('returns definition for known code', () => {
    const def = getProductDefinition('PREMIUM_LITE');
    expect(def).not.toBeNull();
    expect(def!.code).toBe('PREMIUM_LITE');
    expect(def!.category).toBe('premium');
    expect(def!.features).toContain('ai_feedback');
  });

  it('returns null for unknown code', () => {
    expect(getProductDefinition('DOES_NOT_EXIST')).toBeNull();
  });

  it('CREDIT_PACK_10 grants 10 credits', () => {
    const def = getProductDefinition('CREDIT_PACK_10');
    expect(def!.grantsCredits).toBe(10);
  });

  it('ABONNEMENT_IMMERSION has platform_access feature', () => {
    const def = getProductDefinition('ABONNEMENT_IMMERSION');
    expect(def!.features).toContain('platform_access');
    expect(def!.features).toContain('immersion_mode');
  });
});

// ─── computeEndsAt ───────────────────────────────────────────────────────────

describe('computeEndsAt', () => {
  it('returns null for permanent products (no duration)', () => {
    const def = getProductDefinition('CREDIT_PACK_10')!;
    expect(computeEndsAt(def)).toBeNull();
  });

  it('returns correct date for 90-day product', () => {
    const def = getProductDefinition('STAGE_MATHS_P1')!;
    const startsAt = new Date('2026-01-01T00:00:00Z');
    const endsAt = computeEndsAt(def, startsAt);
    expect(endsAt).not.toBeNull();
    // 90 days later
    const expected = new Date('2026-04-01T00:00:00Z');
    expect(endsAt!.getTime()).toBe(expected.getTime());
  });

  it('returns correct date for 30-day product', () => {
    const def = getProductDefinition('ABONNEMENT_ESSENTIEL')!;
    const startsAt = new Date('2026-02-01T00:00:00Z');
    const endsAt = computeEndsAt(def, startsAt);
    expect(endsAt).not.toBeNull();
    const expected = new Date('2026-03-03T00:00:00Z');
    expect(endsAt!.getTime()).toBe(expected.getTime());
  });

  it('returns correct date for 365-day product', () => {
    const def = getProductDefinition('PREMIUM_FULL')!;
    const startsAt = new Date('2026-01-01T00:00:00Z');
    const endsAt = computeEndsAt(def, startsAt);
    expect(endsAt).not.toBeNull();
    const expected = new Date('2027-01-01T00:00:00Z');
    expect(endsAt!.getTime()).toBe(expected.getTime());
  });

  it('defaults to now if no startsAt provided', () => {
    const def = getProductDefinition('STAGE_MATHS_P1')!;
    const before = Date.now();
    const endsAt = computeEndsAt(def);
    const after = Date.now();
    expect(endsAt).not.toBeNull();
    // Should be ~90 days from now
    const expectedMin = before + 90 * 24 * 60 * 60 * 1000;
    const expectedMax = after + 90 * 24 * 60 * 60 * 1000;
    expect(endsAt!.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(endsAt!.getTime()).toBeLessThanOrEqual(expectedMax);
  });
});
