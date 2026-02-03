export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

interface BadgeData {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string | null;
  earnedAt: Date;
  isRecent: boolean;
}

interface FinancialTransaction {
  id: string;
  type: string;
  description: string;
  amount: number;
  status?: string;
  date: Date;
  childId?: string;
  childName?: string;
}

interface ProgressDataPoint {
  date: string;
  progress: number;
  completedSessions: number;
  totalSessions: number;
}

interface SubjectProgressDataPoint {
  subject: string;
  progress: number;
  completedSessions: number;
  totalSessions: number;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const userId = session.user.id;

    // First get the parent profile
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: userId },
    });

    if (!parentProfile) {
      return NextResponse.json(
        { error: 'Parent profile not found' },
        { status: 404 }
      );
    }

    // Get parent with children and their details
    const parent = await prisma.parentProfile.findUnique({
      where: { id: parentProfile.id },
      include: {
        user: true,
        children: {
          include: {
            user: true,
            creditTransactions: {
              orderBy: {
                createdAt: 'desc'
              }
            },
            badges: {
              include: {
                badge: true
              },
              orderBy: {
                earnedAt: 'desc'
              }
            },
            subscriptions: {
              where: {
                status: 'ACTIVE'
              },
              orderBy: {
                createdAt: 'desc'
              },
              take: 1
            }
          }
        }
      }
    });

    if (!parent) {
      return NextResponse.json(
        { error: 'Parent profile not found' },
        { status: 404 }
      );
    }

    // Get parent payments
    const parentPayments = await prisma.payment.findMany({
      where: {
        userId: userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Calculate 3 months ago date for progress history
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Format children data with async progress calculation
    const children = await Promise.all(parent.children.map(async (student) => {
      // Calculate credit balance from transactions
      const creditBalance = student.creditTransactions.reduce((total: number, transaction) => {
        return total + transaction.amount;
      }, 0);

      // Process badges with isRecent flag (within last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      
      const badges: BadgeData[] = student.badges.map(sb => ({
        id: sb.badge.id,
        name: sb.badge.name,
        description: sb.badge.description,
        category: sb.badge.category,
        icon: sb.badge.icon,
        earnedAt: sb.earnedAt,
        isRecent: sb.earnedAt > sevenDaysAgo
      }));

      // Get next session
      // Récupérer la prochaine session depuis SessionBooking (par userId élève)
      const nextSessionBooking = await prisma.sessionBooking.findFirst({
        where: {
          studentId: student.userId,
          scheduledDate: { gte: new Date() },
          status: { in: ['SCHEDULED', 'CONFIRMED'] }
        },
        orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }]
      });

      // Get active subscription
      const activeSubscription = student.subscriptions.length > 0 ? student.subscriptions[0] : null;

      // Calculate dynamic progress based on completed sessions
      const completedSessions = await prisma.sessionBooking.count({
        where: {
          studentId: student.userId,
          status: 'COMPLETED'
        }
      });

      const totalSessions = await prisma.sessionBooking.count({
        where: {
          studentId: student.userId
        }
      });

      // Calculate progress based on completed sessions and credit usage
      let progress = 0;
      if (totalSessions > 0) {
        progress = Math.round((completedSessions / totalSessions) * 100);
      } else {
        // If no sessions, calculate based on credit usage
        const usedCredits = Math.abs(student.creditTransactions
          .filter((tx) => tx.amount < 0)
          .reduce((sum, tx) => sum + tx.amount, 0));

        const totalCredits = student.creditTransactions
          .filter((tx) => tx.amount > 0)
          .reduce((sum, tx) => sum + tx.amount, 0);

        if (totalCredits > 0) {
          progress = Math.round((usedCredits / totalCredits) * 100);
        }
      }

      // Ensure progress is between 0 and 100
      progress = Math.max(0, Math.min(100, progress));

      // Get subject-specific progress
      const subjectProgress = await prisma.sessionBooking.groupBy({
        by: ['subject'],
        where: {
          studentId: student.userId
        },
        _count: { id: true }
      });

      // Calculate subject progress
      const subjectProgressMap = new Map();
      for (const subject of subjectProgress) {
        const completedSessions = await prisma.sessionBooking.count({
          where: {
            studentId: student.userId,
            subject: subject.subject,
            status: 'COMPLETED'
          }
        });

        const totalSessions = subject._count.id;
        const subjectProgressPercent = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;
        subjectProgressMap.set(subject.subject, subjectProgressPercent);
      }

      // Calculate progress history (last 3 months, grouped by week)
      const sessionsForHistory = await prisma.sessionBooking.findMany({
        where: {
          studentId: student.userId,
          scheduledDate: { gte: threeMonthsAgo }
        },
        orderBy: {
          scheduledDate: 'asc'
        }
      });

      // Group sessions by week
      const progressHistoryMap = new Map<string, { completed: number; total: number }>();
      
      sessionsForHistory.forEach(session => {
        const weekStart = new Date(session.scheduledDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekKey = weekStart.toISOString().split('T')[0];
        
        const existing = progressHistoryMap.get(weekKey) || { completed: 0, total: 0 };
        existing.total += 1;
        if (session.status === 'COMPLETED') {
          existing.completed += 1;
        }
        progressHistoryMap.set(weekKey, existing);
      });

      const progressHistory: ProgressDataPoint[] = Array.from(progressHistoryMap.entries())
        .map(([date, data]) => ({
          date,
          progress: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
          completedSessions: data.completed,
          totalSessions: data.total
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Calculate subject-specific progress history
      const subjectProgressHistory: SubjectProgressDataPoint[] = [];
      const subjectMap = new Map<string, { completed: number; total: number }>();

      sessionsForHistory.forEach(session => {
        const subject = session.subject;
        const existing = subjectMap.get(subject) || { completed: 0, total: 0 };
        existing.total += 1;
        if (session.status === 'COMPLETED') {
          existing.completed += 1;
        }
        subjectMap.set(subject, existing);
      });

      subjectMap.forEach((data, subject) => {
        subjectProgressHistory.push({
          subject,
          progress: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
          completedSessions: data.completed,
          totalSessions: data.total
        });
      });

      // Get subscription details
      const subscriptionDetails = activeSubscription ? {
        planName: activeSubscription.planName,
        monthlyPrice: activeSubscription.monthlyPrice,
        status: activeSubscription.status,
        startDate: activeSubscription.startDate,
        endDate: activeSubscription.endDate
      } : null;

      return {
        id: student.userId,
        studentId: student.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        grade: student.grade,
        school: student.school,
        credits: creditBalance,
        subscription: activeSubscription?.planName || 'AUCUN',
        subscriptionDetails: subscriptionDetails,
        nextSession: nextSessionBooking ? {
          id: nextSessionBooking.id,
          subject: nextSessionBooking.subject,
          scheduledAt: new Date(`${nextSessionBooking.scheduledDate.toISOString().split('T')[0]}T${nextSessionBooking.startTime}`),
          coachName: '',
          type: nextSessionBooking.type,
          status: nextSessionBooking.status
        } : null,
        progress: progress,
        subjectProgress: Object.fromEntries(subjectProgressMap),
        badges: badges,
        progressHistory: progressHistory,
        subjectProgressHistory: subjectProgressHistory,
        sessions: []
      };
    }));

    // Merge payments and credit transactions into unified financial history
    const financialHistory: FinancialTransaction[] = [];

    // Add parent payments
    parentPayments.forEach(payment => {
      financialHistory.push({
        id: payment.id,
        type: payment.type,
        description: payment.description,
        amount: payment.amount,
        status: payment.status,
        date: payment.createdAt
      });
    });

    // Add credit transactions for all children
    parent.children.forEach(student => {
      student.creditTransactions.forEach(transaction => {
        financialHistory.push({
          id: transaction.id,
          type: transaction.type,
          description: transaction.description,
          amount: transaction.amount,
          date: transaction.createdAt,
          childId: student.userId,
          childName: `${student.user.firstName} ${student.user.lastName}`
        });
      });
    });

    // Sort by date descending
    financialHistory.sort((a, b) => b.date.getTime() - a.date.getTime());

    const dashboardData = {
      parent: {
        id: parent.id,
        firstName: parent.user.firstName,
        lastName: parent.user.lastName,
        email: parent.user.email
      },
      children: children,
      financialHistory: financialHistory
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Error fetching parent dashboard data:', error);

    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('findUnique')) {
        return NextResponse.json(
          { error: 'Parent profile not found. Please contact support.' },
          { status: 404 }
        );
      }
      if (error.message.includes('findMany')) {
        return NextResponse.json(
          { error: 'Error fetching children data' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
