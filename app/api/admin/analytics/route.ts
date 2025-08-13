import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // month, quarter, year
    const _type = searchParams.get('type') || 'all'; // all, revenue, users, sessions

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Get comprehensive analytics data
    const [
      revenueData,
      userGrowthData,
      sessionData,
      subscriptionData,
      creditTransactionData,
      recentActivities
    ] = await Promise.all([
      // Revenue analytics
      prisma.payment.groupBy({
        by: ['createdAt'],
        where: {
          status: 'COMPLETED',
          createdAt: { gte: startDate }
        },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      }),

      // User growth analytics
      prisma.user.groupBy({
        by: ['createdAt', 'role'],
        where: {
          createdAt: { gte: startDate }
        },
        _count: {
          id: true
        }
      }),

      // Session analytics
      prisma.session.groupBy({
        by: ['scheduledAt', 'status'],
        where: {
          scheduledAt: { gte: startDate }
        },
        _count: {
          id: true
        }
      }),

      // Subscription analytics
      prisma.subscription.groupBy({
        by: ['createdAt', 'status'],
        where: {
          createdAt: { gte: startDate }
        },
        _count: {
          id: true
        }
      }),

      // Credit transaction analytics
      prisma.creditTransaction.groupBy({
        by: ['createdAt', 'type'],
        where: {
          createdAt: { gte: startDate }
        },
        _sum: {
          amount: true
        },
        _count: {
          id: true
        }
      }),

      // Recent activities (last 50)
      prisma.session.findMany({
        take: 50,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          student: {
            include: {
              user: true
            }
          },
          coach: {
            include: {
              user: true
            }
          }
        }
      })
    ]);

    // Format revenue data
    const formattedRevenueData = revenueData.map((item) => ({
      date: item.createdAt.toISOString().slice(0, 10),
      amount: item._sum.amount || 0,
      count: item._count.id
    }));

    // Format user growth data
    const formattedUserGrowthData = userGrowthData.map((item) => ({
      date: item.createdAt.toISOString().slice(0, 10),
      role: item.role,
      count: item._count.id
    }));

    // Format session data
    const formattedSessionData = sessionData.map((item) => ({
      date: item.scheduledAt.toISOString().slice(0, 10),
      status: item.status,
      count: item._count.id
    }));

    // Format subscription data
    const formattedSubscriptionData = subscriptionData.map((item) => ({
      date: item.createdAt.toISOString().slice(0, 10),
      status: item.status,
      count: item._count.id
    }));

    // Format credit transaction data
    const formattedCreditData = creditTransactionData.map((item) => ({
      date: item.createdAt.toISOString().slice(0, 10),
      type: item.type,
      amount: item._sum.amount || 0,
      count: item._count.id
    }));

    // Format recent activities
    const formattedRecentActivities = recentActivities.map((activity) => ({
      id: activity.id,
      type: 'session',
      title: `Session ${activity.subject}`,
      description: `${activity.student.user.firstName} ${activity.student.user.lastName} avec ${activity.coach.pseudonym}`,
      time: activity.createdAt,
      status: activity.status,
      studentName: `${activity.student.user.firstName} ${activity.student.user.lastName}`,
      coachName: activity.coach.pseudonym,
      subject: activity.subject,
      action: activity.status === 'COMPLETED' ? 'Session terminée' :
        activity.status === 'SCHEDULED' ? 'Session programmée' :
          activity.status === 'CANCELLED' ? 'Session annulée' : 'Session en cours'
    }));

    // Calculate summary statistics
    const totalRevenue = formattedRevenueData.reduce((sum: number, item) => sum + item.amount, 0);
    const totalUsers = formattedUserGrowthData.reduce((sum: number, item) => sum + item.count, 0);
    const totalSessions = formattedSessionData.reduce((sum: number, item) => sum + item.count, 0);
    const totalSubscriptions = formattedSubscriptionData.reduce((sum: number, item) => sum + item.count, 0);

    const analyticsData = {
      period,
      summary: {
        totalRevenue,
        totalUsers,
        totalSessions,
        totalSubscriptions
      },
      revenueData: formattedRevenueData,
      userGrowthData: formattedUserGrowthData,
      sessionData: formattedSessionData,
      subscriptionData: formattedSubscriptionData,
      creditData: formattedCreditData,
      recentActivities: formattedRecentActivities
    };

    return NextResponse.json(analyticsData);

  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
