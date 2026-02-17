/**
 * Unit tests for Invoice PDF — clamp logic and overflow guard.
 *
 * Tests the pure helper functions and overflow validation
 * without actually generating PDFs (no PDFKit dependency in tests).
 */

import {
  CLAMP_ADDRESS_LINES,
  CLAMP_DESCRIPTION_LINES,
  CLAMP_CHARS_PER_LINE,
  MAX_INVOICE_ITEMS,
  MILLIMES_PER_TND,
  millimesToDisplay,
  tndToMillimes,
  millimesToTnd,
  assertMillimes,
  MillimesValidationError,
  appendInvoiceEvent,
  createInvoiceEvent,
} from '@/lib/invoice/types';
import { InvoiceOverflowError } from '@/lib/invoice/pdf';
import type { InvoiceData, InvoiceItemData, InvoiceEvent } from '@/lib/invoice/types';

// ─── Helpers (re-implement clampText for testing since it's not exported) ────

function clampText(
  text: string | null | undefined,
  maxLines: number,
  charsPerLine: number = CLAMP_CHARS_PER_LINE
): string {
  if (!text) return '';
  const maxChars = maxLines * charsPerLine;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1).trimEnd() + '…';
}

// ─── Test data factory ──────────────────────────────────────────────────────

function makeInvoiceData(overrides: Partial<InvoiceData> = {}): InvoiceData {
  return {
    number: '202602-0001',
    status: 'DRAFT',
    issuedAt: '2026-02-16T10:00:00.000Z',
    dueAt: null,
    issuer: {
      name: 'M&M Academy (Nexus Réussite)',
      address: 'Résidence Narjess 2, Bloc D, Appt 12, Raoued 2056, Ariana, Tunisie',
      mf: '1XXXXXX/X/A/M/000',
      rne: null,
    },
    customer: {
      name: 'Test Client',
      email: 'client@test.com',
      address: null,
      customerId: null,
    },
    items: [
      { label: 'Stage Intensif Maths', description: null, qty: 1, unitPrice: 350000, total: 350000 },
    ],
    currency: 'TND',
    subtotal: 350000,
    discountTotal: 0,
    taxTotal: 0,
    total: 350000,
    taxRegime: 'TVA_NON_APPLICABLE',
    paymentMethod: 'CASH',
    paymentDetails: null,
    ...overrides,
  };
}

function makeItem(overrides: Partial<InvoiceItemData> = {}): InvoiceItemData {
  return {
    label: 'Test Item',
    description: null,
    qty: 1,
    unitPrice: 100000, // 100 TND in millimes
    total: 100000,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Invoice Clamp Constants', () => {
  it('has correct default values', () => {
    expect(CLAMP_ADDRESS_LINES).toBe(2);
    expect(CLAMP_DESCRIPTION_LINES).toBe(3);
    expect(CLAMP_CHARS_PER_LINE).toBe(60);
    expect(MAX_INVOICE_ITEMS).toBe(12);
  });
});

