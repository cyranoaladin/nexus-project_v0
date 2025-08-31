jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } }),
}));

describe('Admin Dashboard API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject non-admin', async () => {
    const { getServerSession } = require('next-auth');
    getServerSession.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/admin/dashboard');
    const { GET } = require('@/app/api/admin/dashboard/route');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('should return aggregated stats', async () => {
    (prisma.user.count as any) = jest.fn();
    (prisma.student.count as any) = jest.fn();
    (prisma.coachProfile.count as any) = jest.fn();
    (prisma.parentProfile.count as any) = jest.fn();
    (prisma.subscription.count as any) = jest.fn();
    (prisma.session.count as any) = jest.fn();
    (prisma as any).payment = (prisma as any).payment || {};
    (prisma as any).payment.aggregate = jest.fn();

    (prisma.user.count as jest.Mock).mockResolvedValueOnce(10).mockResolvedValueOnce(1); // totalUsers, assistants
    (prisma.student.count as jest.Mock).mockResolvedValue(5);
    (prisma.coachProfile.count as jest.Mock).mockResolvedValue(2);
    (prisma.parentProfile.count as jest.Mock).mockResolvedValue(3);

    // payments aggregates: total, last30Days
    ((prisma as any).payment.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { amount: 1800 } })
      .mockResolvedValueOnce({ _sum: { amount: 1000 } });

    // subscriptions: total, active
    (prisma.subscription.count as jest.Mock).mockResolvedValueOnce(6).mockResolvedValueOnce(4);

    // sessions: thisMonth, lastMonth, total
    (prisma.session.count as jest.Mock)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(30);

    const req = new NextRequest('http://localhost/api/admin/dashboard');
    const { GET } = require('@/app/api/admin/dashboard/route');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.totalUsers).toBe(10);
    expect(json.systemHealth.database).toBe('healthy');
  });
});
