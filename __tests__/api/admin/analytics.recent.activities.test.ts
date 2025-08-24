jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } }),
}));

describe('Admin Analytics - recent activities and formatting branches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma as any).payment = (prisma as any).payment || {};
    (prisma as any).user = (prisma as any).user || {};
    (prisma as any).session = (prisma as any).session || {};
    (prisma as any).subscription = (prisma as any).subscription || {};
    (prisma as any).creditTransaction = (prisma as any).creditTransaction || {};
  });

  it('formats data with default amount=0 and maps activity actions for COMPLETED/SCHEDULED/CANCELLED/default', async () => {
    const now = new Date();
    (prisma as any).payment.groupBy = jest.fn().mockResolvedValue([
      { createdAt: now, _sum: { amount: undefined }, _count: { id: 1 } },
    ]);
    (prisma as any).user.groupBy = jest.fn().mockResolvedValue([
      { createdAt: now, role: 'ELEVE', _count: { id: 2 } },
    ]);
    (prisma as any).session.groupBy = jest.fn().mockResolvedValue([
      { scheduledAt: now, status: 'COMPLETED', _count: { id: 3 } },
    ]);
    (prisma as any).subscription.groupBy = jest.fn().mockResolvedValue([
      { createdAt: now, status: 'ACTIVE', _count: { id: 4 } },
    ]);
    (prisma as any).creditTransaction.groupBy = jest.fn().mockResolvedValue([
      { createdAt: now, type: 'USAGE', _sum: { amount: -3 }, _count: { id: 1 } },
    ]);

    // Recent activities with multiple statuses to cover ternary chain
    (prisma as any).session.findMany = jest.fn().mockResolvedValue([
      {
        id: 'a1',
        createdAt: now,
        status: 'COMPLETED',
        subject: 'Math',
        student: { user: { firstName: 'Stu', lastName: 'Dent' } },
        coach: { pseudonym: 'CoachC' },
      },
      {
        id: 'a2',
        createdAt: now,
        status: 'SCHEDULED',
        subject: 'Sci',
        student: { user: { firstName: 'Stu', lastName: 'Dent' } },
        coach: { pseudonym: 'CoachS' },
      },
      {
        id: 'a3',
        createdAt: now,
        status: 'CANCELLED',
        subject: 'Hist',
        student: { user: { firstName: 'Stu', lastName: 'Dent' } },
        coach: { pseudonym: 'CoachX' },
      },
      {
        id: 'a4',
        createdAt: now,
        status: 'ONGOING',
        subject: 'Geo',
        student: { user: { firstName: 'Stu', lastName: 'Dent' } },
        coach: { pseudonym: 'CoachO' },
      },
    ]);

    const { GET } = require('@/app/api/admin/analytics/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/analytics?period=month&type=all'));
    expect(res.status).toBe(200);
    const json = await res.json();

    // amount defaults to 0 when _sum.amount is falsy
    expect(json.revenueData[0].amount).toBe(0);

    const actions = json.recentActivities.reduce((set: Set<string>, a: any) => set.add(a.action), new Set<string>());
    expect(actions.has('Session terminée')).toBe(true);
    expect(actions.has('Session programmée')).toBe(true);
    expect(actions.has('Session annulée')).toBe(true);
    expect(actions.has('Session en cours')).toBe(true);
  });
});
