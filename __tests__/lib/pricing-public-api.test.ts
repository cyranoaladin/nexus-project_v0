/**
 * Verify that the public pricing API never exposes internal `_*` fields,
 * and that isFormatPriceValidated works for both real and synthetic data.
 */
import {
  getStageFormat,
  getStageFormats,
  isFormatPriceValidated,
} from '@/lib/pricing';

describe('Pricing public API — no internal fields', () => {
  it('getStageFormat() returns an object without any `_` prefixed key', () => {
    const format = getStageFormat('intensif-renfort');
    expect(format).toBeDefined();
    const keys = Object.keys(format!);
    const internalKeys = keys.filter((k) => k.startsWith('_'));
    expect(internalKeys).toEqual([]);
  });

  it('getStageFormat() strips any `_` field if present in JSON', () => {
    // express-vacances no longer has _price_status, but this test guards future additions
    const format = getStageFormat('express-vacances');
    expect(format).toBeDefined();
    const keys = Object.keys(format!);
    expect(keys.every((k) => !k.startsWith('_'))).toBe(true);
  });

  it('getStageFormats() returns no objects with `_` prefixed keys', () => {
    const formats = getStageFormats();
    for (const format of formats) {
      const internalKeys = Object.keys(format).filter((k) => k.startsWith('_'));
      expect(internalKeys).toEqual([]);
    }
  });

  it('express-vacances is now validated (price is firm)', () => {
    expect(isFormatPriceValidated('express-vacances')).toBe(true);
  });

  it('isFormatPriceValidated() works with public StageFormat object', () => {
    const format = getStageFormat('express-vacances')!;
    expect(isFormatPriceValidated(format)).toBe(true);
  });

  it('express-vacances has no floor_exception (46.7 TND/h ≥ 45 floor)', () => {
    const format = getStageFormat('express-vacances')!;
    expect(format).not.toHaveProperty('floor_exception');
    expect(format.price_per_student_hour).toBeGreaterThanOrEqual(45);
  });

  it('express-vacances price is 420 TND', () => {
    const format = getStageFormat('express-vacances')!;
    expect(format.price_per_student).toBe(420);
  });
});
