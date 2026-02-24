/**
 * Payment Validation Schemas — Complete Test Suite
 *
 * Tests: createPaymentSchema, listPaymentsSchema, refundPaymentSchema,
 *        paymentMethodSchema, paymentTypeSchema, currencySchema
 *
 * Source: lib/validation/payments.ts
 */

import {
  createPaymentSchema,
  listPaymentsSchema,
  refundPaymentSchema,
  paymentMethodSchema,
  paymentTypeSchema,
  currencySchema,
} from '@/lib/validation/payments';
import { ZodError } from 'zod';

// ─── paymentMethodSchema ─────────────────────────────────────────────────────

describe('paymentMethodSchema', () => {
  it('should accept all valid payment methods', () => {
    const methods = ['clictopay', 'cash', 'bank_transfer', 'check'];
    methods.forEach((method) => {
      expect(() => paymentMethodSchema.parse(method)).not.toThrow();
    });
  });

  it('should reject invalid payment method', () => {
    expect(() => paymentMethodSchema.parse('paypal')).toThrow(ZodError);
    expect(() => paymentMethodSchema.parse('stripe')).toThrow(ZodError);
    expect(() => paymentMethodSchema.parse('')).toThrow(ZodError);
  });
});

// ─── paymentTypeSchema ───────────────────────────────────────────────────────

describe('paymentTypeSchema', () => {
  it('should accept all valid payment types', () => {
    const types = ['subscription', 'addon', 'pack'];
    types.forEach((type) => {
      expect(() => paymentTypeSchema.parse(type)).not.toThrow();
    });
  });

  it('should reject invalid payment type', () => {
    expect(() => paymentTypeSchema.parse('one_time')).toThrow(ZodError);
  });
});

// ─── currencySchema ──────────────────────────────────────────────────────────

describe('currencySchema', () => {
  it('should accept TND, USD, EUR', () => {
    expect(() => currencySchema.parse('TND')).not.toThrow();
    expect(() => currencySchema.parse('USD')).not.toThrow();
    expect(() => currencySchema.parse('EUR')).not.toThrow();
  });

  it('should default to TND when undefined', () => {
    const result = currencySchema.parse(undefined);
    expect(result).toBe('TND');
  });

  it('should reject unsupported currencies', () => {
    expect(() => currencySchema.parse('GBP')).toThrow(ZodError);
    expect(() => currencySchema.parse('JPY')).toThrow(ZodError);
  });
});

// ─── createPaymentSchema ─────────────────────────────────────────────────────

describe('createPaymentSchema', () => {
  const validPayment = {
    userId: 'clh1234567890abcdefghij',
    method: 'bank_transfer',
    type: 'SUBSCRIPTION',
    amount: 15000, // 150.000 TND in millimes
    currency: 'TND',
  };

  it('should accept a valid payment creation payload', () => {
    const result = createPaymentSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
  });

  it('should reject missing userId', () => {
    const { userId, ...noUserId } = validPayment;
    const result = createPaymentSchema.safeParse(noUserId);
    expect(result.success).toBe(false);
  });

  it('should reject invalid userId (not CUID)', () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, userId: 'not-a-cuid' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid payment method', () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, method: 'bitcoin' });
    expect(result.success).toBe(false);
  });

  it('should reject invalid payment type', () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, type: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('should accept all valid payment types', () => {
    const types = ['SUBSCRIPTION', 'CREDIT_PACK', 'SPECIAL_PACK'];
    types.forEach((type) => {
      const result = createPaymentSchema.safeParse({ ...validPayment, type });
      expect(result.success).toBe(true);
    });
  });

  it('should reject negative amount', () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, amount: -100 });
    expect(result.success).toBe(false);
  });

  it('should reject zero amount', () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, amount: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject non-integer amount', () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, amount: 150.5 });
    expect(result.success).toBe(false);
  });

  it('should accept optional description', () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, description: 'Monthly subscription' });
    expect(result.success).toBe(true);
  });

  it('should reject description > 500 chars', () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, description: 'A'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('should accept optional reference', () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, reference: 'VIR-2026-001' });
    expect(result.success).toBe(true);
  });

  it('should accept optional metadata', () => {
    const result = createPaymentSchema.safeParse({ ...validPayment, metadata: { invoiceId: 'inv-1' } });
    expect(result.success).toBe(true);
  });

  it('should default currency to TND', () => {
    const { currency, ...noCurrency } = validPayment;
    const result = createPaymentSchema.safeParse(noCurrency);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('TND');
    }
  });
});

// ─── listPaymentsSchema ──────────────────────────────────────────────────────

describe('listPaymentsSchema', () => {
  it('should accept empty query (all optional)', () => {
    const result = listPaymentsSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('should accept userId filter', () => {
    const result = listPaymentsSchema.safeParse({ userId: 'clh1234567890abcdefghij' });
    expect(result.success).toBe(true);
  });

  it('should accept method filter', () => {
    const result = listPaymentsSchema.safeParse({ method: 'bank_transfer' });
    expect(result.success).toBe(true);
  });

  it('should accept status filter', () => {
    const statuses = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];
    statuses.forEach((status) => {
      const result = listPaymentsSchema.safeParse({ status });
      expect(result.success).toBe(true);
    });
  });

  it('should reject invalid status', () => {
    const result = listPaymentsSchema.safeParse({ status: 'UNKNOWN' });
    expect(result.success).toBe(false);
  });

  it('should accept date range filters', () => {
    const result = listPaymentsSchema.safeParse({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    expect(result.success).toBe(true);
  });

  it('should coerce string dates to Date objects', () => {
    const result = listPaymentsSchema.safeParse({ startDate: '2026-01-01' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.startDate).toBeInstanceOf(Date);
    }
  });
});

// ─── refundPaymentSchema ─────────────────────────────────────────────────────

describe('refundPaymentSchema', () => {
  it('should accept valid refund with reason', () => {
    const result = refundPaymentSchema.safeParse({ reason: 'Customer requested refund' });
    expect(result.success).toBe(true);
  });

  it('should reject empty reason', () => {
    const result = refundPaymentSchema.safeParse({ reason: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing reason', () => {
    const result = refundPaymentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject reason > 500 chars', () => {
    const result = refundPaymentSchema.safeParse({ reason: 'A'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('should trim whitespace from reason', () => {
    const result = refundPaymentSchema.safeParse({ reason: '  Refund requested  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBe('Refund requested');
    }
  });

  it('should accept optional partial refund amount', () => {
    const result = refundPaymentSchema.safeParse({ reason: 'Partial refund', amount: 5000 });
    expect(result.success).toBe(true);
  });

  it('should reject negative refund amount', () => {
    const result = refundPaymentSchema.safeParse({ reason: 'Refund', amount: -100 });
    expect(result.success).toBe(false);
  });

  it('should reject zero refund amount', () => {
    const result = refundPaymentSchema.safeParse({ reason: 'Refund', amount: 0 });
    expect(result.success).toBe(false);
  });
});
