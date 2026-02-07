import { cn, formatPrice, formatDate, parsePaymentMetadata, mergePaymentMetadata } from '@/lib/utils';

describe('Utils', () => {
  describe('cn', () => {
    it('merges class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    });
  });

  describe('formatPrice', () => {
    it('formats price with default currency', () => {
      expect(formatPrice(100)).toBe('100 TND');
    });

    it('formats price with custom currency', () => {
      expect(formatPrice(50, 'EUR')).toBe('50 EUR');
    });
  });

  describe('formatDate', () => {
    it('formats date in French format', () => {
      const date = new Date('2024-01-15');
      const formatted = formatDate(date);
      expect(formatted).toContain('janvier');
      expect(formatted).toContain('2024');
    });
  });

  describe('parsePaymentMetadata', () => {
    it('returns empty object for null/undefined', () => {
      expect(parsePaymentMetadata(null)).toEqual({});
      expect(parsePaymentMetadata(undefined)).toEqual({});
    });

    it('parses valid JSON string', () => {
      const json = '{"orderId":"123","provider":"konnect"}';
      expect(parsePaymentMetadata(json)).toEqual({
        orderId: '123',
        provider: 'konnect'
      });
    });

    it('returns empty object for invalid JSON string', () => {
      expect(parsePaymentMetadata('invalid json')).toEqual({});
    });

    it('returns empty object for JSON array string', () => {
      expect(parsePaymentMetadata('[1,2,3]')).toEqual({});
    });

    it('returns empty object for JSON primitive string', () => {
      expect(parsePaymentMetadata('"string"')).toEqual({});
      expect(parsePaymentMetadata('123')).toEqual({});
    });

    it('accepts valid object directly', () => {
      const obj = { orderId: '123', provider: 'konnect' };
      expect(parsePaymentMetadata(obj)).toEqual(obj);
    });

    it('returns empty object for array', () => {
      expect(parsePaymentMetadata([1, 2, 3])).toEqual({});
    });

    it('returns empty object for primitives', () => {
      expect(parsePaymentMetadata(123)).toEqual({});
      expect(parsePaymentMetadata('plain string')).toEqual({});
      expect(parsePaymentMetadata(true)).toEqual({});
    });
  });

  describe('mergePaymentMetadata', () => {
    it('merges with empty existing metadata', () => {
      const result = mergePaymentMetadata(null, { newKey: 'newValue' });
      expect(result.value).toEqual({ newKey: 'newValue' });
      expect(result.shouldStringify).toBe(false);
    });

    it('merges with existing object metadata', () => {
      const existing = { orderId: '123' };
      const additions = { provider: 'konnect' };
      const result = mergePaymentMetadata(existing, additions);
      expect(result.value).toEqual({
        orderId: '123',
        provider: 'konnect'
      });
      expect(result.shouldStringify).toBe(false);
    });

    it('merges with existing string metadata and stringifies result', () => {
      const existing = '{"orderId":"123"}';
      const additions = { provider: 'konnect' };
      const result = mergePaymentMetadata(existing, additions);
      expect(result.value).toBe('{"orderId":"123","provider":"konnect"}');
      expect(result.shouldStringify).toBe(true);
    });

    it('overwrites existing keys', () => {
      const existing = { orderId: '123', status: 'pending' };
      const additions = { status: 'completed' };
      const result = mergePaymentMetadata(existing, additions);
      expect(result.value).toEqual({
        orderId: '123',
        status: 'completed'
      });
    });

    it('handles invalid existing metadata gracefully', () => {
      const result = mergePaymentMetadata('invalid json', { newKey: 'value' });
      expect(result.value).toBe('{"newKey":"value"}');
      expect(result.shouldStringify).toBe(true);
    });
  });
});
