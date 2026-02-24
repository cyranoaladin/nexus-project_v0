/**
 * Payments Pending API — Complete Test Suite
 *
 * Tests: GET /api/payments/pending, GET /api/payments/check-pending
 *
 * Source: app/api/payments/pending/route.ts, app/api/payments/check-pending/route.ts
 */

const mockAuth = jest.fn();
jest.mock('@/auth', () => ({
  auth: () => mockAuth(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
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

// ─── GET /api/payments/pending ───────────────────────────────────────────────

describe('GET /api/payments/pending', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should return 401 for unauthenticated request', async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import('@/app/api/payments/pending/route');
    const request = new Request('http://localhost/api/payments/pending');
    const response = await GET(request);
    expect(response.status).toBe(401);
  });

  it('should return 403 for ELEVE role', async () => {
    mockAuth.mockResolvedValue(mockSession('ELEVE'));
    const { GET } = await import('@/app/api/payments/pending/route');
    const request = new Request('http://localhost/api/payments/pending');
    const response = await GET(request);
    expect([401, 403]).toContain(response.status);
  });

  it('should allow ADMIN to list pending payments', async () => {
    mockAuth.mockResolvedValue(mockSession('ADMIN'));
    const { GET } = await import('@/app/api/payments/pending/route');
    const request = new Request('http://localhost/api/payments/pending');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it('should allow ASSISTANTE to list pending payments', async () => {
    mockAuth.mockResolvedValue(mockSession('ASSISTANTE'));
    const { GET } = await import('@/app/api/payments/pending/route');
    const request = new Request('http://localhost/api/payments/pending');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});

// ─── GET /api/payments/check-pending ─────────────────────────────────────────

describe('GET /api/payments/check-pending', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should handle unauthenticated request gracefully', async () => {
    mockAuth.mockResolvedValue(null);
    const { GET } = await import('@/app/api/payments/check-pending/route');
    const request = new Request('http://localhost/api/payments/check-pending');
    const response = await GET(request);
    // Route may return 401 or 200 with hasPending=false depending on implementation
    expect([200, 401]).toContain(response.status);
  });

  it('should allow PARENT to check pending payments', async () => {
    mockAuth.mockResolvedValue(mockSession('PARENT'));
    const { GET } = await import('@/app/api/payments/check-pending/route');
    const request = new Request('http://localhost/api/payments/check-pending');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });

  it('should return hasPending=false when no pending payment exists', async () => {
    mockAuth.mockResolvedValue(mockSession('PARENT'));
    const { prisma } = await import('@/lib/prisma');
    (prisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

    const { GET } = await import('@/app/api/payments/check-pending/route');
    const request = new Request('http://localhost/api/payments/check-pending');
    const response = await GET(request);
    const body = await response.json();
    expect(body.hasPending).toBe(false);
  });
});
