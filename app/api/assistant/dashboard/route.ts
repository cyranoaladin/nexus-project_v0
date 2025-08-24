export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      totalStudents,
      totalCoaches,
      thisMonthSessions,
      paymentsAgg,
      pendingSubscriptionRequestsArr,
      pendingCreditRequestsArr,
      todaySessions,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.coachProfile.count(),
      prisma.session.count({ where: { scheduledAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'COMPLETED', createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
      }),
      prisma.subscriptionRequest.findMany({ where: { status: 'PENDING' }, select: { id: true } }),
      prisma.creditTransaction.findMany({ where: { type: 'CREDIT_REQUEST' }, select: { id: true } }),
      prisma.session.findMany({
        where: { scheduledAt: { gte: todayStart, lt: todayEnd } },
        include: {
          student: { include: { user: true } },
          coach: { include: { user: true } },
        },
        orderBy: { scheduledAt: 'asc' },
      }),
    ]);

    const formattedTodaySessions = todaySessions.map((session: any) => ({
      id: session.id,
      studentName: `${session.student.user.firstName} ${session.student.user.lastName}`,
      coachName: session.coach.pseudonym,
      subject: session.subject,
      time: new Date(session.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      status: session.status,
      type: session.type,
    }));

    return NextResponse.json({
      totalStudents,
      totalCoaches,
      thisMonthSessions,
      thisMonthRevenue: paymentsAgg._sum.amount || 0,
      pendingSubscriptionRequests: pendingSubscriptionRequestsArr,
      pendingCreditRequests: pendingCreditRequestsArr,
      todaySessions: formattedTodaySessions,
    });

  } catch (error) {
    console.error('Error fetching assistant dashboard data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
