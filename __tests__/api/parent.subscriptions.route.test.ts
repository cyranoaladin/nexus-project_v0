import { auth } from '@/auth';
import { GET, POST } from '@/app/api/parent/subscriptions/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    parentProfile: { findUnique: jest.fn() },
    student: { findMany: jest.fn(), findFirst: jest.fn() },
    subscription: { create: jest.fn() },
    subscriptionRequest: { create: jest.fn() },
    user: { findMany: jest.fn() },
    notification: { create: jest.fn() },
  },
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('parent subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET returns 401 when not parent', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('GET returns 404 when parent profile missing', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Parent profile not found');
  });

  it('GET returns formatted children subscriptions', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
    (prisma.student.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'student-1',
        grade: 'Seconde',
        school: 'Lycée',
        user: { firstName: 'Student', lastName: 'One' },
        creditTransactions: [{ amount: 2 }, { amount: -1 }],
        subscriptions: [
          { status: 'ACTIVE', planName: 'Plan A', endDate: new Date('2025-02-01') },
        ],
      },
    ]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.children).toHaveLength(1);
    expect(body.children[0].currentSubscription).toBe('Plan A');
    expect(body.children[0].creditBalance).toBe(1);
  });

  it('POST returns 401 when not parent', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('POST validates required fields', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });

    const response = await POST(makeRequest({ studentId: 'student-1' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Missing required fields');
  });

  it('POST returns 404 when parent profile missing', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue(null);

    const response = await POST(
      makeRequest({ studentId: 'student-1', planName: 'HYBRIDE', monthlyPrice: 100 })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Parent profile not found');
  });

  it('POST returns 404 when student not found', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await POST(
      makeRequest({ studentId: 'student-1', planName: 'HYBRIDE', monthlyPrice: 100 })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe('Student not found or unauthorized');
  });

  it('POST rejects an unknown plan instead of trusting client supplied pricing', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });

    const response = await POST(
      makeRequest({ studentId: 'student-1', planName: 'Plan A', monthlyPrice: 1, creditsPerMonth: 99 })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Plan');
    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(prisma.subscriptionRequest.create).not.toHaveBeenCalled();
  });

  it('POST creates canonical SubscriptionRequest with server-side catalog price', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', firstName: 'Parent', lastName: 'One', email: 'p@test.com' },
    });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({
      id: 'student-1',
      user: { firstName: 'Student', lastName: 'One' },
    });
    (prisma.subscriptionRequest.create as jest.Mock).mockResolvedValue({ id: 'req-1' });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'assistant-1' }]);
    (prisma.notification.create as jest.Mock).mockResolvedValue({});

    const response = await POST(
      makeRequest({ studentId: 'student-1', planName: 'HYBRIDE', monthlyPrice: 1, creditsPerMonth: 99 })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.requestId).toBe('req-1');
    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(prisma.subscriptionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestType: 'PLAN_CHANGE',
          planName: 'HYBRIDE',
          monthlyPrice: 450,
          status: 'PENDING',
        }),
      })
    );
  });
});
