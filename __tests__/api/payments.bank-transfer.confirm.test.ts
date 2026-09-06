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
        // A non-suspended surface (SPECIAL_PACK), so this test isolates the
        // ownership check it's named for from the P0-ARIA-03 suspension
        // check covered separately below.
        type: 'pack',
        key: 'GRAND_ORAL',
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

  it('uses the server-side catalog price and description instead of client supplied values (SPECIAL_PACK — never suspended)', async () => {
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
        type: 'pack',
        key: 'GRAND_ORAL',
        studentId: 'student-1',
        amount: 1,
        description: 'client supplied discount',
        termsAccepted: true,
        termsVersion: '2026-05',
      }),
    });

    const response = await POST(request as any);

    // Cubic P2: proves anti-tampering with the EXACT canonical catalog
    // values (client sent amount:1 / description:'client supplied
    // discount'), not just "some Number"/"some String" — a route that
    // forwarded the client's own amount unchanged would still pass a loose
    // `expect.any(Number)` assertion.
    expect(response.status).toBe(200);
    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 750,
          description: 'Pack Grand Oral',
        }),
      })
    );
  });
  it.each([['pack', 'GRAND_ORAL']])('records %s as SPECIAL_PACK without a credit purchase', async (type, key) => {
    mockAuth.mockResolvedValue(mockSession('PARENT', 'parent-1'));
    const { prisma } = await import('@/lib/prisma');
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile' });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'student-1' });
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'payment-1' });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
    const { POST } = await import('@/app/api/payments/bank-transfer/confirm/route');
    const response = await POST(new Request('http://localhost/api/payments/bank-transfer/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, key, studentId: 'student-1', termsAccepted: true, termsVersion: '2026-09' }),
    }) as any);
    expect(response.status).toBe(200);
    expect(prisma.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'SPECIAL_PACK', status: 'PENDING' }) }));
  });
  it('preserves the canonical suspension of the additional-subject addon', async () => {
    mockAuth.mockResolvedValue(mockSession('PARENT', 'parent-1'));
    const { prisma } = await import('@/lib/prisma');
    const { POST } = await import('@/app/api/payments/bank-transfer/confirm/route');
    const response = await POST(new Request('http://localhost/api/payments/bank-transfer/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'addon', key: 'MATIERE_SUPPLEMENTAIRE', studentId: 'student-1', termsAccepted: true, termsVersion: '2026-09' }),
    }) as any);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'SALE_SUSPENDED' });
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
  it('rejects retired credit packs without creating a payment', async () => {
    mockAuth.mockResolvedValue(mockSession('PARENT', 'parent-1'));
    const { prisma } = await import('@/lib/prisma');
    const { POST } = await import('@/app/api/payments/bank-transfer/confirm/route');
    const response = await POST(new Request('http://localhost/api/payments/bank-transfer/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'pack', key: 'CREDIT_PACK_10', termsAccepted: true, termsVersion: '2026-09' }),
    }) as any);
    expect(response.status).toBe(400);
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

});

// ─── P0-ARIA-03: sale-suspension bypass ─────────────────────────────────────
//
// SUSPENDED_SALE_SURFACES = ['SUBSCRIPTION_PLAN', 'ARIA_ADDON']
// (lib/commerce/sale-suspension.ts). This route must refuse to create a
// Payment for either surface, exactly like /api/parent/subscription-requests
// already does — closing the bypass a parent could reach via a direct
// `/dashboard/parent/paiement?plan=...` / `?addon=...` URL.
describe('POST /api/payments/bank-transfer/confirm — sale suspension (P0-ARIA-03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function requestFor(type: 'subscription' | 'addon' | 'pack', key: string) {
    return new Request('http://localhost/api/payments/bank-transfer/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        key,
        studentId: type === 'pack' ? undefined : 'student-1',
        termsAccepted: true,
        termsVersion: '2026-05',
      }),
    });
  }

  it('CODEX_P0_ARIA_03_RED: refuses a direct forged POST for a suspended subscription plan (?plan=HYBRIDE equivalent)', async () => {
    mockAuth.mockResolvedValue(mockSession('PARENT', 'parent-user-1'));
    const { prisma } = await import('@/lib/prisma');
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'student-1' });

    const { POST } = await import('@/app/api/payments/bank-transfer/confirm/route');
    const response = await POST(requestFor('subscription', 'HYBRIDE') as any);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('SALE_SUSPENDED');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('refuses a direct forged POST for a suspended ARIA addon (?addon=MATIERE_SUPPLEMENTAIRE equivalent)', async () => {
    mockAuth.mockResolvedValue(mockSession('PARENT', 'parent-user-1'));
    const { prisma } = await import('@/lib/prisma');
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'student-1' });

    const { POST } = await import('@/app/api/payments/bank-transfer/confirm/route');
    const response = await POST(requestFor('addon', 'MATIERE_SUPPLEMENTAIRE') as any);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe('SALE_SUSPENDED');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('still allows a SPECIAL_PACK declaration — those surfaces are real, delivered services', async () => {
    mockAuth.mockResolvedValue(mockSession('PARENT', 'parent-user-1'));
    const { prisma } = await import('@/lib/prisma');
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'student-1' });
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'pay-pack-1' });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const { POST } = await import('@/app/api/payments/bank-transfer/confirm/route');
    const response = await POST(requestFor('pack', 'GRAND_ORAL') as any);

    expect(response.status).toBe(200);
    expect(prisma.payment.create).toHaveBeenCalled();
  });

  it('checks sale suspension before touching the database at all', async () => {
    mockAuth.mockResolvedValue(mockSession('PARENT', 'parent-user-1'));
    const { prisma } = await import('@/lib/prisma');

    const { POST } = await import('@/app/api/payments/bank-transfer/confirm/route');
    await POST(requestFor('subscription', 'HYBRIDE') as any);

    expect(prisma.parentProfile.findUnique).not.toHaveBeenCalled();
    expect(prisma.student.findFirst).not.toHaveBeenCalled();
  });
});
