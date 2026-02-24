/**
 * Payments — Complete Test Suite
 *
 * Tests: upsertPaymentByExternalId (idempotent create-or-get)
 *
 * Source: lib/payments.ts
 */

import { upsertPaymentByExternalId } from '@/lib/payments';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

const baseParams = {
  externalId: 'ext-123',
  method: 'bank_transfer',
  type: 'SUBSCRIPTION' as const,
  userId: 'user-1',
  amount: 450,
  description: 'Abonnement Hybride',
};

// ─── Happy Path ──────────────────────────────────────────────────────────────

describe('upsertPaymentByExternalId — create', () => {
  it('should create a new payment when none exists', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      ...baseParams,
      status: 'PENDING',
      currency: 'TND',
    });

    const result = await upsertPaymentByExternalId(baseParams);

    expect(result.created).toBe(true);
    expect(result.payment.id).toBe('pay-1');
    expect(prisma.payment.create).toHaveBeenCalledTimes(1);
  });

  it('should set default currency to TND', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      ...baseParams,
      currency: 'TND',
      status: 'PENDING',
    });

    await upsertPaymentByExternalId(baseParams);

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currency: 'TND' }),
      })
    );
  });

  it('should use custom currency when provided', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      currency: 'EUR',
      status: 'PENDING',
    });

    await upsertPaymentByExternalId({ ...baseParams, currency: 'EUR' });

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currency: 'EUR' }),
      })
    );
  });

  it('should set status to PENDING on creation', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({
      id: 'pay-1',
      status: 'PENDING',
    });

    await upsertPaymentByExternalId(baseParams);

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PENDING' }),
      })
    );
  });

  it('should include metadata when provided', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });

    await upsertPaymentByExternalId({
      ...baseParams,
      metadata: { planName: 'HYBRIDE', invoiceRef: 'INV-001' },
    });

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: { planName: 'HYBRIDE', invoiceRef: 'INV-001' },
        }),
      })
    );
  });
});

// ─── Idempotency ─────────────────────────────────────────────────────────────

describe('upsertPaymentByExternalId — idempotency', () => {
  it('should return existing payment without creating (fast path)', async () => {
    const existing = { id: 'pay-existing', externalId: 'ext-123', method: 'bank_transfer' };
    prisma.payment.findFirst.mockResolvedValue(existing);

    const result = await upsertPaymentByExternalId(baseParams);

    expect(result.created).toBe(false);
    expect(result.payment.id).toBe('pay-existing');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('should handle P2002 unique constraint (race condition)', async () => {
    prisma.payment.findFirst
      .mockResolvedValueOnce(null) // first check: not found
      .mockResolvedValueOnce({ id: 'pay-race', externalId: 'ext-123' }); // retry after P2002

    prisma.payment.create.mockRejectedValue({ code: 'P2002' });

    const result = await upsertPaymentByExternalId(baseParams);

    expect(result.created).toBe(false);
    expect(result.payment.id).toBe('pay-race');
  });

  it('should throw non-P2002 errors', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockRejectedValue(new Error('DB connection lost'));

    await expect(upsertPaymentByExternalId(baseParams)).rejects.toThrow('DB connection lost');
  });
});

// ─── Query Correctness ───────────────────────────────────────────────────────

describe('upsertPaymentByExternalId — query correctness', () => {
  it('should search by externalId AND method', async () => {
    prisma.payment.findFirst.mockResolvedValue({ id: 'pay-1' });

    await upsertPaymentByExternalId(baseParams);

    expect(prisma.payment.findFirst).toHaveBeenCalledWith({
      where: { externalId: 'ext-123', method: 'bank_transfer' },
    });
  });

  it('should handle different payment types', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });

    await upsertPaymentByExternalId({ ...baseParams, type: 'CREDIT_PACK' });

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'CREDIT_PACK' }),
      })
    );
  });

  it('should handle different payment methods', async () => {
    prisma.payment.findFirst.mockResolvedValue(null);
    prisma.payment.create.mockResolvedValue({ id: 'pay-1' });

    await upsertPaymentByExternalId({ ...baseParams, method: 'clictopay' });

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ method: 'clictopay' }),
      })
    );
  });
});
