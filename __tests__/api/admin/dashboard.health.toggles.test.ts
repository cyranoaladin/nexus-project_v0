jest.mock('@/lib/auth', () => ({ authOptions: {} }));
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';

jest.mock('next-auth', () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { id: 'admin1', role: 'ADMIN' } }),
}));

describe('Admin Dashboard - systemHealth toggles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockCounts({
    revenueNow,
    revenuePrev,
    activeSubs,
    sessionNow,
    sessionPrev,
    totals = {} as any,
  }: {
    revenueNow: number;
    revenuePrev: number;
    activeSubs: number;
    sessionNow: number;
    sessionPrev: number;
    totals?: {
      totalUsers?: number;
      totalAssistants?: number;
      totalStudents?: number;
      totalCoaches?: number;
      totalParents?: number;
      totalSubscriptions?: number;
      totalSessions?: number;
    };
  }) {
    (prisma as any).user = (prisma as any).user || {};
    (prisma as any).student = (prisma as any).student || {};
    (prisma as any).coachProfile = (prisma as any).coachProfile || {};
    (prisma as any).parentProfile = (prisma as any).parentProfile || {};
    (prisma as any).subscription = (prisma as any).subscription || {};
    (prisma as any).payment = (prisma as any).payment || {};

    (prisma as any).user.count = jest
      .fn()
      .mockResolvedValueOnce(totals.totalUsers ?? 10)
      .mockResolvedValueOnce(totals.totalAssistants ?? 1);
    (prisma as any).student.count = jest.fn().mockResolvedValue(totals.totalStudents ?? 5);
    (prisma as any).coachProfile.count = jest.fn().mockResolvedValue(totals.totalCoaches ?? 2);
    (prisma as any).parentProfile.count = jest.fn().mockResolvedValue(totals.totalParents ?? 3);

    // payment aggregates
    (prisma as any).payment.aggregate = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { amount: revenueNow } })
      .mockResolvedValueOnce({ _sum: { amount: revenuePrev } });

    (prisma as any).subscription.count = jest
      .fn()
      .mockResolvedValueOnce(totals.totalSubscriptions ?? 6)
      .mockResolvedValueOnce(activeSubs);

    (prisma as any).session = (prisma as any).session || {};
    (prisma as any).session.count = jest
      .fn()
      .mockResolvedValueOnce(sessionNow)
      .mockResolvedValueOnce(sessionPrev)
      .mockResolvedValueOnce(totals.totalSessions ?? sessionNow + sessionPrev);
  }

  it('marks all as active when revenue, sessions, subscriptions are positive', async () => {
    mockCounts({
      revenueNow: 1000,
      revenuePrev: 800,
      activeSubs: 3,
      sessionNow: 10,
      sessionPrev: 5,
    });

    // Stubs manquants pour les listes utilisées par le route handler
    (prisma as any).payment.findMany = jest.fn().mockResolvedValue([]);
    (prisma as any).user.findMany = jest.fn().mockResolvedValue([]);
    (prisma as any).sessionBooking = (prisma as any).sessionBooking || {};
    (prisma as any).subscriptionRequest = (prisma as any).subscriptionRequest || {};
    (prisma as any).sessionBooking.findMany = jest.fn().mockResolvedValue([]);
    (prisma as any).subscriptionRequest.findMany = jest.fn().mockResolvedValue([]);

    const { GET } = require('@/app/api/admin/dashboard/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/dashboard'));
    const json = await res.json();

    expect(json.systemHealth.payments).toBe('active');
    expect(json.systemHealth.sessions).toBe('active');
    expect(json.systemHealth.subscriptions).toBe('active');
  });

  it('marks all as inactive when values are zero', async () => {
    mockCounts({ revenueNow: 0, revenuePrev: 0, activeSubs: 0, sessionNow: 0, sessionPrev: 0 });

    // Stubs manquants pour les listes utilisées par le route handler
    (prisma as any).payment.findMany = jest.fn().mockResolvedValue([]);
    (prisma as any).user.findMany = jest.fn().mockResolvedValue([]);
    (prisma as any).sessionBooking = (prisma as any).sessionBooking || {};
    (prisma as any).subscriptionRequest = (prisma as any).subscriptionRequest || {};
    (prisma as any).sessionBooking.findMany = jest.fn().mockResolvedValue([]);
    (prisma as any).subscriptionRequest.findMany = jest.fn().mockResolvedValue([]);

    const { GET } = require('@/app/api/admin/dashboard/route');
    const res = await GET(new NextRequest('http://localhost/api/admin/dashboard'));
    const json = await res.json();

    expect(json.systemHealth.payments).toBe('inactive');
    expect(json.systemHealth.sessions).toBe('inactive');
    expect(json.systemHealth.subscriptions).toBe('inactive');
  });
});
