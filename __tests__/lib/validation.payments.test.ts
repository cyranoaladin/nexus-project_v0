import {
  createPaymentSchema,
  listPaymentsSchema,
  refundPaymentSchema,
} from '@/lib/validation/payments';

describe('validation payments', () => {
  it('applies default currency on createPayment', () => {
    const res = createPaymentSchema.parse({
      userId: 'ckx1a2b3c4d5e6f7g8h9i0j1',
      method: 'clictopay',
      type: 'SUBSCRIPTION',
      amount: 200,
      description: 'Sub',
    });
    expect(res.currency).toBe('TND');
  });

  it('validates list filters', () => {
    const res = listPaymentsSchema.safeParse({
      status: 'COMPLETED',
      startDate: '2026-02-01',
    });
    expect(res.success).toBe(true);
  });

  it('validates refund schema', () => {
    const res = refundPaymentSchema.safeParse({ reason: 'Duplicate', amount: 10 });
    expect(res.success).toBe(true);
  });
});
