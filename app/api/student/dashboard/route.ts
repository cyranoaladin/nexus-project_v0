import { Prisma, SessionStatus } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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
          take: 5,
          include: {
            messages: {
              select: {
                createdAt: true
              }
            }
          }
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
    const creditBalance = student.creditTransactions.reduce((balance, transaction) => balance + transaction.amount, 0);

    // Get next session and recent sessions from SessionBooking
    const now = new Date();

    const nextSessionBookingPromise = prisma.sessionBooking.findFirst({
      where: {
        studentId: student.userId,
        scheduledDate: { gte: now },
        status: { in: [SessionStatus.SCHEDULED, SessionStatus.CONFIRMED, SessionStatus.IN_PROGRESS] }
      },
      orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
      include: {
        coach: true,
      }
    });

    const recentSessionsPromise = prisma.sessionBooking.findMany({
      where: { studentId: student.userId },
      orderBy: [{ scheduledDate: 'desc' }, { startTime: 'desc' }],
      take: 5,
      include: {
        coach: true,
      }
    });

    const [nextSessionBooking, recentSessions] = await Promise.all([
      nextSessionBookingPromise,
      recentSessionsPromise
    ]);

    // Get recent ARIA messages count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    type StudentWithRelations = NonNullable<
      Prisma.StudentGetPayload<{
        include: {
          user: true;
          subscriptions: true;
          creditTransactions: true;
          ariaConversations: {
            include: {
              messages: {
                select: {
                  createdAt: true;
                };
              };
            };
          };
          badges: {
            include: {
              badge: true;
            };
          };
        };
      }>
    >;

    const typedStudent = student as StudentWithRelations;

    const ariaMessagesToday = typedStudent.ariaConversations.reduce((count, conversation) => {
      const messagesToday = conversation.messages
        .filter((message) => new Date(message.createdAt) >= today)
        .length;
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
        transactions: typedStudent.creditTransactions.map((transaction) => ({
          id: transaction.id,
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          createdAt: transaction.createdAt
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
      recentSessions: recentSessions.map((session) => ({
        id: session.id,
        title: session.title,
        subject: session.subject,
        status: session.status,
        scheduledAt: new Date(`${session.scheduledDate.toISOString().split('T')[0]}T${session.startTime}`),
        coach: {
          firstName: session.coach?.firstName ?? '',
          lastName: session.coach?.lastName ?? '',
          pseudonym: ''
        }
      })),
      ariaStats: {
        messagesToday: ariaMessagesToday,
        totalConversations: typedStudent.ariaConversations.length
      },
      badges: typedStudent.badges.map((studentBadge) => ({
        id: studentBadge.badge.id,
        name: studentBadge.badge.name,
        description: studentBadge.badge.description,
        icon: studentBadge.badge.icon,
        earnedAt: studentBadge.earnedAt
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
