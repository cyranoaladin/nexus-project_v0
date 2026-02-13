import { GET } from '@/app/api/admin/dashboard/route';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/guards', () => ({
  ...jest.requireActual('@/lib/guards'),
  requireRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { count: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    student: { count: jest.fn() },
    coachProfile: { count: jest.fn() },
    parentProfile: { count: jest.fn() },
    payment: { aggregate: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    subscription: { aggregate: jest.fn(), count: jest.fn(), findMany: jest.fn() },
    sessionBooking: { count: jest.fn(), findMany: jest.fn() },
    creditTransaction: { findMany: jest.fn() },
  },
}));

const mockAdminSession = {
  user: {
    id: 'admin-1',
    email: 'admin@test.com',
    role: 'ADMIN' as const,
    firstName: 'Admin',
    lastName: 'User',
  },
};

describe('GET /api/admin/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue(mockAdminSession);
    ((isErrorResponse as any) as jest.Mock).mockReturnValue(false);
  });

  it('returns error response when not authorized', async () => {
    const mockErrorResponse = {
      json: async () => ({ error: 'Unauthorized' }),
      status: 401,
    };
    (requireRole as jest.Mock).mockResolvedValue(mockErrorResponse);
    ((isErrorResponse as any) as jest.Mock).mockReturnValue(true);

    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns dashboard stats and recent activities', async () => {
    (prisma.user.count as jest.Mock).mockResolvedValueOnce(100);
    (prisma.student.count as jest.Mock).mockResolvedValueOnce(40);
    (prisma.coachProfile.count as jest.Mock).mockResolvedValueOnce(10);
    (prisma.user.count as jest.Mock).mockResolvedValueOnce(5);
    (prisma.parentProfile.count as jest.Mock).mockResolvedValueOnce(30);

    (prisma.payment.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { amount: 1200 } })
      .mockResolvedValueOnce({ _sum: { amount: 800 } });

    (prisma.subscription.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { monthlyPrice: 600 } })
      .mockResolvedValueOnce({ _sum: { monthlyPrice: 400 } });

    (prisma.subscription.count as jest.Mock)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(12);

    (prisma.sessionBooking.count as jest.Mock)
      .mockResolvedValueOnce(200)
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(40);

    (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: 'session-1',
        subject: 'MATHEMATIQUES',
        createdAt: new Date('2025-01-05'),
        status: 'COMPLETED',
        student: { firstName: 'Alex', lastName: 'Nova' },
        coach: { coachProfile: { pseudonym: 'CoachX' }, firstName: 'John' },
      },
    ]);
    (prisma.user.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: 'user-1',
        firstName: 'Sam',
        lastName: 'Lee',
        role: 'ELEVE',
        createdAt: new Date('2025-01-04'),
      },
    ]);
    (prisma.subscription.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: 'sub-1',
        planName: 'HYBRIDE',
        status: 'ACTIVE',
        createdAt: new Date('2025-01-03'),
        student: { user: { firstName: 'Nina', lastName: 'Park' } },
      },
    ]);
    (prisma.creditTransaction.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: 'credit-1',
        type: 'CREDIT_ADD',
        amount: 5,
        createdAt: new Date('2025-01-02'),
        student: { user: { firstName: 'Omar', lastName: 'Dia' } },
      },
    ]);

    (prisma.user.count as jest.Mock).mockResolvedValueOnce(100);
    (prisma.sessionBooking.count as jest.Mock).mockResolvedValueOnce(200);
    (prisma.payment.count as jest.Mock).mockResolvedValueOnce(50);
    (prisma.subscription.count as jest.Mock).mockResolvedValueOnce(20);

    (prisma.user.groupBy as jest.Mock).mockResolvedValueOnce([
      { createdAt: new Date('2025-01-01'), _count: { id: 4 } },
    ]);
    (prisma.payment.groupBy as jest.Mock).mockResolvedValueOnce([
      { createdAt: new Date('2025-01-01'), _sum: { amount: 300 } },
    ]);

    const response = await GET({} as any);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stats.totalUsers).toBe(100);
    expect(body.stats.totalStudents).toBe(40);
    expect(body.stats.currentMonthRevenue).toBe(1800);
    expect(body.stats.lastMonthRevenue).toBe(1200);
    expect(body.recentActivities.length).toBeGreaterThan(0);
    expect(body.userGrowth[0]).toEqual({ month: '2025-01', count: 4 });
    expect(body.revenueGrowth[0]).toEqual({ month: '2025-01', amount: 300 });
  });
});
