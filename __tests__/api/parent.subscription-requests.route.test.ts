import { auth } from '@/auth';
import { GET, POST } from '@/app/api/parent/subscription-requests/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    parentProfile: { findUnique: jest.fn() },
    student: { findFirst: jest.fn() },
    subscriptionRequest: { create: jest.fn(), findMany: jest.fn() },
    user: { findMany: jest.fn() },
    notification: { create: jest.fn() },
  },
}));

function makeRequest(body?: any, url?: string) {
  return {
    json: async () => body,
    url: url || 'http://localhost:3000/api/parent/subscription-requests',
  } as any;
}

describe('parent subscription-requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      user: { id: 'parent-1', role: 'PARENT', firstName: 'P', lastName: 'One', email: 'p@test.com' },
    });

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid subscription request payload');
  });

  it('POST rejects a plan change with an unknown plan key', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', firstName: 'P', lastName: 'One', email: 'p@test.com' },
    });

    const response = await POST(
      makeRequest({
        studentId: 'student-1',
        requestType: 'PLAN_CHANGE',
        planName: 'Plan A',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Plan');
    expect(prisma.subscriptionRequest.create).not.toHaveBeenCalled();
  });

  it('POST creates subscription request and notifications using catalog pricing', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', firstName: 'P', lastName: 'One', email: 'p@test.com' },
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
      makeRequest({
        studentId: 'student-1',
        requestType: 'PLAN_CHANGE',
        planName: 'HYBRIDE',
        reason: 'Upgrade',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.subscriptionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          planName: 'HYBRIDE',
          monthlyPrice: 450,
        }),
      })
    );
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it('POST creates ARIA add-on request using catalog pricing', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', firstName: 'P', lastName: 'One', email: 'p@test.com' },
    });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({
      id: 'student-1',
      user: { firstName: 'Student', lastName: 'One' },
    });
    (prisma.subscriptionRequest.create as jest.Mock).mockResolvedValue({ id: 'req-aria' });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([{ id: 'assistant-1' }]);
    (prisma.notification.create as jest.Mock).mockResolvedValue({});

    const response = await POST(
      makeRequest({
        studentId: 'student-1',
        requestType: 'ARIA_ADDON',
        planName: 'MATIERE_SUPPLEMENTAIRE',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(prisma.subscriptionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestType: 'ARIA_ADDON',
          planName: 'MATIERE_SUPPLEMENTAIRE',
          monthlyPrice: 50,
          status: 'PENDING',
        }),
      })
    );
  });

  it('POST rejects invoice details as a subscription request type', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT', firstName: 'P', lastName: 'One', email: 'p@test.com' },
    });

    const response = await POST(
      makeRequest({
        studentId: 'student-1',
        requestType: 'INVOICE_DETAILS',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid subscription request payload');
    expect(prisma.subscriptionRequest.create).not.toHaveBeenCalled();
  });

  it('GET returns 400 without studentId', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });

    const response = await GET(makeRequest(undefined, 'http://localhost:3000/api/parent/subscription-requests'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Student ID is required');
  });

  it('GET returns requests for student', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'parent-1', role: 'PARENT' },
    });
    (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
    (prisma.student.findFirst as jest.Mock).mockResolvedValue({ id: 'student-1' });
    (prisma.subscriptionRequest.findMany as jest.Mock).mockResolvedValue([{ id: 'req-1' }]);

    const response = await GET(
      makeRequest(undefined, 'http://localhost:3000/api/parent/subscription-requests?studentId=student-1')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.requests).toHaveLength(1);
  });
});
