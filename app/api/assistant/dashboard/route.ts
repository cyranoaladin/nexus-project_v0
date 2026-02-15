export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get comprehensive statistics
    const [
      totalStudents,
      totalCoaches,
      totalSessions,
      paymentRevenue,
      subscriptionRevenue,
      pendingBilans,
      pendingPayments,
      pendingCreditRequests,
      pendingSubscriptionRequests,
      todaySessions,
      recentActivities
    ] = await Promise.all([
      // Total students
      prisma.student.count(),

      // Total coaches
      prisma.coachProfile.count(),

      // Total sessions this month (SessionBooking)
      prisma.sessionBooking.count({
        where: {
          scheduledDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),

      // Payment revenue this month
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        },
        _sum: {
          amount: true
        }
      }),

      // Subscription revenue this month
      prisma.subscription.aggregate({
        where: {
          status: 'ACTIVE',
          startDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        },
        _sum: {
          monthlyPrice: true
        }
      }),

      // Pending bilans (diagnostics not yet analyzed)
      prisma.diagnostic.count({
        where: {
          status: {
            notIn: ['ANALYZED', 'FAILED']
          }
        }
      }),

      // Pending payments
      prisma.payment.count({
        where: {
          status: 'PENDING'
        }
      }),

      // Pending credit requests
      prisma.creditTransaction.count({
        where: {
          type: 'CREDIT_REQUEST'
        }
      }),

      // Pending subscription requests
      prisma.subscriptionRequest.count({
        where: {
          status: 'PENDING'
        }
      }),

      // Today's sessions (SessionBooking)
      prisma.sessionBooking.findMany({
        where: {
          scheduledDate: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
        },
        include: {
          student: { select: { firstName: true, lastName: true } },
          coach: { select: { firstName: true, lastName: true, coachProfile: { select: { pseudonym: true } } } }
        },
        orderBy: [
          { scheduledDate: 'asc' },
          { startTime: 'asc' }
        ]
      }),

      // Recent activities (last 10) from SessionBooking
      prisma.sessionBooking.findMany({
        take: 10,
        include: {
          student: { select: { firstName: true, lastName: true } },
          coach: { select: { firstName: true, lastName: true, coachProfile: { select: { pseudonym: true } } } }
        },
        orderBy: [{ scheduledDate: 'desc' }, { startTime: 'desc' }]
      })
    ]);

    // Calculate total revenue (payments + subscriptions)
    const paymentRevenueAmount = paymentRevenue._sum.amount || 0;
    const subscriptionRevenueAmount = subscriptionRevenue._sum.monthlyPrice || 0;
    const totalRevenue = paymentRevenueAmount + subscriptionRevenueAmount;

    // Format today's sessions (includes student + coach from query)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedTodaySessions = todaySessions.map((s: any) => ({
      id: s.id,
      studentName: `${s.student?.firstName ?? ''} ${s.student?.lastName ?? ''}`.trim() || 'Élève',
      coachName: s.coach?.coachProfile?.pseudonym ?? (`${s.coach?.firstName ?? ''} ${s.coach?.lastName ?? ''}`.trim() || 'Coach'),
      subject: s.subject,
      time: s.startTime,
      status: s.status,
      type: s.type
    }));

    // Format recent activities (includes student + coach from query)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedRecentActivities = recentActivities.map((a: any) => ({
      id: a.id,
      type: 'session',
      title: `Session ${a.subject}`,
      description: `${a.student?.firstName ?? ''} ${a.student?.lastName ?? ''}`.trim(),
      time: a.scheduledDate,
      status: a.status
    }));

    const dashboardData = {
      stats: {
        totalStudents,
        totalCoaches,
        totalSessions,
        totalRevenue: totalRevenue,
        pendingBilans,
        pendingPayments,
        pendingCreditRequests,
        pendingSubscriptionRequests
      },
      todaySessions: formattedTodaySessions,
      recentActivities: formattedRecentActivities
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Error fetching assistant dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
