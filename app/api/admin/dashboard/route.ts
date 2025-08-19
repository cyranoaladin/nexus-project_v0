export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- User Statistics ---
    const [totalUsers, totalStudents, totalCoaches, totalAssistants, totalParents] = await Promise.all([
      prisma.user.count(),
      prisma.student.count(),
      prisma.coachProfile.count(),
      prisma.user.count({ where: { role: 'ASSISTANTE' } }),
      prisma.parentProfile.count(),
    ]);

    // --- Revenue Statistics (match UI expectations) ---
    const now = new Date();
    const last30Days = new Date(now);
    last30Days.setDate(now.getDate() - 30);

    const totalRevenueAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'COMPLETED' },
    });
    const last30DaysRevenueAgg = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'COMPLETED', createdAt: { gte: last30Days } },
    });
    const totalRevenue = Number(totalRevenueAgg._sum.amount || 0);
    const revenueLast30Days = Number(last30DaysRevenueAgg._sum.amount || 0);

    // --- Subscription Statistics ---
    const [totalSubscriptions, activeSubscriptions] = await Promise.all([
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    ]);

    // --- Session Statistics ---
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstDayTwoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

    const [thisMonthSessions, lastMonthSessions] = await Promise.all([
      prisma.session.count({ where: { scheduledAt: { gte: firstDayThisMonth } } }),
      prisma.session.count({ where: { scheduledAt: { gte: firstDayLastMonth, lt: firstDayThisMonth } } }),
    ]);
    const sessionGrowthPercent = lastMonthSessions > 0 ? ((thisMonthSessions - lastMonthSessions) / lastMonthSessions) * 100 : 0;
    const totalSessions = await prisma.session.count();

    // --- System Health ---
    const healthStatus = {
      database: 'healthy',
      sessions: thisMonthSessions > 0 ? 'active' : 'inactive',
      payments: revenueLast30Days > 0 ? 'active' : 'inactive',
      subscriptions: activeSubscriptions > 0 ? 'active' : 'inactive'
    };

    // --- Response Formatting (flat fields expected by UI) ---
    return NextResponse.json({
      totalUsers,
      totalStudents,
      totalCoaches,
      totalAssistants,
      totalParents,
      totalRevenue,
      revenueLast30Days,
      totalSubscriptions,
      activeSubscriptions,
      totalSessions,
      thisMonthSessions,
      lastMonthSessions,
      sessionGrowthPercent: Math.round(sessionGrowthPercent),
      systemHealth: healthStatus,
      recentActivities: [],
      userGrowth: [],
      revenueGrowth: [],
    });

  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
