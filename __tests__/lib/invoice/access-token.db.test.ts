/**
 * @jest-environment node
 */

/**
 * Tests for lib/invoice/access-token.ts — DB-dependent functions
 *
 * Covers: createAccessToken, verifyAccessToken, revokeTokensForInvoice
 */

import {
  createAccessToken,
  verifyAccessToken,
  revokeTokensForInvoice,
  hashToken,
} from '@/lib/invoice/access-token';

const { prisma } = jest.requireMock('@/lib/prisma') as {
  prisma: {
    invoiceAccessToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };
};

describe('createAccessToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates token and returns raw token + id + expiresAt', async () => {
    prisma.invoiceAccessToken.create.mockResolvedValue({
      id: 'token-1',
      tokenHash: 'somehash',
      expiresAt: new Date('2026-02-21'),
    });

    const result = await createAccessToken('invoice-1', 'user-1');

    expect(result.rawToken).toHaveLength(64);
    expect(result.tokenId).toBe('token-1');
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(prisma.invoiceAccessToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: 'invoice-1',
          createdByUserId: 'user-1',
        }),
      })
    );
  });

  it('stores hash, not raw token', async () => {
    prisma.invoiceAccessToken.create.mockResolvedValue({
      id: 'token-2',
      tokenHash: 'hash',
      expiresAt: new Date(),
    });

    const result = await createAccessToken('inv-1', 'user-1');
    const createCall = prisma.invoiceAccessToken.create.mock.calls[0][0];
    const storedHash = createCall.data.tokenHash;

    // The stored hash should match hashToken(rawToken)
    expect(storedHash).toBe(hashToken(result.rawToken));
  });

  it('accepts custom expiry hours', async () => {
    prisma.invoiceAccessToken.create.mockResolvedValue({
      id: 'token-3',
      tokenHash: 'hash',
      expiresAt: new Date(),
    });

    await createAccessToken('inv-1', 'user-1', 24);
    const createCall = prisma.invoiceAccessToken.create.mock.calls[0][0];
    const expiresAt = createCall.data.expiresAt as Date;

    // Should expire in ~24h, not 72h
    const hoursFromNow = (expiresAt.getTime() - Date.now()) / (60 * 60 * 1000);
    expect(hoursFromNow).toBeGreaterThan(23);
    expect(hoursFromNow).toBeLessThan(25);
  });
});

describe('verifyAccessToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns valid with invoiceId for valid token', async () => {
    const rawToken = 'a'.repeat(64);
    prisma.invoiceAccessToken.findUnique.mockResolvedValue({
      invoiceId: 'invoice-1',
      expiresAt: new Date(Date.now() + 86400000), // tomorrow
      revokedAt: null,
    });

    const result = await verifyAccessToken(rawToken);

    expect(result.valid).toBe(true);
    expect(result.invoiceId).toBe('invoice-1');
  });

  it('returns NOT_FOUND for unknown token', async () => {
    prisma.invoiceAccessToken.findUnique.mockResolvedValue(null);

    const result = await verifyAccessToken('unknown-token');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('NOT_FOUND');
  });

  it('returns REVOKED for revoked token', async () => {
    prisma.invoiceAccessToken.findUnique.mockResolvedValue({
      invoiceId: 'invoice-1',
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: new Date(),
    });

    const result = await verifyAccessToken('revoked-token');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('REVOKED');
  });

  it('returns EXPIRED for expired token', async () => {
    prisma.invoiceAccessToken.findUnique.mockResolvedValue({
      invoiceId: 'invoice-1',
      expiresAt: new Date('2020-01-01'), // past
      revokedAt: null,
    });

    const result = await verifyAccessToken('expired-token');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('EXPIRED');
  });
});

describe('revokeTokensForInvoice', () => {
  beforeEach(() => jest.clearAllMocks());

  it('revokes all active tokens and returns count', async () => {
    prisma.invoiceAccessToken.updateMany.mockResolvedValue({ count: 3 });

    const result = await revokeTokensForInvoice('invoice-1');

    expect(result).toBe(3);
    expect(prisma.invoiceAccessToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          invoiceId: 'invoice-1',
          revokedAt: null,
        }),
      })
    );
  });

  it('returns 0 when no active tokens exist', async () => {
    prisma.invoiceAccessToken.updateMany.mockResolvedValue({ count: 0 });

    const result = await revokeTokensForInvoice('invoice-no-tokens');
    expect(result).toBe(0);
  });

  it('uses provided transaction client', async () => {
    const mockTx = {
      invoiceAccessToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    const result = await revokeTokensForInvoice('invoice-1', mockTx as any);

    expect(result).toBe(2);
    expect(mockTx.invoiceAccessToken.updateMany).toHaveBeenCalled();
    // Global prisma should NOT be called
    expect(prisma.invoiceAccessToken.updateMany).not.toHaveBeenCalled();
  });
});
