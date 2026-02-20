import { auth } from '@/auth';
import { GET, POST } from '@/app/api/assistant/subscriptions/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    creditTransaction: { create: jest.fn() },
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
    expect(body.error).toBe('Missing required fields');
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
      planName: 'Plan A',
      studentId: 'student-1',
    });
    (prisma.subscription.update as jest.Mock).mockResolvedValue({ id: 'sub-1', status: 'ACTIVE' });

    const response = await POST(makeRequest({ subscriptionId: 'sub-1', action: 'approve' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.creditTransaction.create).toHaveBeenCalled();
  });
});
