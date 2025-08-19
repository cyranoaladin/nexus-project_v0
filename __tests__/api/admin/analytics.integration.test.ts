jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } }),
}));

describe('Admin Analytics API', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should reject non-admin', async () => {
    const { getServerSession } = require('next-auth');
    getServerSession.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/admin/analytics');
const { GET } = require('@/app/api/admin/analytics/route');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('should return analytics for current month', async () => {
    (prisma.payment.groupBy as any) = jest.fn();
    (prisma.user.groupBy as any) = jest.fn();
    (prisma.session.groupBy as any) = jest.fn();
    (prisma.subscription.groupBy as any) = jest.fn();
    (prisma.creditTransaction.groupBy as any) = jest.fn();
    (prisma.session.findMany as any) = jest.fn();
    (prisma.payment.groupBy as jest.Mock).mockResolvedValue([
      { createdAt: new Date(), _sum: { amount: 1000 }, _count: { id: 5 } },
    ]);
    (prisma.user.groupBy as jest.Mock).mockResolvedValue([
      { createdAt: new Date(), role: 'ELEVE', _count: { id: 3 } },
    ]);
    (prisma.session.groupBy as jest.Mock).mockResolvedValue([
      { scheduledAt: new Date(), status: 'COMPLETED', _count: { id: 7 } },
    ]);
    (prisma.subscription.groupBy as jest.Mock).mockResolvedValue([
      { createdAt: new Date(), status: 'ACTIVE', _count: { id: 4 } },
    ]);
    (prisma.creditTransaction.groupBy as jest.Mock).mockResolvedValue([
      { createdAt: new Date(), type: 'USAGE', _sum: { amount: -3 }, _count: { id: 3 } },
    ]);

    (prisma.session.findMany as jest.Mock).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/admin/analytics?period=month&type=all');
const { GET } = require('@/app/api/admin/analytics/route');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.summary.totalRevenue).toBeGreaterThanOrEqual(0);
  });
});
