/**
 * P1 #2 — issuedAt round-trip validation
 *
 * Cubic cases: 2024-02-31 rolls to March, 2023-02-29 is not a leap year,
 * timezone-less datetimes are environment-dependent.
 * Round 2: datetime round-trip (2024-02-31T00:00:00Z, 2023-02-29T12:00:00+01:00).
 */

import { z } from 'zod';
import { isStrictDateString, civilDateSchema } from '@/lib/validation/common';

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

  describe('datetime round-trip (rejects rolled-over datetimes)', () => {
    it('rejects 2024-02-31T00:00:00Z (Feb 31 rolls to March)', () => {
      expect(strictDateSchema.safeParse('2024-02-31T00:00:00Z').success).toBe(false);
    });

    it('rejects 2023-02-29T12:00:00+01:00 (2023 is not a leap year)', () => {
      expect(strictDateSchema.safeParse('2023-02-29T12:00:00+01:00').success).toBe(false);
    });
  });

  describe('datetime time portion validation', () => {
    it('rejects 2024-01-15T24:00:00Z (hour 24 is invalid)', () => {
      expect(strictDateSchema.safeParse('2024-01-15T24:00:00Z').success).toBe(false);
    });

    it('rejects 2024-01-15T12:60:00Z (minute 60 is invalid)', () => {
      expect(strictDateSchema.safeParse('2024-01-15T12:60:00Z').success).toBe(false);
    });

    it('rejects 2024-01-15T12:00:60Z (second 60 is invalid)', () => {
      expect(strictDateSchema.safeParse('2024-01-15T12:00:60Z').success).toBe(false);
    });
  });

  describe('HH:MM without seconds', () => {
    it('rejects 2024-01-15T24:00Z (hour 24 without seconds)', () => {
      expect(strictDateSchema.safeParse('2024-01-15T24:00Z').success).toBe(false);
    });

    it('rejects 2024-01-15T24:00+01:00 (hour 24 with offset)', () => {
      expect(strictDateSchema.safeParse('2024-01-15T24:00+01:00').success).toBe(false);
    });

    it('accepts 2024-01-15T12:30Z (valid HH:MM)', () => {
      expect(strictDateSchema.safeParse('2024-01-15T12:30Z').success).toBe(true);
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

describe('civilDateSchema (date-only strict)', () => {
  it('accepts 2024-01-15', () => {
    expect(civilDateSchema.safeParse('2024-01-15').success).toBe(true);
  });

  it('rejects 2024-01-15T23:30:00+01:00 (datetime not allowed)', () => {
    expect(civilDateSchema.safeParse('2024-01-15T23:30:00+01:00').success).toBe(false);
  });

  it('rejects 2024-02-31 (round-trip: February never has 31 days)', () => {
    expect(civilDateSchema.safeParse('2024-02-31').success).toBe(false);
  });
});
