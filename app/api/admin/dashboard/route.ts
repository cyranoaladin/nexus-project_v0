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

    // Get current month and last month dates
    const now = new Date();
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const _lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Get comprehensive statistics
    const [
      totalUsers,
      totalStudents,
      totalCoaches,
      totalAssistants,
      totalParents,
      currentMonthPaymentRevenue,
      lastMonthPaymentRevenue,
      currentMonthSubscriptionRevenue,
      lastMonthSubscriptionRevenue,
      totalSubscriptions,
      activeSubscriptions,
      totalSessions,
      thisMonthSessions,
      lastMonthSessions,
      recentActivities,
      _systemHealth,
      userGrowth,
      revenueGrowth
    ] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Total students
      prisma.student.count(),

      // Total coaches
      prisma.coachProfile.count(),

      // Total assistants
      prisma.user.count({
        where: { role: 'ASSISTANTE' }
      }),

      // Total parents
      prisma.parentProfile.count(),

      // Current month payment revenue
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: currentMonth
          }
        },
        _sum: {
          amount: true
        }
      }),

      // Last month payment revenue
      prisma.payment.aggregate({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: lastMonth,
            lt: currentMonth
          }
        },
        _sum: {
          amount: true
        }
      }),

      // Current month subscription revenue
      prisma.subscription.aggregate({
        where: {
          status: 'ACTIVE',
          startDate: {
            gte: currentMonth
          }
        },
        _sum: {
          monthlyPrice: true
        }
      }),

      // Last month subscription revenue
      prisma.subscription.aggregate({
        where: {
          status: 'ACTIVE',
          startDate: {
            gte: lastMonth,
            lt: currentMonth
          }
        },
        _sum: {
          monthlyPrice: true
        }
      }),

      // Total subscriptions
      prisma.subscription.count(),

      // Active subscriptions
      prisma.subscription.count({
        where: {
          status: 'ACTIVE'
        }
      }),

      // Total sessions (SessionBooking)
      prisma.sessionBooking.count(),

      // This month sessions (SessionBooking)
      prisma.sessionBooking.count({
        where: {
          scheduledDate: { gte: currentMonth }
        }
      }),

      // Last month sessions (SessionBooking)
      prisma.sessionBooking.count({
        where: {
          scheduledDate: { gte: lastMonth, lt: currentMonth }
        }
      }),

      // Recent activities (last 20 activities) - including sessions, users, subscriptions, and credit transactions
      Promise.all([
        // Sessions (SessionBooking)
        prisma.sessionBooking.findMany({
          take: 10,
          orderBy: [{ scheduledDate: 'desc' }, { startTime: 'desc' }],
          include: {
            student: { include: {} },
            coach: { include: {} },
          }
        }),
        // New users
        prisma.user.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' }
        }),
        // New subscriptions
        prisma.subscription.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            student: { include: { user: true } }
          }
        }),
        // Credit transactions
        prisma.creditTransaction.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            student: { include: { user: true } }
          }
        })
      ]),

      // System health check
      Promise.all([
        prisma.user.count(),
        prisma.sessionBooking.count(),
        prisma.payment.count(),
        prisma.subscription.count()
      ]),

      // User growth (last 6 months)
      prisma.user.groupBy({
        by: ['createdAt'],
        where: {
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth() - 6, 1)
          }
        },
        _count: {
          id: true
        }
      }),

      // Revenue growth (last 6 months)
      prisma.payment.groupBy({
        by: ['createdAt'],
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth() - 6, 1)
          }
        },
        _sum: {
          amount: true
        }
      })
    ]);

    // Calculate revenue including subscriptions
    const currentMonthPaymentAmount = currentMonthPaymentRevenue._sum.amount || 0;
    const currentMonthSubscriptionAmount = currentMonthSubscriptionRevenue._sum.monthlyPrice || 0;
    const currentRevenue = currentMonthPaymentAmount + currentMonthSubscriptionAmount;

    const lastMonthPaymentAmount = lastMonthPaymentRevenue._sum.amount || 0;
    const lastMonthSubscriptionAmount = lastMonthSubscriptionRevenue._sum.monthlyPrice || 0;
    const lastRevenue = lastMonthPaymentAmount + lastMonthSubscriptionAmount;

    const revenueGrowthPercent = lastRevenue > 0 ? ((currentRevenue - lastRevenue) / lastRevenue) * 100 : 0;

    const sessionGrowthPercent = lastMonthSessions > 0 ? ((thisMonthSessions - lastMonthSessions) / lastMonthSessions) * 100 : 0;

    // Format recent activities - combine all activity types
    const [sessions, users, subscriptions, creditTransactions] = recentActivities as [any[], any[], any[], any[]];

    const formattedRecentActivities = [
      // Format sessions
      ...sessions.map((activity) => ({
        id: activity.id,
        type: 'session',
        title: `Session ${activity.subject}`,
        description: `${activity.student?.firstName || 'Unknown'} ${activity.student?.lastName || 'Student'} avec ${activity.coach?.firstName || ''} ${activity.coach?.lastName || ''}`.trim(),
        time: activity.createdAt,
        status: activity.status,
        studentName: `${activity.student?.firstName || 'Unknown'} ${activity.student?.lastName || 'Student'}`,
        coachName: `${activity.coach?.firstName || ''} ${activity.coach?.lastName || ''}`.trim(),
        subject: activity.subject,
        action: activity.status === 'COMPLETED' ? 'Session terminée' :
          activity.status === 'SCHEDULED' ? 'Session programmée' :
            activity.status === 'CANCELLED' ? 'Session annulée' : 'Session en cours'
      })),

      // Format new users
      ...users.map((user) => ({
        id: user.id,
        type: 'user',
        title: `Nouvel utilisateur: ${user.firstName} ${user.lastName}`,
        description: `${user.firstName} ${user.lastName} (${user.role})`,
        time: user.createdAt,
        status: 'CREATED',
        studentName: `${user.firstName} ${user.lastName}`,
        coachName: '',
        subject: user.role,
        action: 'Utilisateur créé'
      })),

      // Format new subscriptions
      ...subscriptions.map((subscription) => ({
        id: subscription.id,
        type: 'subscription',
        title: `Nouvel abonnement: ${subscription.planName}`,
        description: `${subscription.student?.user?.firstName || 'Unknown'} ${subscription.student?.user?.lastName || 'Student'} - ${subscription.planName}`,
        time: subscription.createdAt,
        status: subscription.status,
        studentName: `${subscription.student?.user?.firstName || 'Unknown'} ${subscription.student?.user?.lastName || 'Student'}`,
        coachName: '',
        subject: subscription.planName,
        action: 'Abonnement créé'
      })),

      // Format credit transactions
      ...creditTransactions.map((transaction) => ({
        id: transaction.id,
        type: 'credit',
        title: `Transaction crédit: ${transaction.type}`,
        description: `${transaction.student?.user?.firstName || 'Unknown'} ${transaction.student?.user?.lastName || 'Student'} - ${transaction.amount} crédits`,
        time: transaction.createdAt,
        status: 'COMPLETED',
        studentName: `${transaction.student?.user?.firstName || 'Unknown'} ${transaction.student?.user?.lastName || 'Student'}`,
        coachName: '',
        subject: transaction.type,
        action: `Transaction ${transaction.type}`
      }))
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 20);

    // System health status
    const healthStatus = {
      database: 'healthy',
      sessions: thisMonthSessions > 0 ? 'active' : 'inactive',
      payments: currentRevenue > 0 ? 'active' : 'inactive',
      subscriptions: activeSubscriptions > 0 ? 'active' : 'inactive'
    };

    const dashboardData = {
      stats: {
        totalUsers,
        totalStudents,
        totalCoaches,
        totalAssistants,
        totalParents,
        currentMonthRevenue: currentRevenue,
        currentMonthPaymentRevenue: currentMonthPaymentAmount,
        currentMonthSubscriptionRevenue: currentMonthSubscriptionAmount,
        lastMonthRevenue: lastRevenue,
        lastMonthPaymentRevenue: lastMonthPaymentAmount,
        lastMonthSubscriptionRevenue: lastMonthSubscriptionAmount,
        revenueGrowthPercent: Math.round(revenueGrowthPercent * 100) / 100,
        totalSubscriptions,
        activeSubscriptions,
        totalSessions,
        thisMonthSessions,
        lastMonthSessions,
        sessionGrowthPercent: Math.round(sessionGrowthPercent * 100) / 100
      },
      systemHealth: healthStatus,
      recentActivities: formattedRecentActivities,
      userGrowth: userGrowth.map((item) => ({
        month: item.createdAt.toISOString().slice(0, 7),
        count: item._count.id
      })),
      revenueGrowth: revenueGrowth.map((item) => ({
        month: item.createdAt.toISOString().slice(0, 7),
        amount: item._sum.amount || 0
      }))
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
