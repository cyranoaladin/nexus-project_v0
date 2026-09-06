import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import type { Prisma } from '@prisma/client';

type StudentBadge = Prisma.StudentBadgeGetPayload<{
  include: {
    badge: true;
  };
}>;

export async function GET() {
  try {
    const session = await auth();

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

    // État du lien parent-élève canonique par enfant : c'est lui qui
    // conditionne la visibilité des bilans (VERIFIED requis). Exposé au
    // dashboard pour que l'attente de consentement soit explicite et
    // actionnable — jamais un enfant visible avec des bilans muets.
    const consentLinks = await prisma.parentStudentLink.findMany({
      where: {
        parentUserId: session.user.id,
        studentId: { in: parentProfile.children.map((child) => child.id) },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: { studentId: true, state: true },
    });
    const consentStateByStudent = new Map<string, string>();
    for (const link of consentLinks) {
      if (!consentStateByStudent.has(link.studentId)) {
        consentStateByStudent.set(link.studentId, link.state);
      }
    }

    // Transform data for frontend
    const childrenData = await Promise.all(parentProfile.children.map(async (child) => {
      // Fetch ProgressionHistory for the chart (tolerant if model missing)
      let history: Array<{ date: Date; ssn: number }> = [];
      try {
        history = (await prisma.progressionHistory.findMany?.({
          where: { studentId: child.id },
          orderBy: { date: 'asc' },
          take: 10
        })) ?? [];
      } catch {
        history = [];
      }

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
        email: child.user.email || '',
        activationStatus: child.user.activatedAt === null ? 'PENDING_ACTIVATION' : 'ACTIVE',
        activationExpiresAt: child.user.activationExpiry?.toISOString() ?? null,
        consentState: consentStateByStudent.get(child.id) ?? 'MISSING',

        grade: child.grade,
        gradeLevel: child.gradeLevel,
        academicTrack: child.academicTrack,

        subscription: subscription?.planName ?? 'Aucun',
        subscriptionDetails: subscription ? {
          id: subscription.id,
          planName: subscription.planName,
          monthlyPrice: subscription.monthlyPrice,
          status: subscription.status,
          startDate: subscription.startDate?.toISOString(),
          endDate: subscription.endDate?.toISOString() ?? null,
        } : null,

        nextSession: nextSession,
        nexusIndex: null,
        alerts: [],
        
        progressionHistory: history.map(h => ({
          date: h.date.toISOString(),
          ssn: h.ssn
        })),

        progress: child.totalSessions > 0
          ? Math.round((child.completedSessions / child.totalSessions) * 100)
          : 0,
        subjectProgress: {},
        sessions: mappedSessions,
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
    console.error('[Parent Dashboard API] Error fetching parent dashboard data:', serializeError(error));
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
