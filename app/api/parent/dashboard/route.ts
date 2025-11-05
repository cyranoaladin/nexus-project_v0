import { Prisma, SessionStatus, Subject } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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

    type ParentWithChildren = Prisma.ParentProfileGetPayload<{
      include: {
        user: true;
        children: {
          include: {
            user: true;
            creditTransactions: true;
            subscriptions: true;
          };
        };
      };
    }>;

    type StudentSummary = ParentWithChildren['children'][number];

    type SessionWithCoach = Prisma.SessionBookingGetPayload<{
      include: {
        coach: {
          select: {
            firstName: true;
            lastName: true;
            coachProfile: {
              select: {
                pseudonym: true;
              };
            };
          };
        };
      };
    }>;

    const children = await Promise.all(
      parent.children.map(async (student: StudentSummary) => {
        const creditBalance = student.creditTransactions.reduce((total, transaction) => total + transaction.amount, 0);

        const now = new Date();

        const [nextSessionBooking, upcomingSessions] = await Promise.all([
          prisma.sessionBooking.findFirst({
            where: {
              studentId: student.userId,
              scheduledDate: { gte: now },
              status: { in: [SessionStatus.SCHEDULED, SessionStatus.CONFIRMED, SessionStatus.IN_PROGRESS] }
            },
            orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
            include: {
              coach: {
                select: {
                  firstName: true,
                  lastName: true,
                  coachProfile: {
                    select: { pseudonym: true }
                  }
                }
              }
            }
          }),
          prisma.sessionBooking.findMany({
            where: {
              studentId: student.userId,
              scheduledDate: { gte: now },
              status: { in: [SessionStatus.SCHEDULED, SessionStatus.CONFIRMED, SessionStatus.IN_PROGRESS] }
            },
            orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
            take: 10,
            include: {
              coach: {
                select: {
                  firstName: true,
                  lastName: true,
                  coachProfile: {
                    select: { pseudonym: true }
                  }
                }
              }
            }
          })
        ]);

        const resolveCoachLabel = (session: SessionWithCoach | null) => {
          if (!session?.coach) return '';

          const pseudonym = session.coach.coachProfile?.pseudonym;
          if (pseudonym) {
            return pseudonym;
          }

          const firstName = session.coach.firstName ?? '';
          const lastName = session.coach.lastName ?? '';
          return `${firstName} ${lastName}`.trim();
        };

        const buildDateTime = (scheduledDate: Date, startTime: string) => {
          const isoDate = scheduledDate.toISOString().split('T')[0];
          const normalizedTime = startTime.length === 5 ? `${startTime}:00` : startTime;
          return new Date(`${isoDate}T${normalizedTime}`);
        };

        const activeSubscription = student.subscriptions.at(0) ?? null;

        const [completedSessions, totalSessions] = await Promise.all([
          prisma.sessionBooking.count({
            where: {
              studentId: student.userId,
              status: SessionStatus.COMPLETED
            }
          }),
          prisma.sessionBooking.count({
            where: {
              studentId: student.userId
            }
          })
        ]);

        let progress = 0;
        if (totalSessions > 0) {
          progress = Math.round((completedSessions / totalSessions) * 100);
        } else {
          const negativeCredits = student.creditTransactions.filter((tx) => tx.amount < 0);
          const positiveCredits = student.creditTransactions.filter((tx) => tx.amount > 0);

          const usedCredits = Math.abs(negativeCredits.reduce((sum, tx) => sum + tx.amount, 0));
          const totalCredits = positiveCredits.reduce((sum, tx) => sum + tx.amount, 0);

          if (totalCredits > 0) {
            progress = Math.round((usedCredits / totalCredits) * 100);
          }
        }

        progress = Math.max(0, Math.min(100, progress));

        const subjectProgress = await prisma.sessionBooking.groupBy({
          by: ['subject'],
          where: {
            studentId: student.userId
          },
          _count: { id: true }
        });

        const subjectProgressMap = new Map<Subject, number>();
        for (const subject of subjectProgress) {
          if (!subject.subject) {
            continue;
          }

          const subjectCompletedSessions = await prisma.sessionBooking.count({
            where: {
              studentId: student.userId,
              subject: subject.subject,
              status: SessionStatus.COMPLETED
            }
          });

          const subjectTotalSessions = subject._count.id;
          const subjectProgressPercent = subjectTotalSessions > 0 ? Math.round((subjectCompletedSessions / subjectTotalSessions) * 100) : 0;
          subjectProgressMap.set(subject.subject, subjectProgressPercent);
        }

        const subscriptionDetails = activeSubscription
          ? {
              planName: activeSubscription.planName,
              monthlyPrice: activeSubscription.monthlyPrice,
              status: activeSubscription.status,
              startDate: activeSubscription.startDate,
              endDate: activeSubscription.endDate
            }
          : null;

        return {
          id: student.userId,
          studentId: student.id,
          firstName: student.user.firstName,
          lastName: student.user.lastName,
          grade: student.grade,
          school: student.school,
          credits: creditBalance,
          subscription: activeSubscription?.planName ?? 'AUCUN',
          subscriptionDetails,
          nextSession: nextSessionBooking
            ? {
                id: nextSessionBooking.id,
                subject: nextSessionBooking.subject,
                scheduledAt: buildDateTime(nextSessionBooking.scheduledDate, nextSessionBooking.startTime),
                coachName: resolveCoachLabel(nextSessionBooking),
                type: nextSessionBooking.type,
                status: nextSessionBooking.status
              }
            : null,
          progress,
          subjectProgress: Object.fromEntries(subjectProgressMap),
          sessions: upcomingSessions.map((session) => ({
            id: session.id,
            subject: session.subject,
            scheduledAt: buildDateTime(session.scheduledDate, session.startTime),
            coachName: resolveCoachLabel(session),
            type: session.type,
            status: session.status,
            duration: session.duration
          }))
        };
      })
    );

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
