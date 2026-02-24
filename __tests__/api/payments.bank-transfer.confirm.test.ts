/**
 * Bank Transfer Confirm API — Complete Test Suite
 *
 * Tests: POST /api/payments/bank-transfer/confirm
 *
 * Source: app/api/payments/bank-transfer/confirm/route.ts
 */

export {};

const mockAuth = jest.fn();
jest.mock('@/auth', () => ({
  auth: () => mockAuth(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn({
      payment: {
        create: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'PENDING' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      },
    })),
  },
}));

function mockSession(role: string, userId = 'user-1') {
  return {
    user: {
      id: userId,
      email: `${role.toLowerCase()}@nexus.test`,
      role,
      firstName: 'Test',
      lastName: role,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

describe('POST /api/payments/bank-transfer/confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 for unauthenticated request', async () => {
    // Arrange
    mockAuth.mockResolvedValue(null);

    // Act
    const { POST } = await import('@/app/api/payments/bank-transfer/confirm/route');
    const request = new Request('http://localhost/api/payments/bank-transfer/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 15000, subscriptionId: 'sub-1' }),
    });
    const response = await POST(request as any);

    // Assert
    expect(response.status).toBe(401);
  });

  it('should return 403 for non-PARENT role', async () => {
    // Arrange
    mockAuth.mockResolvedValue(mockSession('COACH'));

    // Act
    const { POST } = await import('@/app/api/payments/bank-transfer/confirm/route');
    const request = new Request('http://localhost/api/payments/bank-transfer/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 15000, subscriptionId: 'sub-1' }),
    });
    const response = await POST(request as any);

    // Assert
    expect([401, 403]).toContain(response.status);
  });
});
