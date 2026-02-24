/**
 * Common Validation Schemas — Complete Test Suite
 *
 * Tests: idSchema, emailSchema, paginationSchema, dateRangeSchema,
 *        searchSchema, amountSchema, phoneSchema, passwordSchema,
 *        optionalString, nonEmptyString
 *
 * Source: lib/validation/common.ts
 */

import {
  idSchema,
  emailSchema,
  paginationSchema,
  dateRangeSchema,
  searchSchema,
  amountSchema,
  phoneSchema,
  passwordSchema,
  optionalString,
  nonEmptyString,
} from '@/lib/validation/common';

// ─── idSchema ────────────────────────────────────────────────────────────────

describe('idSchema', () => {
  it('should accept valid CUID', () => {
    expect(idSchema.safeParse('clh1234567890abcdefghij').success).toBe(true);
  });

  it('should reject empty string', () => {
    expect(idSchema.safeParse('').success).toBe(false);
  });

  it('should reject non-CUID format', () => {
    expect(idSchema.safeParse('not-a-cuid').success).toBe(false);
    expect(idSchema.safeParse('12345').success).toBe(false);
  });

  it('should reject null and undefined', () => {
    expect(idSchema.safeParse(null).success).toBe(false);
    expect(idSchema.safeParse(undefined).success).toBe(false);
  });

  it('should reject number', () => {
    expect(idSchema.safeParse(123).success).toBe(false);
  });
});

// ─── emailSchema ─────────────────────────────────────────────────────────────

describe('emailSchema', () => {
  it('should accept valid email', () => {
    expect(emailSchema.safeParse('test@example.com').success).toBe(true);
  });

  it('should lowercase email', () => {
    const result = emailSchema.safeParse('Test@EXAMPLE.COM');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('test@example.com');
  });

  it('should reject invalid email', () => {
    expect(emailSchema.safeParse('not-an-email').success).toBe(false);
    expect(emailSchema.safeParse('@example.com').success).toBe(false);
    expect(emailSchema.safeParse('test@').success).toBe(false);
  });

  it('should accept email with subdomain', () => {
    expect(emailSchema.safeParse('user@mail.example.co.uk').success).toBe(true);
  });

  it('should accept email with plus sign', () => {
    expect(emailSchema.safeParse('user+tag@example.com').success).toBe(true);
  });
});

// ─── paginationSchema ────────────────────────────────────────────────────────

