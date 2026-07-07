import { auth } from '@/auth';
import { GET, POST } from '@/app/api/assistante/subscriptions/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    creditTransaction: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('assistant subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET returns 401 when not assistant', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('F14 — ADMIN can GET subscriptions -> 200', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });
    (prisma.subscription.findMany as jest.Mock).mockResolvedValue([]);

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
  });

  it('GET returns pending and all subscriptions', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.subscription.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: 'sub-1', status: 'INACTIVE', student: { user: {}, parent: { user: {} } } }])
      .mockResolvedValueOnce([{ id: 'sub-2', status: 'ACTIVE', student: { user: {}, parent: { user: {} } } }]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pendingSubscriptions).toHaveLength(1);
    expect(body.allSubscriptions).toHaveLength(1);
  });

  it('POST validates required fields', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid subscription payload');
  });

  it('POST returns 404 when subscription missing', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'A', lastName: 'S' },
    });
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ subscriptionId: 'sub-1', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Subscription not found');
  });

  it('POST approves subscription and adds credits', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'A', lastName: 'S' },
    });
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      status: 'INACTIVE',
      creditsPerMonth: 3,
      planName: 'HYBRIDE',
      studentId: 'student-1',
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => cb({
      subscription: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), update: jest.fn().mockResolvedValue({ id: 'sub-1', status: 'ACTIVE' }) },
      creditTransaction: { create: jest.fn() },
    }));

    const response = await POST(makeRequest({ subscriptionId: 'sub-1', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('POST approves legacy inactive subscription with server catalog price and credits', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'A', lastName: 'S' },
    });
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-legacy',
      status: 'INACTIVE',
      monthlyPrice: 1,
      creditsPerMonth: 99,
      planName: 'HYBRIDE',
      studentId: 'student-1',
    });
    const txSubscriptionUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const txCreditCreate = jest.fn();
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) =>
      cb({
        subscription: { updateMany: txSubscriptionUpdateMany, update: jest.fn() },
        creditTransaction: { create: txCreditCreate },
      })
    );

    const response = await POST(makeRequest({ subscriptionId: 'sub-legacy', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(txSubscriptionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sub-legacy', status: 'INACTIVE' },
        data: expect.objectContaining({
          status: 'ACTIVE',
          monthlyPrice: 450,
          creditsPerMonth: 4,
        }),
      })
    );
    expect(txCreditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'student-1',
          amount: 4,
        }),
      })
    );
  });

  it('POST does not add credits when approval was already processed concurrently', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'A', lastName: 'S' },
    });
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      status: 'INACTIVE',
      creditsPerMonth: 3,
      planName: 'HYBRIDE',
      studentId: 'student-1',
    });
    let txCreditCreate: jest.Mock | undefined;
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
      txCreditCreate = jest.fn();
      return cb({
        subscription: { updateMany: jest.fn().mockResolvedValue({ count: 0 }), update: jest.fn() },
        creditTransaction: { create: txCreditCreate },
      });
    });

    const response = await POST(makeRequest({ subscriptionId: 'sub-1', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('déjà');
    expect(txCreditCreate).not.toHaveBeenCalled();
  });
});
