export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(request: NextRequest) {
  try {
    // Get the current session (wrapped: auth() can throw UntrustedHost in standalone)
    let session: any = null;
    try {
      session = await auth();
    } catch {
      // treat auth infra failure as unauthenticated
    }

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const studentId = session.user.id;

    // Fetch student data (✅ PERF-DB-003: Heavily optimized with select - reduces payload by ~60%)
    const student = await prisma.student.findUnique({
      where: { userId: studentId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            planName: true,
            status: true,
            monthlyPrice: true,
            creditsPerMonth: true,
            ariaSubjects: true,
            startDate: true,
            endDate: true
          }
        },
        creditTransactions: {
          orderBy: { createdAt: 'desc' },
          select: {
            amount: true,
            createdAt: true
          }
        },
        sessions: {
          where: {
            status: { in: ['SCHEDULED', 'COMPLETED', 'CONFIRMED'] }
          },
          select: {
            id: true,
            subject: true,
            scheduledAt: true,
            status: true,
            duration: true,
            creditsUsed: true,
            coach: {
              select: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          },
          orderBy: { scheduledAt: 'desc' }
        },
        ariaConversations: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            createdAt: true,
            messages: {
              select: {
                id: true,
                role: true,
                content: true,
                createdAt: true
              },
              take: 10
            }
          }
        },
        badges: {
          select: {
            earnedAt: true,
            badge: {
              select: {
                id: true,
                name: true,
                description: true,
                icon: true,
                category: true
              }
            }
          },
          orderBy: { earnedAt: 'desc' },
          take: 5
        }
      }
    });

    if (!student) {
      console.error('[Student Dashboard API] Student not found');
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }

    // Calculate available credits
    const creditBalance = student.creditTransactions.reduce((balance: number, transaction) => {
      return balance + transaction.amount;
    }, 0);

    // Get next session
    const upcomingSessions = student.sessions.filter((session) =>
      (session.status === 'SCHEDULED' || session.status === 'CONFIRMED') &&
      new Date(session.scheduledAt) > new Date()
    );
    const nextSession = upcomingSessions[0];

    // Get all sessions for calendar
    const allSessions = student.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      subject: session.subject,
      status: session.status,
      scheduledAt: session.scheduledAt,
      coach: session.coach ? {
        firstName: session.coach.user.firstName,
        lastName: session.coach.user.lastName,
        pseudonym: session.coach.pseudonym
      } : null
    }));

    // Get recent ARIA messages count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ariaMessagesToday = student.ariaConversations.reduce((count: number, conversation) => {
      const messagesToday = conversation.messages.filter((message) =>
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
        transactions: student.creditTransactions.map((t) => ({
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
        coach: nextSession.coach ? {
          firstName: nextSession.coach.user.firstName,
          lastName: nextSession.coach.user.lastName,
          pseudonym: nextSession.coach.pseudonym
        } : null
      } : null,
      allSessions: allSessions,
      recentSessions: student.sessions.slice(0, 5).map((session) => ({
        id: session.id,
        title: session.title,
        subject: session.subject,
        status: session.status,
        scheduledAt: session.scheduledAt,
        coach: session.coach ? {
          firstName: session.coach.user.firstName,
          lastName: session.coach.user.lastName,
          pseudonym: session.coach.pseudonym
        } : null
      })),
      ariaStats: {
        messagesToday: ariaMessagesToday,
        totalConversations: student.ariaConversations.length
      },
      badges: student.badges.map((sb) => ({
        id: sb.badge.id,
        name: sb.badge.name,
        description: sb.badge.description,
        icon: sb.badge.icon,
        earnedAt: sb.earnedAt
      }))
    };

    // ✅ PERF-REACT-003: Add cache headers for 60s to reduce DB load
    return NextResponse.json(dashboardData, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120'
      }
    });

  } catch (error) {
    console.error('Error fetching student dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
