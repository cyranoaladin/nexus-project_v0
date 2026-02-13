import {
  createKonnectPaymentSchema,
  createPaymentSchema,
  konnectWebhookSchema,
  listPaymentsSchema,
  refundPaymentSchema,
} from '@/lib/validation/payments';

describe('validation payments', () => {
  it('validates konnect payment creation', () => {
    const res = createKonnectPaymentSchema.safeParse({
      type: 'subscription',
      key: 'key-1',
      studentId: 'ckx1a2b3c4d5e6f7g8h9i0j1',
      amount: 100,
      description: 'Payment',
    });
    expect(res.success).toBe(true);
  });

  it('applies default currency on createPayment', () => {
    const res = createPaymentSchema.parse({
      userId: 'ckx1a2b3c4d5e6f7g8h9i0j1',
      method: 'konnect',
      type: 'SUBSCRIPTION',
      amount: 200,
      description: 'Sub',
    });
    expect(res.currency).toBe('TND');
  });

  it('validates webhook payload', () => {
    const res = konnectWebhookSchema.safeParse({
      payment_ref: 'p1',
      order_id: 'o1',
      status: 'completed',
      amount: 100,
      signature: 'sig',
    });
    expect(res.success).toBe(true);
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
