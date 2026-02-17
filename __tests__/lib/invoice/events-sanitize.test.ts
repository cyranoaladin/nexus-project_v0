/**
 * Tests for sanitizeEventDetails — ensures event details are JSON-safe,
 * flat, and bounded in size.
 */

import {
  sanitizeEventDetails,
  MAX_EVENT_DETAILS_SIZE,
  createInvoiceEvent,
} from '@/lib/invoice/types';

describe('sanitizeEventDetails', () => {
  it('returns null for null input', () => {
    expect(sanitizeEventDetails(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(sanitizeEventDetails(undefined)).toBeNull();
  });

  it('passes through short strings unchanged', () => {
    expect(sanitizeEventDetails('hello')).toBe('hello');
  });

  it('truncates strings exceeding MAX_EVENT_DETAILS_SIZE', () => {
    const longStr = 'x'.repeat(MAX_EVENT_DETAILS_SIZE + 100);
    const result = sanitizeEventDetails(longStr);
    expect(typeof result).toBe('string');
    expect((result as string).length).toBe(MAX_EVENT_DETAILS_SIZE);
  });

  it('returns null for arrays', () => {
    expect(sanitizeEventDetails([1, 2, 3])).toBeNull();
  });

  it('returns null for empty objects', () => {
    expect(sanitizeEventDetails({})).toBeNull();
  });

  it('preserves string values in objects', () => {
    const result = sanitizeEventDetails({ to: 'user@test.com' });
    expect(result).toEqual({ to: 'user@test.com' });
  });

  it('preserves number values in objects', () => {
    const result = sanitizeEventDetails({ count: 42 });
    expect(result).toEqual({ count: 42 });
  });

  it('preserves boolean values in objects', () => {
    const result = sanitizeEventDetails({ success: true });
    expect(result).toEqual({ success: true });
  });

  it('preserves null values in objects', () => {
    const result = sanitizeEventDetails({ ref: null });
    expect(result).toEqual({ ref: null });
  });

  it('removes undefined values from objects', () => {
    const result = sanitizeEventDetails({ a: 'ok', b: undefined });
    expect(result).toEqual({ a: 'ok' });
  });

  it('removes function values from objects', () => {
    const result = sanitizeEventDetails({ a: 'ok', fn: () => {} });
    expect(result).toEqual({ a: 'ok' });
  });

  it('coerces non-primitive values to string', () => {
    const result = sanitizeEventDetails({ date: new Date('2026-01-01T00:00:00Z') });
    expect(result).toHaveProperty('date');
    expect(typeof (result as Record<string, unknown>).date).toBe('string');
  });

  it('truncates oversized objects to string', () => {
    const bigObj: Record<string, string> = {};
    for (let i = 0; i < 500; i++) {
      bigObj[`key_${i}`] = 'x'.repeat(10);
    }
    const result = sanitizeEventDetails(bigObj);
    expect(typeof result).toBe('string');
    expect((result as string).length).toBe(MAX_EVENT_DETAILS_SIZE);
  });

  it('handles typical TOKEN_CREATED details', () => {
    const result = sanitizeEventDetails({
      tokenId: 'tok-123',
      expiresAt: '2026-02-19T00:00:00Z',
      delivery: 'email',
    });
    expect(result).toEqual({
      tokenId: 'tok-123',
      expiresAt: '2026-02-19T00:00:00Z',
      delivery: 'email',
    });
  });

  it('handles typical INVOICE_SENT_EMAIL details', () => {
    const result = sanitizeEventDetails({
      to: 'parent@example.com',
      tokenExpiresAt: '2026-02-19T00:00:00Z',
    });
    expect(result).toEqual({
      to: 'parent@example.com',
      tokenExpiresAt: '2026-02-19T00:00:00Z',
    });
  });

  it('handles typical TOKENS_REVOKED details', () => {
    const result = sanitizeEventDetails({ count: 3 });
    expect(result).toEqual({ count: 3 });
  });
});

describe('createInvoiceEvent uses sanitizeEventDetails', () => {
  it('sanitizes object details', () => {
    const event = createInvoiceEvent('TOKEN_CREATED', 'user-1', {
      tokenId: 'tok-1',
      expiresAt: '2026-02-19T00:00:00Z',
      delivery: 'email',
    });
    expect(event.details).toEqual({
      tokenId: 'tok-1',
      expiresAt: '2026-02-19T00:00:00Z',
      delivery: 'email',
    });
  });

  it('sanitizes null details to null', () => {
    const event = createInvoiceEvent('INVOICE_SENT', 'user-1', null);
    expect(event.details).toBeNull();
  });

  it('removes functions from details', () => {
    const event = createInvoiceEvent('INVOICE_SENT', 'user-1', {
      ok: true,
      fn: (() => {}) as unknown as string,
    } as Record<string, unknown>);
    expect(event.details).toEqual({ ok: true });
  });
});
