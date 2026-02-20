import { auth } from '@/auth';
import { GET, PATCH } from '@/app/api/assistant/subscription-requests/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscriptionRequest: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    subscription: { updateMany: jest.fn() },
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
    expect(body.error).toBe('Invalid action');
  });

  it('PATCH approves request and updates subscription', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'assistant-1', role: 'ASSISTANTE', firstName: 'A', lastName: 'S' },
    });
    (prisma.subscriptionRequest.findUnique as jest.Mock).mockResolvedValue({
      id: 'req-1',
      status: 'PENDING',
      requestType: 'PLAN_CHANGE',
      studentId: 'student-1',
      planName: 'Plan A',
      monthlyPrice: 100,
    });
    (prisma.subscriptionRequest.update as jest.Mock).mockResolvedValue({});
    (prisma.subscription.updateMany as jest.Mock).mockResolvedValue({});

    const response = await PATCH(makeRequest({ requestId: 'req-1', action: 'APPROVED' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
