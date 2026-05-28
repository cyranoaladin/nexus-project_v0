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
    parentProfile: {
      findUnique: jest.fn(),
    },
    student: {
      findFirst: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
      createMany: jest.fn(),
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

  it('rejects a bank transfer declaration for a student outside the parent scope', async () => {
    mockAuth.mockResolvedValue(mockSession('PARENT', 'parent-user-1'));
    const { prisma } = await import('@/lib/prisma');
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

    const { POST } = await import('@/app/api/payments/bank-transfer/confirm/route');
    const request = new Request('http://localhost/api/payments/bank-transfer/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'subscription',
        key: 'HYBRIDE',
        studentId: 'student-other-parent',
        amount: 1,
        description: 'tampered',
        termsAccepted: true,
        termsVersion: '2026-05',
      }),
    });

    const response = await POST(request as any);

    expect(response.status).toBe(404);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('uses the server-side catalog price and description instead of client supplied values', async () => {
    mockAuth.mockResolvedValue(mockSession('PARENT', 'parent-user-1'));
    const { prisma } = await import('@/lib/prisma');
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'student-1' });
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'pay-1' });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const { POST } = await import('@/app/api/payments/bank-transfer/confirm/route');
    const request = new Request('http://localhost/api/payments/bank-transfer/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'subscription',
        key: 'HYBRIDE',
        studentId: 'student-1',
        amount: 1,
        description: 'client supplied discount',
        termsAccepted: true,
        termsVersion: '2026-05',
      }),
    });

    const response = await POST(request as any);

    expect(response.status).toBe(200);
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 450,
          description: expect.stringContaining('HYBRIDE'),
        }),
      })
    );
  });
});
