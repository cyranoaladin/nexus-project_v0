import { auth } from '@/auth';
import { POST } from '@/app/api/subscriptions/change/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findFirst: jest.fn() },
    subscription: { create: jest.fn() },
  },
}));

function makeRequest(body?: any) {
  return {
    json: async () => body,
  } as any;
}

describe('POST /api/subscriptions/change', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not parent', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain('Accès');
  });

  it('returns 400 when plan invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });

    const response = await POST(makeRequest({ studentId: 'student-1', newPlan: 'INVALID' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Plan');
  });

  it('returns 400 when payload invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });

    const response = await POST(makeRequest({ newPlan: 'HYBRIDE' }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Données');
  });

  it('returns 404 when student not found', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest({ studentId: 'student-1', newPlan: 'HYBRIDE' }));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toContain('Élève');
  });

  it('creates a pending subscription when valid', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({
      id: 'student-1',
      subscriptions: [],
    });
    (prisma.subscription.create as jest.Mock).mockResolvedValue({
      id: 'sub-1',
    });

    const response = await POST(makeRequest({ studentId: 'student-1', newPlan: 'HYBRIDE' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.subscriptionId).toBe('sub-1');
    expect(prisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: 'student-1',
          planName: 'HYBRIDE',
          status: 'INACTIVE',
        }),
      })
    );
  });
});
