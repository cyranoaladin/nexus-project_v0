/**
 * Unit tests for Invoice Sequence — number formatting and yearMonth parsing.
 *
 * Note: The actual atomic DB operation (generateInvoiceNumber) requires a live
 * database and is tested via integration tests. These tests cover the pure
 * formatting logic.
 */

import { formatYearMonth } from '@/lib/invoice/sequence';

describe('formatYearMonth', () => {
  it('formats a standard yearMonth', () => {
    expect(formatYearMonth(202602)).toBe('2026-02');
  });

  it('formats January correctly (leading zero)', () => {
    expect(formatYearMonth(202601)).toBe('2026-01');
  });

  it('formats December correctly', () => {
    expect(formatYearMonth(202612)).toBe('2026-12');
  });

  it('formats a different year', () => {
    expect(formatYearMonth(202501)).toBe('2025-01');
  });

  it('formats year 2030', () => {
    expect(formatYearMonth(203011)).toBe('2030-11');
  });
});

describe('Invoice number format', () => {
  it('follows YYYYMM-#### pattern', () => {
    const pattern = /^\d{6}-\d{4}$/;
    expect(pattern.test('202602-0001')).toBe(true);
    expect(pattern.test('202612-0123')).toBe(true);
    expect(pattern.test('202602-9999')).toBe(true);
  });

  it('rejects invalid formats', () => {
    const pattern = /^\d{6}-\d{4}$/;
    expect(pattern.test('2026-02-001')).toBe(false);
    expect(pattern.test('202602001')).toBe(false);
    expect(pattern.test('FACTURE-001')).toBe(false);
  });

  it('padStart produces correct padding', () => {
    expect(String(1).padStart(4, '0')).toBe('0001');
    expect(String(42).padStart(4, '0')).toBe('0042');
    expect(String(999).padStart(4, '0')).toBe('0999');
    expect(String(9999).padStart(4, '0')).toBe('9999');
    expect(String(10000).padStart(4, '0')).toBe('10000'); // Overflow — 5 digits
  });

  it('yearMonth computation is correct', () => {
    const date = new Date('2026-02-16T10:00:00Z');
    const yearMonth = date.getFullYear() * 100 + (date.getMonth() + 1);
    expect(yearMonth).toBe(202602);
  });

  it('yearMonth for January is correct', () => {
    const date = new Date('2026-01-01T00:00:00Z');
    const yearMonth = date.getFullYear() * 100 + (date.getMonth() + 1);
    expect(yearMonth).toBe(202601);
  });

  it('yearMonth for December is correct', () => {
    const date = new Date('2026-12-15T12:00:00Z');
    const yearMonth = date.getFullYear() * 100 + (date.getMonth() + 1);
    expect(yearMonth).toBe(202612);
  });
});
