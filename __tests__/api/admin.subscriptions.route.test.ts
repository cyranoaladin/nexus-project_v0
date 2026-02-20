import { GET, PUT } from '@/app/api/admin/subscriptions/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    subscription: {
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  },
}));

function makeRequest(url: string, body?: any) {
  return {
    url,
    json: async () => body,
  } as any;
}

describe('GET /api/admin/subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not admin', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest('http://localhost:3000/api/admin/subscriptions'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns subscriptions with pagination', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    (prisma.subscription.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'sub-1',
        planName: 'Plan A',
        monthlyPrice: 100,
        status: 'ACTIVE',
        startDate: new Date('2025-01-01'),
        endDate: null,
        createdAt: new Date('2025-01-01'),
        student: {
          id: 'student-1',
          grade: 'Seconde',
          school: 'Lycée',
          user: { firstName: 'Student', lastName: 'One', email: 's1@test.com' },
          parent: { user: { firstName: 'Parent', lastName: 'One', email: 'p1@test.com' } },
        },
      },
    ]);
    (prisma.subscription.count as jest.Mock).mockResolvedValue(1);

    const response = await GET(makeRequest('http://localhost:3000/api/admin/subscriptions?status=ACTIVE'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.subscriptions).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });
});

describe('PUT /api/admin/subscriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not admin', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await PUT(makeRequest('http://localhost:3000/api/admin/subscriptions', {}));

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid status', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    const response = await PUT(
      makeRequest('http://localhost:3000/api/admin/subscriptions', {
        subscriptionId: 'sub-1',
        status: 'INVALID',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid status value');
  });

  it('returns 400 for missing subscriptionId', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    const response = await PUT(
      makeRequest('http://localhost:3000/api/admin/subscriptions', {
        status: 'ACTIVE',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Subscription ID is required');
  });

  it('updates subscription for valid payload', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    (prisma.subscription.update as jest.Mock).mockResolvedValue({
      id: 'sub-1',
      status: 'CANCELLED',
      endDate: new Date('2025-02-01'),
      student: { user: { firstName: 'Student', lastName: 'One' } },
    });

    const response = await PUT(
      makeRequest('http://localhost:3000/api/admin/subscriptions', {
        subscriptionId: 'sub-1',
        status: 'CANCELLED',
        endDate: '2025-02-01',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.subscription.id).toBe('sub-1');
  });
});
