/**
 * Verify that the public pricing API never exposes internal `_*` fields,
 * and that isFormatPriceValidated works for both real and synthetic data.
 */
import {
  getStageFormat,
  getStageFormats,
  isFormatPriceValidated,
  getCarte,
  getPublicCarte,
  getStageCalendar,
  getPublicStageCalendar,
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

  // docs/audits/2026-07-29-stages-page-internal-data-leak.md: getCarte() and
  // getStageCalendar() are passed unfiltered to "use client" components,
  // which serializes every field — including ones never rendered — into the
  // page's hydration payload. getPublicCarte()/getPublicStageCalendar() are
  // the versions safe to hand to a client component.
  it('getPublicCarte() strips `rationale` (never rendered, an internal pricing-strategy note)', () => {
    expect(getCarte()).toHaveProperty('rationale');
    const publicCarte = getPublicCarte();
    expect(publicCarte).not.toHaveProperty('rationale');
    // Everything actually displayed must still be there.
    expect(publicCarte.id).toBe(getCarte().id);
    expect(publicCarte.price_annual).toBe(getCarte().price_annual);
    expect(publicCarte.includes).toEqual(getCarte().includes);
  });

  it('getPublicStageCalendar() strips `pack_product_ids` (untyped, never rendered) but keeps `notes` (rendered for some entries, e.g. Ramadan hours)', () => {
    const rawCalendar = getStageCalendar() as unknown as Array<Record<string, unknown>>;
    const withPackIds = rawCalendar.find((entry) => 'pack_product_ids' in entry);
    expect(withPackIds).toBeDefined();

    const publicCalendar = getPublicStageCalendar() as unknown as Array<Record<string, unknown>>;
    for (const entry of publicCalendar) {
      expect(entry).not.toHaveProperty('pack_product_ids');
    }
    // notes is a real, displayed field for some entries — must not be stripped.
    const withNotes = publicCalendar.find((entry) => typeof entry.notes === 'string' && (entry.notes as string).length > 0);
    expect(withNotes).toBeDefined();
  });
});
