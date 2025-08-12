import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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
      
      // Total sessions this month
      prisma.session.count({
        where: {
          scheduledAt: {
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
      
      // Pending bilans (recent registrations)
      prisma.user.count({
        where: {
          role: 'PARENT',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
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
      
      // Today's sessions
      prisma.session.findMany({
        where: {
          scheduledAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().setHours(23, 59, 59, 999))
          }
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
        },
        orderBy: {
          scheduledAt: 'asc'
        }
      }),
      
      // Recent activities (last 10 activities)
      prisma.session.findMany({
        take: 10,
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

    // Calculate total revenue (payments + subscriptions)
    const paymentRevenueAmount = paymentRevenue._sum.amount || 0;
    const subscriptionRevenueAmount = subscriptionRevenue._sum.monthlyPrice || 0;
    const totalRevenue = paymentRevenueAmount + subscriptionRevenueAmount;

    // Format today's sessions
    const formattedTodaySessions = todaySessions.map((session: any) => ({
      id: session.id,
      studentName: `${session.student.user.firstName} ${session.student.user.lastName}`,
      coachName: session.coach.pseudonym,
      subject: session.subject,
      time: session.scheduledAt.toLocaleTimeString('fr-FR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      }),
      status: session.status,
      type: session.type
    }));

    // Format recent activities
    const formattedRecentActivities = recentActivities.map((activity: any) => ({
      id: activity.id,
      type: 'session',
      title: `Session ${activity.subject} - ${activity.coach.pseudonym}`,
      description: `Avec ${activity.student.user.firstName} ${activity.student.user.lastName}`,
      time: activity.createdAt,
      status: activity.status
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