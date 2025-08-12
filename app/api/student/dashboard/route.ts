import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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

    // Fetch student data
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
        sessions: {
          where: {
            status: { in: ['SCHEDULED', 'COMPLETED'] }
          },
          include: {
            coach: {
              include: {
                user: true
              }
            }
          },
          orderBy: { scheduledAt: 'desc' },
          take: 5
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

    // Get next session
    const nextSession = student.sessions.find((session: any) => 
      session.status === 'SCHEDULED' && 
      new Date(session.scheduledAt) > new Date()
    );

    // Get recent ARIA messages count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ariaMessagesToday = student.ariaConversations.reduce((count: number, conversation: any) => {
      const messagesToday = conversation.messages.filter((message: any) => 
        new Date(message.createdAt) >= today
      ).length;
      return count + messagesToday;
    }, 0);

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
      nextSession: nextSession ? {
        id: nextSession.id,
        title: nextSession.title,
        subject: nextSession.subject,
        scheduledAt: nextSession.scheduledAt,
        duration: nextSession.duration,
        coach: {
          firstName: nextSession.coach.user.firstName,
          lastName: nextSession.coach.user.lastName,
          pseudonym: nextSession.coach.pseudonym
        }
      } : null,
      recentSessions: student.sessions.map((session: any) => ({
        id: session.id,
        title: session.title,
        subject: session.subject,
        status: session.status,
        scheduledAt: session.scheduledAt,
        coach: {
          firstName: session.coach.user.firstName,
          lastName: session.coach.user.lastName,
          pseudonym: session.coach.pseudonym
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