import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the current session
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ELEVE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const studentId = session.user.id;

    // Fetch student core and aggregates
    const student = await prisma.student.findUnique({
      where: { userId: studentId },
      include: {
        user: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        creditTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        ariaConversations: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        badges: {
          include: {
            badge: true
          },
          orderBy: { earnedAt: 'desc' },
          take: 5
        }
      }
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Calculate available credits
    const creditBalance = student.creditTransactions.reduce((balance: number, transaction: any) => {
      return balance + transaction.amount;
    }, 0);

    // Get next session and recent sessions from SessionBooking
    const now = new Date();
    const [nextSessionBooking, recentSessions] = await Promise.all([
      prisma.sessionBooking.findFirst({
        where: {
          studentId: student.userId,
          scheduledDate: { gte: now },
          status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] }
        },
        orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
        include: {
          coach: true,
        }
      }),
      prisma.sessionBooking.findMany({
        where: { studentId: student.userId },
        orderBy: [{ scheduledDate: 'desc' }, { startTime: 'desc' }],
        take: 5,
        include: {
          coach: true,
        }
      })
    ]);

    // Get recent ARIA messages count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ariaMessagesToday = (student as any).ariaConversations?.reduce((count: number, conversation: any) => {
      const messagesToday = conversation.messages?.filter((message: any) =>
        new Date(message.createdAt) >= today
      ).length || 0;
      return count + messagesToday;
    }, 0) ?? 0;

    // Format dashboard data
    const dashboardData = {
      student: {
        id: student.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        email: student.user.email,
        grade: student.grade,
        school: student.school
      },
      credits: {
        balance: creditBalance,
        transactions: student.creditTransactions.map((t: any) => ({
          id: t.id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          createdAt: t.createdAt
        }))
      },
      nextSession: nextSessionBooking ? {
        id: nextSessionBooking.id,
        title: nextSessionBooking.title,
        subject: nextSessionBooking.subject,
        scheduledAt: new Date(`${nextSessionBooking.scheduledDate.toISOString().split('T')[0]}T${nextSessionBooking.startTime}`),
        duration: nextSessionBooking.duration,
        coach: {
          firstName: nextSessionBooking.coach?.firstName ?? '',
          lastName: nextSessionBooking.coach?.lastName ?? '',
          pseudonym: ''
        }
      } : null,
      recentSessions: recentSessions.map((s: any) => ({
        id: s.id,
        title: s.title,
        subject: s.subject,
        status: s.status,
        scheduledAt: new Date(`${s.scheduledDate.toISOString().split('T')[0]}T${s.startTime}`),
        coach: {
          firstName: s.coach?.firstName ?? '',
          lastName: s.coach?.lastName ?? '',
          pseudonym: ''
        }
      })),
      ariaStats: {
        messagesToday: ariaMessagesToday,
        totalConversations: student.ariaConversations.length
      },
      badges: student.badges.map((sb: any) => ({
        id: sb.badge.id,
        name: sb.badge.name,
        description: sb.badge.description,
        icon: sb.badge.icon,
        earnedAt: sb.earnedAt
      }))
    };

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Error fetching student dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
