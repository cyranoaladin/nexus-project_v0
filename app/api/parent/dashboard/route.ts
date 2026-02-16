export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import type { Prisma } from '@prisma/client';

type StudentBadge = Prisma.StudentBadgeGetPayload<{
  include: {
    badge: true;
  };
}>;

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (session.user.role !== 'PARENT') {
      return NextResponse.json({ error: 'Accès réservé aux parents' }, { status: 403 });
    }

    // Fetch Parent Profile and Children with UPCOMING sessions
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        children: {
          include: {
            user: {
              include: {
                studentSessions: {
                  where: {
                    status: 'SCHEDULED'
                  },
                  orderBy: { scheduledDate: 'asc' },
                  take: 5,
                  select: {
                    id: true,
                    subject: true,
                    scheduledDate: true,
                    startTime: true,
                    endTime: true,
                    status: true,
                    modality: true,
                    type: true,
                    duration: true,
                    coachId: true,
                    coach: {
                      select: {
                        firstName: true,
                        lastName: true,
                        coachProfile: { select: { pseudonym: true } }
                      }
                    }
                  }
                }
              }
            },
            subscriptions: {
              where: { status: 'ACTIVE' },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                planName: true,
                monthlyPrice: true,
                creditsPerMonth: true,
                status: true,
                startDate: true,
                endDate: true,
                ariaSubjects: true,
                ariaCost: true
              }
            },
            badges: {
              include: {
                badge: true
              }
            }
          }
        }
      }
    });

    if (!parentProfile) {
      return NextResponse.json({ error: 'Profil parent introuvable' }, { status: 404 });
    }

    // Fetch Payments
    const payments = await prisma.payment.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    // Transform data for frontend
    const childrenData = await Promise.all(parentProfile.children.map(async (child) => {
      // Fetch coach names for sessions if needed, or use placeholder
      // For simplicity/performance in this fix, we map sessions directly

      const mappedSessions = child.user.studentSessions.map((s) => ({
        id: s.id,
        subject: s.subject,
        scheduledAt: s.scheduledDate.toISOString(),
        coachName: s.coach?.coachProfile?.pseudonym ?? (`${s.coach?.firstName ?? ''} ${s.coach?.lastName ?? ''}`.trim() || 'Coach'),
        type: s.type === 'INDIVIDUAL' ? 'COURS_ONLINE' : 'COURS_COLLECTIF',
        status: s.status,
        duration: s.duration ?? 60
      }));

      const nextSession = mappedSessions.length > 0 ? mappedSessions[0] : null;
      const subscription = child.subscriptions?.[0];

      return {
        id: child.id,
        userId: child.user.id,
        firstName: child.user.firstName || '',
        lastName: child.user.lastName || '',
        // name: ... (Frontend uses firstName/lastName in interface usually?)
        // Page.tsx uses: firstName, lastName.
        // Interface says: firstName, lastName in parent object.
        // Children objects in Page.tsx interface: id, firstName, lastName, ...
        // So we must match that.

        grade: child.grade,
        school: child.school,
        credits: child.credits,

        // Subscription details from DB
        subscription: subscription?.planName ?? 'Aucun',
        subscriptionDetails: subscription ? {
          id: subscription.id,
          planName: subscription.planName,
          monthlyPrice: subscription.monthlyPrice,
          creditsPerMonth: subscription.creditsPerMonth,
          status: subscription.status,
          startDate: subscription.startDate?.toISOString(),
          endDate: subscription.endDate?.toISOString() ?? null,
          ariaSubjects: subscription.ariaSubjects,
          ariaCost: subscription.ariaCost
        } : null,

        nextSession: nextSession,

        // Progress from real session stats
        progress: child.totalSessions > 0
          ? Math.round((child.completedSessions / child.totalSessions) * 100)
          : 0,
        subjectProgress: {},

        sessions: mappedSessions,

        // Fix badges mapping
        badges: child.badges.map((sb: StudentBadge) => ({
          id: sb.badge.id,
          name: sb.badge.name,
          icon: sb.badge.icon,
          category: sb.badge.category,
          earnedAt: sb.earnedAt.toISOString()
        }))
      };
    }));

    return NextResponse.json({
      // Parent info
      parent: {
        id: session.user.id,
        firstName: session.user.firstName || '',
        lastName: session.user.lastName || '',
        email: session.user.email || ''
      },
      children: childrenData,
      payments: payments.map(p => ({
        id: p.id,
        date: p.createdAt.toISOString(),
        amount: p.amount,
        description: p.description,
        status: p.status,
        type: p.type
      }))
    });

  } catch (error) {
    console.error('[Parent Dashboard API] Error fetching parent dashboard data:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
