import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
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
            // Remplacé par les 5 prochaines SessionBooking liées à l'élève
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

    // Format children data with async progress calculation
    const children = await Promise.all(parent.children.map(async (student) => {
      // Calculate credit balance from transactions
      const creditBalance = student.creditTransactions.reduce((total: number, transaction) => {
        return total + transaction.amount;
      }, 0);

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
        studentId: student.id, // Keep the student.id for internal use
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
        sessions: []
      };
    }));

    const dashboardData = {
      parent: {
        id: parent.id,
        firstName: parent.user.firstName,
        lastName: parent.user.lastName,
        email: parent.user.email
      },
      children: children
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
