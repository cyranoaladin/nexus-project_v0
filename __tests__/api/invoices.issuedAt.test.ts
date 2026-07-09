/**
 * P1 #2 — issuedAt round-trip validation
 *
 * Cubic cases: 2024-02-31 rolls to March, 2023-02-29 is not a leap year,
 * timezone-less datetimes are environment-dependent.
 */

import { z } from 'zod';

// Extract the validation logic to test it directly
function isStrictDateString(v: string): boolean {
  const dateOnlyMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, yearStr, monthStr, dayStr] = dateOnlyMatch;
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
  }
  const datetimeMatch = v.match(/^(\d{4})-(\d{2})-(\d{2})T.+$/);
  if (datetimeMatch) {
    if (!/[Zz]$|[+-]\d{2}:\d{2}$/.test(v)) return false;
    return !isNaN(Date.parse(v));
  }
  return false;
}

const strictDateSchema = z.string().refine(isStrictDateString, {
  message: 'Date invalide',
});

describe('issuedAt strict date validation', () => {
  describe('YYYY-MM-DD round-trip (rejects rolled-over dates)', () => {
    it('accepts valid date 2024-01-15', () => {
      expect(strictDateSchema.safeParse('2024-01-15').success).toBe(true);
    });

    it('accepts leap year date 2024-02-29', () => {
      expect(strictDateSchema.safeParse('2024-02-29').success).toBe(true);
    });

    it('rejects 2024-02-31 (February never has 31 days)', () => {
      expect(strictDateSchema.safeParse('2024-02-31').success).toBe(false);
    });

    it('rejects 2023-02-29 (2023 is not a leap year)', () => {
      expect(strictDateSchema.safeParse('2023-02-29').success).toBe(false);
    });

    it('rejects 2024-04-31 (April has 30 days)', () => {
      expect(strictDateSchema.safeParse('2024-04-31').success).toBe(false);
    });

    it('rejects 2024-13-01 (month 13 does not exist)', () => {
      expect(strictDateSchema.safeParse('2024-13-01').success).toBe(false);
    });

    it('rejects 2024-00-15 (month 0 does not exist)', () => {
      expect(strictDateSchema.safeParse('2024-00-15').success).toBe(false);
    });
  });

  describe('datetime requires timezone offset', () => {
    it('accepts ISO datetime with Z', () => {
      expect(strictDateSchema.safeParse('2024-01-15T10:30:00Z').success).toBe(true);
    });

    it('accepts ISO datetime with +01:00 offset', () => {
      expect(strictDateSchema.safeParse('2024-01-15T10:30:00+01:00').success).toBe(true);
    });

    it('accepts ISO datetime with -05:00 offset', () => {
      expect(strictDateSchema.safeParse('2024-01-15T10:30:00-05:00').success).toBe(true);
    });

    it('rejects timezone-less datetime 2024-01-01T12:00:00', () => {
      expect(strictDateSchema.safeParse('2024-01-01T12:00:00').success).toBe(false);
    });

    it('rejects timezone-less datetime with milliseconds', () => {
      expect(strictDateSchema.safeParse('2024-01-01T12:00:00.000').success).toBe(false);
    });
  });

  describe('rejects non-date strings', () => {
    it('rejects empty string', () => {
      expect(strictDateSchema.safeParse('').success).toBe(false);
    });

    it('rejects random text', () => {
      expect(strictDateSchema.safeParse('not-a-date').success).toBe(false);
    });

    it('rejects partial date', () => {
      expect(strictDateSchema.safeParse('2024-01').success).toBe(false);
    });
  });
});
