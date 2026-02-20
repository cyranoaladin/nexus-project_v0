import { GET } from '@/app/api/admin/analytics/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    payment: { groupBy: jest.fn() },
    user: { groupBy: jest.fn() },
    sessionBooking: { groupBy: jest.fn(), findMany: jest.fn() },
    subscription: { groupBy: jest.fn() },
    creditTransaction: { groupBy: jest.fn() },
  },
}));

function makeRequest(url: string) {
  return { url } as any;
}

describe('GET /api/admin/analytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not admin', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await GET(makeRequest('http://localhost:3000/api/admin/analytics'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns analytics data for admin', async () => {
    (auth as jest.Mock).mockResolvedValue({
      user: { id: 'admin-1', role: 'ADMIN' },
    });

    (prisma.payment.groupBy as jest.Mock).mockResolvedValue([
      { createdAt: new Date('2025-01-01'), _sum: { amount: 200 }, _count: { id: 2 } },
    ]);
    (prisma.user.groupBy as jest.Mock).mockResolvedValue([
      { createdAt: new Date('2025-01-02'), role: 'ELEVE', _count: { id: 3 } },
    ]);
    (prisma.sessionBooking.groupBy as jest.Mock).mockResolvedValue([
      { scheduledDate: new Date('2025-01-03'), status: 'SCHEDULED', _count: { id: 1 } },
    ]);
    (prisma.subscription.groupBy as jest.Mock).mockResolvedValue([
      { createdAt: new Date('2025-01-04'), status: 'ACTIVE', _count: { id: 1 } },
    ]);
    (prisma.creditTransaction.groupBy as jest.Mock).mockResolvedValue([
      { createdAt: new Date('2025-01-05'), type: 'USAGE', _sum: { amount: -1 }, _count: { id: 1 } },
    ]);
    (prisma.sessionBooking.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'session-1',
        subject: 'MATHEMATIQUES',
        createdAt: new Date('2025-01-06'),
        status: 'SCHEDULED',
        student: { firstName: 'Student', lastName: 'One' },
        coach: { coachProfile: { pseudonym: 'Coach' } },
      },
    ]);

    const response = await GET(makeRequest('http://localhost:3000/api/admin/analytics?period=month'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.summary.totalRevenue).toBe(200);
    expect(body.summary.totalUsers).toBe(3);
    expect(body.revenueData).toHaveLength(1);
    expect(body.recentActivities).toHaveLength(1);
  });
});
