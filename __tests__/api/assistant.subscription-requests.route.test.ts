import { auth } from '@/auth';
import { GET, PATCH } from '@/app/api/assistante/subscription-requests/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscriptionRequest: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    subscription: { updateMany: jest.fn(), create: jest.fn() },
    creditTransaction: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

function makeRequest(body?: any, url?: string) {
  return {
    json: async () => body,
    url: url || 'http://localhost:3000/api/assistant/subscription-requests',
  } as any;
}

describe('assistant subscription-requests', () => {
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

  it('F14 — ADMIN can GET subscription-requests -> 200', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });
    (prisma.subscriptionRequest.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.subscriptionRequest.count as jest.Mock).mockResolvedValue(0);

    const response = await GET(makeRequest(undefined, 'http://localhost:3000/api/assistant/subscription-requests?status=PENDING&page=1&limit=20'));

    expect(response.status).toBe(200);
  });

  it('GET returns paginated requests', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });
    (prisma.subscriptionRequest.findMany as jest.Mock).mockResolvedValue([{ id: 'req-1' }]);
    (prisma.subscriptionRequest.count as jest.Mock).mockResolvedValue(1);

    const response = await GET(makeRequest(undefined, 'http://localhost:3000/api/assistant/subscription-requests?status=PENDING&page=1&limit=20'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requests).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it('PATCH validates action', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });

    const response = await PATCH(makeRequest({ requestId: 'req-1', action: 'INVALID' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid subscription request payload');
  });

  it('PATCH validates requestId strictly', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });

    const response = await PATCH(makeRequest({ requestId: '../req-1', action: 'APPROVED' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid subscription request payload');
    expect(prisma.subscriptionRequest.findUnique).not.toHaveBeenCalled();
  });

  it('PATCH rejects unknown payload fields', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE' },
    });

    const response = await PATCH(
      makeRequest({ requestId: 'req-1', action: 'APPROVED', role: 'ADMIN' })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid subscription request payload');
    expect(prisma.subscriptionRequest.findUnique).not.toHaveBeenCalled();
  });

  it('PATCH approves plan change atomically with server catalog price and credits', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'A', lastName: 'S' },
    });
    (prisma.subscriptionRequest.findUnique as jest.Mock).mockResolvedValue({
      id: 'req-1',
      status: 'PENDING',
      requestType: 'PLAN_CHANGE',
      studentId: 'student-1',
      planName: 'HYBRIDE',
      monthlyPrice: 1,
    });
    const txSubscriptionUpdateMany = jest
      .fn()
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    const txCreditCreate = jest.fn();
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) =>
      cb({
        subscriptionRequest: { updateMany: txSubscriptionUpdateMany },
        subscription: { updateMany: txSubscriptionUpdateMany, create: jest.fn() },
        creditTransaction: { create: txCreditCreate },
      })
    );

    const response = await PATCH(makeRequest({ requestId: 'req-1', action: 'APPROVED', reason: null }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(txSubscriptionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1', status: 'PENDING' },
        data: expect.objectContaining({ status: 'APPROVED' }),
      })
    );
    expect(txSubscriptionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 'student-1', status: 'ACTIVE' },
        data: expect.objectContaining({
          planName: 'HYBRIDE',
          monthlyPrice: 450,
          creditsPerMonth: 4,
        }),
      })
    );
    expect(txCreditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'student-1',
          type: 'CREDIT_ADD',
          amount: 4,
        }),
      })
    );
  });

  it('PATCH returns 409 and applies no side effect when request already processed concurrently', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'A', lastName: 'S' },
    });
    (prisma.subscriptionRequest.findUnique as jest.Mock).mockResolvedValue({
      id: 'req-1',
      status: 'PENDING',
      requestType: 'PLAN_CHANGE',
      studentId: 'student-1',
      planName: 'HYBRIDE',
      monthlyPrice: 450,
    });
    const txRequestUpdateMany = jest.fn().mockResolvedValue({ count: 0 });
    const txSubscriptionUpdateMany = jest.fn();
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) =>
      cb({
        subscriptionRequest: { updateMany: txRequestUpdateMany },
        subscription: { updateMany: txSubscriptionUpdateMany, create: jest.fn() },
        creditTransaction: { create: jest.fn() },
      })
    );

    const response = await PATCH(makeRequest({ requestId: 'req-1', action: 'APPROVED' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain('déjà');
    expect(txSubscriptionUpdateMany).not.toHaveBeenCalled();
  });

  it('PATCH approves ARIA add-on atomically with catalog price', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'A', lastName: 'S' },
    });
    (prisma.subscriptionRequest.findUnique as jest.Mock).mockResolvedValue({
      id: 'req-aria',
      status: 'PENDING',
      requestType: 'ARIA_ADDON',
      studentId: 'student-1',
      planName: 'MATIERE_SUPPLEMENTAIRE',
      monthlyPrice: 1,
    });
    const txRequestUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const txSubscriptionUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) =>
      cb({
        subscriptionRequest: { updateMany: txRequestUpdateMany },
        subscription: { updateMany: txSubscriptionUpdateMany, create: jest.fn() },
        creditTransaction: { create: jest.fn() },
      })
    );

    const response = await PATCH(makeRequest({ requestId: 'req-aria', action: 'APPROVED' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(txSubscriptionUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 'student-1', status: 'ACTIVE' },
        data: expect.objectContaining({
          ariaSubjects: JSON.stringify(['MATIERE_SUPPLEMENTAIRE']),
          ariaCost: 50,
        }),
      })
    );
  });
});