describe('paginationSchema', () => {
  it('should use defaults when no values provided', () => {
    const result = paginationSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });

  it('should accept valid limit and offset', () => {
    const result = paginationSchema.safeParse({ limit: 50, offset: 10 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(50);
      expect(result.data.offset).toBe(10);
    }
  });

  it('should reject limit > 100', () => {
    expect(paginationSchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it('should reject limit < 1', () => {
    expect(paginationSchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('should reject negative offset', () => {
    expect(paginationSchema.safeParse({ offset: -1 }).success).toBe(false);
  });

  it('should coerce string values to numbers', () => {
    const result = paginationSchema.safeParse({ limit: '10', offset: '5' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(5);
    }
  });
});

// ─── dateRangeSchema ─────────────────────────────────────────────────────────

describe('dateRangeSchema', () => {
  it('should accept valid date range', () => {
    const result = dateRangeSchema.safeParse({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(result.success).toBe(true);
  });

  it('should reject endDate before startDate', () => {
    const result = dateRangeSchema.safeParse({
      startDate: '2026-12-31',
      endDate: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('should accept same start and end date', () => {
    const result = dateRangeSchema.safeParse({
      startDate: '2026-06-15',
      endDate: '2026-06-15',
    });
    expect(result.success).toBe(true);
  });

  it('should coerce string dates to Date objects', () => {
    const result = dateRangeSchema.safeParse({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startDate).toBeInstanceOf(Date);
      expect(result.data.endDate).toBeInstanceOf(Date);
    }
  });
});

// ─── searchSchema ────────────────────────────────────────────────────────────

describe('searchSchema', () => {
  it('should accept valid search query', () => {
    const result = searchSchema.safeParse({ q: 'test' });
    expect(result.success).toBe(true);
  });

  it('should reject empty search query', () => {
    expect(searchSchema.safeParse({ q: '' }).success).toBe(false);
  });

  it('should reject search query > 200 chars', () => {
    expect(searchSchema.safeParse({ q: 'a'.repeat(201) }).success).toBe(false);
  });

  it('should include pagination defaults', () => {
    const result = searchSchema.safeParse({ q: 'test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.offset).toBe(0);
    }
  });
});

// ─── amountSchema ────────────────────────────────────────────────────────────

describe('amountSchema', () => {
  it('should accept positive integer', () => {
    expect(amountSchema.safeParse(15000).success).toBe(true);
  });

  it('should reject zero', () => {
    expect(amountSchema.safeParse(0).success).toBe(false);
  });

  it('should reject negative', () => {
    expect(amountSchema.safeParse(-100).success).toBe(false);
  });

  it('should reject non-integer', () => {
    expect(amountSchema.safeParse(150.5).success).toBe(false);
  });

  it('should reject string', () => {
    expect(amountSchema.safeParse('100').success).toBe(false);
  });
});

// ─── phoneSchema ─────────────────────────────────────────────────────────────

describe('phoneSchema', () => {
  it('should accept international format with +', () => {
    expect(phoneSchema.safeParse('+21612345678').success).toBe(true);
  });

  it('should accept international format without +', () => {
    expect(phoneSchema.safeParse('21612345678').success).toBe(true);
  });

  it('should reject letters', () => {
    expect(phoneSchema.safeParse('abc12345').success).toBe(false);
  });

  it('should reject empty string', () => {
    expect(phoneSchema.safeParse('').success).toBe(false);
  });

  it('should reject too short', () => {
    expect(phoneSchema.safeParse('+1').success).toBe(false);
  });

  it('should reject starting with 0', () => {
    expect(phoneSchema.safeParse('0612345678').success).toBe(false);
  });
});

// ─── passwordSchema ──────────────────────────────────────────────────────────

describe('passwordSchema', () => {
  it('should accept valid password (letters + numbers, 8+ chars)', () => {
    expect(passwordSchema.safeParse('Password1').success).toBe(true);
  });

  it('should reject < 8 chars', () => {
    expect(passwordSchema.safeParse('Pass1').success).toBe(false);
  });

  it('should reject no letters', () => {
    expect(passwordSchema.safeParse('12345678').success).toBe(false);
  });

  it('should reject no numbers', () => {
    expect(passwordSchema.safeParse('PasswordOnly').success).toBe(false);
  });

  it('should accept complex password', () => {
    expect(passwordSchema.safeParse('C0mpl3x!P@ss').success).toBe(true);
  });

  it('should accept exactly 8 chars', () => {
    expect(passwordSchema.safeParse('Abcdef1!').success).toBe(true);
  });
});

// ─── optionalString ──────────────────────────────────────────────────────────

describe('optionalString', () => {
  it('should accept undefined', () => {
    const result = optionalString.safeParse(undefined);
    expect(result.success).toBe(true);
  });

  it('should accept valid string', () => {
    const result = optionalString.safeParse('hello');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('hello');
  });

  it('should trim whitespace', () => {
    const result = optionalString.safeParse('  hello  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('hello');
  });

  it('should handle empty string', () => {
    const result = optionalString.safeParse('');
    expect(result.success).toBe(true);
    // Empty string is transformed to undefined via .or(z.literal('').transform(...))
    // or kept as empty string depending on which branch matches first
    if (result.success) {
      expect([undefined, ''].includes(result.data as any)).toBe(true);
    }
  });
});

// ─── nonEmptyString ──────────────────────────────────────────────────────────

describe('nonEmptyString', () => {
  it('should accept non-empty string', () => {
    expect(nonEmptyString.safeParse('hello').success).toBe(true);
  });

  it('should reject empty string', () => {
    expect(nonEmptyString.safeParse('').success).toBe(false);
  });

  it('should reject whitespace-only string', () => {
    expect(nonEmptyString.safeParse('   ').success).toBe(false);
  });

  it('should trim whitespace', () => {
    const result = nonEmptyString.safeParse('  hello  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('hello');
  });
});
