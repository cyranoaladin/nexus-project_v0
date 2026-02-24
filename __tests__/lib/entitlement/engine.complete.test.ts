/**
 * Entitlement Engine — Complete Test Suite
 *
 * Tests: activateEntitlements, suspendEntitlements, hasEntitlement,
 *        hasFeature, getUserEntitlements, getInvoiceEntitlements
 *
 * Source: lib/entitlement/engine.ts
 */

import {
  activateEntitlements,
  suspendEntitlements,
  hasEntitlement,
  hasFeature,
  getUserEntitlements,
  getInvoiceEntitlements,
} from '@/lib/entitlement/engine';

// ─── Mock Prisma Transaction Client ──────────────────────────────────────────

function createMockTx() {
  return {
    entitlement: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'ent-new' }),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    creditTransaction: {
      create: jest.fn(),
    },
    student: {
      update: jest.fn(),
    },
    invoice: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
}

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

// ─── hasEntitlement ──────────────────────────────────────────────────────────

describe('hasEntitlement', () => {
  it('should return true when user has active entitlement', async () => {
    prisma.entitlement.findFirst.mockResolvedValue({ id: 'ent-1' });

    const result = await hasEntitlement('user-1', 'STAGE_MATHS');
    expect(result).toBe(true);
  });

  it('should return false when no entitlement exists', async () => {
    prisma.entitlement.findFirst.mockResolvedValue(null);

    const result = await hasEntitlement('user-1', 'STAGE_MATHS');
    expect(result).toBe(false);
  });

  it('should query with correct userId and productCode', async () => {
    prisma.entitlement.findFirst.mockResolvedValue(null);

    await hasEntitlement('user-42', 'ABO_PREMIUM');

    expect(prisma.entitlement.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-42',
          productCode: 'ABO_PREMIUM',
          status: 'ACTIVE',
        }),
      })
    );
  });
});

// ─── hasFeature ──────────────────────────────────────────────────────────────

describe('hasFeature', () => {
  it('should return false when user has no entitlements', async () => {
    prisma.entitlement.findMany.mockResolvedValue([]);

    const result = await hasFeature('user-1', 'aria_maths');
    expect(result).toBe(false);
  });

  it('should return false when entitlements exist but none grant the feature', async () => {
    prisma.entitlement.findMany.mockResolvedValue([
      { productCode: 'UNKNOWN_PRODUCT' },
    ]);

    const result = await hasFeature('user-1', 'aria_maths');
    expect(result).toBe(false);
  });
});

// ─── getUserEntitlements ─────────────────────────────────────────────────────

describe('getUserEntitlements', () => {
  it('should return empty array when user has no entitlements', async () => {
    prisma.entitlement.findMany.mockResolvedValue([]);

    const result = await getUserEntitlements('user-new');
    expect(result).toEqual([]);
  });

  it('should return entitlements with features resolved', async () => {
    prisma.entitlement.findMany.mockResolvedValue([
      {
        id: 'ent-1',
        productCode: 'UNKNOWN_CODE',
        label: 'Test',
        status: 'ACTIVE',
        startsAt: new Date(),
        endsAt: null,
      },
    ]);

    const result = await getUserEntitlements('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].features).toEqual([]); // unknown product → empty features
  });
});

// ─── getInvoiceEntitlements ──────────────────────────────────────────────────

describe('getInvoiceEntitlements', () => {
  it('should return entitlements linked to an invoice', async () => {
    prisma.entitlement.findMany.mockResolvedValue([
      { id: 'ent-1', productCode: 'STAGE_MATHS', label: 'Stage', status: 'ACTIVE', userId: 'user-1' },
    ]);

    const result = await getInvoiceEntitlements('inv-1');
    expect(result).toHaveLength(1);
    expect(result[0].productCode).toBe('STAGE_MATHS');
  });

  it('should return empty array for invoice with no entitlements', async () => {
    prisma.entitlement.findMany.mockResolvedValue([]);

    const result = await getInvoiceEntitlements('inv-nonexistent');
    expect(result).toEqual([]);
  });
});

// ─── activateEntitlements ────────────────────────────────────────────────────

describe('activateEntitlements', () => {
  it('should return empty result when invoice not found', async () => {
    const tx = createMockTx();
    tx.invoice.findUnique.mockResolvedValue(null);

    const result = await activateEntitlements('inv-missing', tx as any);

    expect(result.created).toBe(0);
    expect(result.extended).toBe(0);
    expect(result.creditsGranted).toBe(0);
  });

  it('should set noBeneficiary=true when invoice has no beneficiaryUserId', async () => {
    const tx = createMockTx();
    tx.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      beneficiaryUserId: null,
      items: [{ id: 'item-1', label: 'Stage', productCode: 'STAGE_MATHS', qty: 1 }],
    });

    const result = await activateEntitlements('inv-1', tx as any);

    expect(result.noBeneficiary).toBe(true);
    expect(result.skippedItems).toBe(1);
    expect(result.created).toBe(0);
  });

  it('should skip items with no productCode', async () => {
    const tx = createMockTx();
    tx.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      beneficiaryUserId: 'user-1',
      items: [
        { id: 'item-1', label: 'Custom item', productCode: null, qty: 1 },
      ],
    });

    const result = await activateEntitlements('inv-1', tx as any);

    expect(result.skippedItems).toBe(1);
    expect(result.created).toBe(0);
  });

  it('should skip items with invalid productCode', async () => {
    const tx = createMockTx();
    tx.invoice.findUnique.mockResolvedValue({
      id: 'inv-1',
      beneficiaryUserId: 'user-1',
      items: [
        { id: 'item-1', label: 'Unknown', productCode: 'INVALID_CODE_XYZ', qty: 1 },
      ],
    });

    const result = await activateEntitlements('inv-1', tx as any);

    expect(result.skippedItems).toBe(1);
    expect(result.created).toBe(0);
  });
});

// ─── suspendEntitlements ─────────────────────────────────────────────────────

describe('suspendEntitlements', () => {
  it('should return 0 when no active entitlements exist', async () => {
    const tx = createMockTx();
    tx.entitlement.findMany.mockResolvedValue([]);

    const result = await suspendEntitlements('inv-1', 'Cancelled', tx as any);

    expect(result.suspended).toBe(0);
    expect(result.suspendedCodes).toEqual([]);
  });

  it('should suspend all active entitlements for an invoice', async () => {
    const tx = createMockTx();
    tx.entitlement.findMany.mockResolvedValue([
      { id: 'ent-1', productCode: 'STAGE_MATHS' },
      { id: 'ent-2', productCode: 'ABO_PREMIUM' },
    ]);
    tx.entitlement.updateMany.mockResolvedValue({ count: 2 });

    const result = await suspendEntitlements('inv-1', 'Invoice cancelled', tx as any);

    expect(result.suspended).toBe(2);
    expect(result.suspendedCodes).toContain('STAGE_MATHS');
    expect(result.suspendedCodes).toContain('ABO_PREMIUM');
    expect(tx.entitlement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sourceInvoiceId: 'inv-1',
          status: 'ACTIVE',
        }),
        data: expect.objectContaining({
          status: 'SUSPENDED',
        }),
      })
    );
  });
});