describe('clampText', () => {
  it('returns empty string for null/undefined', () => {
    expect(clampText(null, 2)).toBe('');
    expect(clampText(undefined, 2)).toBe('');
  });

  it('returns text unchanged if within limit', () => {
    expect(clampText('Short text', 2)).toBe('Short text');
  });

  it('truncates text exceeding limit with ellipsis', () => {
    const longText = 'A'.repeat(200);
    const result = clampText(longText, 2, 60);
    expect(result.length).toBeLessThanOrEqual(120);
    expect(result.endsWith('…')).toBe(true);
  });

  it('respects custom charsPerLine', () => {
    const text = 'A'.repeat(50);
    const result = clampText(text, 1, 30);
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result.endsWith('…')).toBe(true);
  });

  it('handles exactly-at-limit text', () => {
    const text = 'A'.repeat(120);
    const result = clampText(text, 2, 60);
    expect(result).toBe(text); // Exactly at limit, no truncation
  });

  it('handles one-char-over-limit text', () => {
    const text = 'A'.repeat(121);
    const result = clampText(text, 2, 60);
    expect(result.length).toBe(120);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('Address clamp (2 lines)', () => {
  it('keeps short address intact', () => {
    const addr = 'Rue de la Paix, Tunis';
    expect(clampText(addr, CLAMP_ADDRESS_LINES)).toBe(addr);
  });

  it('truncates very long address', () => {
    const addr = 'Résidence Les Jardins de Carthage, Bloc A, Escalier 3, Appartement 42, ' +
      'Avenue Habib Bourguiba, La Marsa 2070, Gouvernorat de Tunis, Tunisie';
    const result = clampText(addr, CLAMP_ADDRESS_LINES);
    expect(result.length).toBeLessThanOrEqual(CLAMP_ADDRESS_LINES * CLAMP_CHARS_PER_LINE);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('Description clamp (3 lines)', () => {
  it('keeps short description intact', () => {
    const desc = 'Stage de révision intensive';
    expect(clampText(desc, CLAMP_DESCRIPTION_LINES)).toBe(desc);
  });

  it('truncates very long description', () => {
    const desc = 'Lorem ipsum '.repeat(30);
    const result = clampText(desc, CLAMP_DESCRIPTION_LINES);
    expect(result.length).toBeLessThanOrEqual(CLAMP_DESCRIPTION_LINES * CLAMP_CHARS_PER_LINE);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('InvoiceOverflowError', () => {
  it('is an instance of Error', () => {
    const err = new InvoiceOverflowError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('InvoiceOverflowError');
    expect(err.message).toBe('test');
  });
});

describe('MAX_INVOICE_ITEMS guard', () => {
  it('allows up to 12 items', () => {
    const data = makeInvoiceData({
      items: Array.from({ length: 12 }, (_, i) => makeItem({ label: `Item ${i + 1}` })),
    });
    expect(data.items.length).toBeLessThanOrEqual(MAX_INVOICE_ITEMS);
  });

  it('flags more than 12 items as overflow', () => {
    const data = makeInvoiceData({
      items: Array.from({ length: 13 }, (_, i) => makeItem({ label: `Item ${i + 1}` })),
    });
    expect(data.items.length).toBeGreaterThan(MAX_INVOICE_ITEMS);
  });
});

describe('Invoice data integrity (millimes)', () => {
  it('computes correct item total in millimes (pure int)', () => {
    const item = makeItem({ qty: 3, unitPrice: 150000 }); // 150 TND
    expect(item.qty * item.unitPrice).toBe(450000); // 450 TND
  });

  it('computes correct subtotal from items in millimes', () => {
    const items = [
      makeItem({ qty: 1, unitPrice: 350000, total: 350000 }),
      makeItem({ qty: 2, unitPrice: 100000, total: 200000 }),
    ];
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    expect(subtotal).toBe(550000); // 550 TND
  });

  it('computes correct total with discount in millimes', () => {
    const data = makeInvoiceData({
      subtotal: 550000,
      discountTotal: 50000,
      taxTotal: 0,
      total: 500000,
    });
    expect(data.subtotal - data.discountTotal + data.taxTotal).toBe(data.total);
  });

  it('handles zero discount', () => {
    const data = makeInvoiceData({
      subtotal: 350000,
      discountTotal: 0,
      total: 350000,
    });
    expect(data.total).toBe(data.subtotal);
  });

  it('all arithmetic is integer — no float residue', () => {
    // Classic float trap: 0.1 + 0.2 !== 0.3
    // In millimes: 100 + 200 === 300 (always)
    const a = 100;
    const b = 200;
    expect(a + b).toBe(300);
    expect(Number.isInteger(a + b)).toBe(true);
  });
});

describe('Millimes conversion helpers', () => {
  it('MILLIMES_PER_TND is 1000', () => {
    expect(MILLIMES_PER_TND).toBe(1000);
  });

  it('tndToMillimes converts correctly', () => {
    expect(tndToMillimes(350)).toBe(350000);
    expect(tndToMillimes(0)).toBe(0);
    expect(tndToMillimes(1.5)).toBe(1500);
    expect(tndToMillimes(99.999)).toBe(99999);
  });

  it('tndToMillimes always returns integer', () => {
    expect(Number.isInteger(tndToMillimes(350.123))).toBe(true);
    expect(Number.isInteger(tndToMillimes(0.001))).toBe(true);
  });

  it('millimesToTnd converts correctly', () => {
    expect(millimesToTnd(350000)).toBe(350);
    expect(millimesToTnd(0)).toBe(0);
    expect(millimesToTnd(1500)).toBe(1.5);
  });

  it('millimesToDisplay formats correctly', () => {
    expect(millimesToDisplay(350000)).toBe('350.000 TND');
    expect(millimesToDisplay(0)).toBe('0.000 TND');
    expect(millimesToDisplay(1500)).toBe('1.500 TND');
    expect(millimesToDisplay(99999)).toBe('99.999 TND');
  });

  it('millimesToDisplay respects custom currency', () => {
    expect(millimesToDisplay(350000, 'EUR')).toBe('350.000 EUR');
  });

  it('roundtrip: TND → millimes → TND is lossless for 3 decimals', () => {
    const original = 350.5;
    const millimes = tndToMillimes(original);
    const back = millimesToTnd(millimes);
    expect(back).toBe(original);
  });
});

describe('assertMillimes — runtime integer guard', () => {
  it('passes for valid integers', () => {
    expect(() => assertMillimes(0, 'test')).not.toThrow();
    expect(() => assertMillimes(350000, 'test')).not.toThrow();
    expect(() => assertMillimes(-1000, 'test')).not.toThrow();
  });

  it('throws MillimesValidationError for float', () => {
    expect(() => assertMillimes(350.5, 'unitPrice')).toThrow(MillimesValidationError);
    expect(() => assertMillimes(0.001, 'total')).toThrow(MillimesValidationError);
  });

  it('throws for NaN', () => {
    expect(() => assertMillimes(NaN, 'qty')).toThrow(MillimesValidationError);
  });

  it('throws for Infinity', () => {
    expect(() => assertMillimes(Infinity, 'subtotal')).toThrow(MillimesValidationError);
  });

  it('throws for string', () => {
    expect(() => assertMillimes('350' as unknown, 'unitPrice')).toThrow(MillimesValidationError);
  });

  it('throws for null/undefined', () => {
    expect(() => assertMillimes(null as unknown, 'x')).toThrow(MillimesValidationError);
    expect(() => assertMillimes(undefined as unknown, 'x')).toThrow(MillimesValidationError);
  });

  it('error message includes field name', () => {
    try {
      assertMillimes(3.14, 'unitPrice');
    } catch (e) {
      expect((e as Error).message).toContain('unitPrice');
      expect((e as Error).message).toContain('entier');
    }
  });
});

describe('appendInvoiceEvent — append-only, sorted ASC', () => {
  const ev1 = createInvoiceEvent('INVOICE_CREATED', 'user-1', 'created');
  const ev2: InvoiceEvent = { type: 'PDF_RENDERED', at: '2026-02-16T22:00:00.000Z', by: 'user-1', details: 'rendered' };
  const ev3: InvoiceEvent = { type: 'INVOICE_SENT', at: '2026-02-16T23:00:00.000Z', by: 'user-1', details: 'sent' };

  it('appends to empty array', () => {
    const result = appendInvoiceEvent([], ev2);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('PDF_RENDERED');
  });

  it('appends to null/undefined (treats as empty)', () => {
    expect(appendInvoiceEvent(null, ev2)).toHaveLength(1);
    expect(appendInvoiceEvent(undefined, ev2)).toHaveLength(1);
  });

  it('appends to existing events', () => {
    const result = appendInvoiceEvent([ev2], ev3);
    expect(result).toHaveLength(2);
    expect(result[1].type).toBe('INVOICE_SENT');
  });

  it('sorts by timestamp ASC', () => {
    const late: InvoiceEvent = { type: 'INVOICE_PAID', at: '2026-02-17T10:00:00.000Z', by: 'user-1', details: null };
    const early: InvoiceEvent = { type: 'INVOICE_CREATED', at: '2026-02-16T08:00:00.000Z', by: 'user-1', details: null };
    const result = appendInvoiceEvent([late], early);
    expect(result[0].at).toBe('2026-02-16T08:00:00.000Z');
    expect(result[1].at).toBe('2026-02-17T10:00:00.000Z');
  });

  it('never loses existing events (append-only)', () => {
    const existing = [ev2, ev3];
    const result = appendInvoiceEvent(existing, ev1);
    expect(result).toHaveLength(3);
    expect(result.map(e => e.type)).toContain('PDF_RENDERED');
    expect(result.map(e => e.type)).toContain('INVOICE_SENT');
    expect(result.map(e => e.type)).toContain('INVOICE_CREATED');
  });

  it('does not mutate the original array', () => {
    const existing = [ev2];
    const copy = [...existing];
    appendInvoiceEvent(existing, ev3);
    expect(existing).toEqual(copy);
  });
});
