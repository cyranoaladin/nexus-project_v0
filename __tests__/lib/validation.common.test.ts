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

describe('validation common', () => {
  it('validates cuid id', () => {
    expect(idSchema.safeParse('ckx1a2b3c4d5e6f7g8h9i0j1').success).toBe(true);
    expect(idSchema.safeParse('123').success).toBe(false);
  });

  it('lowercases email', () => {
    const res = emailSchema.parse('USER@EXAMPLE.COM');
    expect(res).toBe('user@example.com');
  });

  it('parses pagination defaults', () => {
    const res = paginationSchema.parse({});
    expect(res.limit).toBe(20);
    expect(res.offset).toBe(0);
  });

  it('validates date range order', () => {
    const ok = dateRangeSchema.safeParse({ startDate: '2026-02-01', endDate: '2026-02-02' });
    expect(ok.success).toBe(true);
    const bad = dateRangeSchema.safeParse({ startDate: '2026-02-02', endDate: '2026-02-01' });
    expect(bad.success).toBe(false);
  });

  it('validates search schema with pagination', () => {
    const res = searchSchema.parse({ q: 'math', limit: '10', offset: '0' });
    expect(res.limit).toBe(10);
    expect(res.q).toBe('math');
  });

  it('validates amount/phone/password', () => {
    expect(amountSchema.safeParse(10).success).toBe(true);
    expect(amountSchema.safeParse(0).success).toBe(false);
    expect(phoneSchema.safeParse('+33612345678').success).toBe(true);
    expect(phoneSchema.safeParse('abc').success).toBe(false);
    expect(passwordSchema.safeParse('abc12345').success).toBe(true);
    expect(passwordSchema.safeParse('abcdefghi').success).toBe(false);
  });

  it('handles optional and required strings', () => {
    expect(optionalString.parse('')).toBe('');
    expect(optionalString.parse(' test ')).toBe('test');
    expect(nonEmptyString.safeParse('  ').success).toBe(false);
  });
});
