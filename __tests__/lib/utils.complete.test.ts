/**
 * Utils — Complete Test Suite
 *
 * Tests: cn, formatPrice, formatDate, parsePaymentMetadata, mergePaymentMetadata
 *
 * Source: lib/utils.ts
 */

import { cn, formatPrice, formatDate, parsePaymentMetadata, mergePaymentMetadata } from '@/lib/utils';

// ─── cn ──────────────────────────────────────────────────────────────────────

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('should handle undefined and null', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end');
  });

  it('should handle empty input', () => {
    expect(cn()).toBe('');
  });

  it('should handle array input', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });
});

// ─── formatPrice ─────────────────────────────────────────────────────────────

describe('formatPrice', () => {
  it('should format price with default currency TND', () => {
    expect(formatPrice(100)).toBe('100 TND');
  });

  it('should format price with custom currency', () => {
    expect(formatPrice(50, 'EUR')).toBe('50 EUR');
  });

  it('should handle zero price', () => {
    expect(formatPrice(0)).toBe('0 TND');
  });

  it('should handle decimal prices', () => {
    expect(formatPrice(99.99)).toBe('99.99 TND');
  });

  it('should handle negative prices', () => {
    expect(formatPrice(-10)).toBe('-10 TND');
  });
});

// ─── formatDate ──────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('should format date in French locale', () => {
    const date = new Date('2026-03-15T00:00:00Z');
    const formatted = formatDate(date);
    expect(formatted).toContain('2026');
    expect(formatted).toContain('mars');
  });

  it('should include day, month, and year', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const formatted = formatDate(date);
    expect(formatted).toContain('janvier');
    expect(formatted).toContain('2026');
  });
});

// ─── parsePaymentMetadata ────────────────────────────────────────────────────

describe('parsePaymentMetadata', () => {
  it('should return empty object for null', () => {
    expect(parsePaymentMetadata(null)).toEqual({});
  });

  it('should return empty object for undefined', () => {
    expect(parsePaymentMetadata(undefined)).toEqual({});
  });

  it('should return empty object for empty string', () => {
    expect(parsePaymentMetadata('')).toEqual({});
  });

  it('should parse valid JSON string', () => {
    const result = parsePaymentMetadata('{"key":"value"}');
    expect(result).toEqual({ key: 'value' });
  });

  it('should return empty object for invalid JSON string', () => {
    expect(parsePaymentMetadata('not-json')).toEqual({});
  });

  it('should return empty object for JSON array string', () => {
    expect(parsePaymentMetadata('[1,2,3]')).toEqual({});
  });

  it('should return empty object for JSON primitive string', () => {
    expect(parsePaymentMetadata('"just a string"')).toEqual({});
  });

  it('should pass through plain objects', () => {
    const obj = { amount: 100, currency: 'TND' };
    expect(parsePaymentMetadata(obj)).toEqual(obj);
  });

  it('should return empty object for arrays', () => {
    expect(parsePaymentMetadata([1, 2, 3])).toEqual({});
  });

  it('should return empty object for numbers', () => {
    expect(parsePaymentMetadata(42)).toEqual({});
  });
});

// ─── mergePaymentMetadata ────────────────────────────────────────────────────

describe('mergePaymentMetadata', () => {
  it('should merge additions into existing object', () => {
    const result = mergePaymentMetadata({ a: 1 }, { b: 2 });
    expect(result.value).toEqual({ a: 1, b: 2 });
    expect(result.shouldStringify).toBe(false);
  });

  it('should merge additions into existing JSON string', () => {
    const result = mergePaymentMetadata('{"a":1}', { b: 2 });
    expect(JSON.parse(result.value as string)).toEqual({ a: 1, b: 2 });
    expect(result.shouldStringify).toBe(true);
  });

  it('should override existing keys with additions', () => {
    const result = mergePaymentMetadata({ a: 1, b: 2 }, { b: 3 });
    expect(result.value).toEqual({ a: 1, b: 3 });
  });

  it('should handle null existing metadata', () => {
    const result = mergePaymentMetadata(null, { key: 'value' });
    expect(result.value).toEqual({ key: 'value' });
    expect(result.shouldStringify).toBe(false);
  });

  it('should handle empty additions', () => {
    const result = mergePaymentMetadata({ a: 1 }, {});
    expect(result.value).toEqual({ a: 1 });
  });

  it('should stringify when existing was a string', () => {
    const result = mergePaymentMetadata('{}', { new: true });
    expect(result.shouldStringify).toBe(true);
    expect(typeof result.value).toBe('string');
  });

  it('should not stringify when existing was an object', () => {
    const result = mergePaymentMetadata({}, { new: true });
    expect(result.shouldStringify).toBe(false);
    expect(typeof result.value).toBe('object');
  });
});
