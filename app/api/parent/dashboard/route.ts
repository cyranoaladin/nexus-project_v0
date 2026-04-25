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
      // Fetch MathsProgress to calculate NexusIndex
      const mathsProgress = await prisma.mathsProgress.findFirst({
        where: { userId: child.userId },
        orderBy: { updatedAt: 'desc' }
      });

      // Fetch ProgressionHistory for the chart
      const history = await prisma.progressionHistory.findMany({
        where: { studentId: child.id },
        orderBy: { date: 'asc' },
        take: 10
      });

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

      // Basic NexusIndex calculation (XP / 100 capped at 100)
      const nexusIndex = mathsProgress ? Math.min(100, Math.round(mathsProgress.totalXp / 50)) : null;

      // Mock alerts if no activity for 7 days
      const alerts: string[] = [];
      const lastActivity = mathsProgress?.updatedAt || child.updatedAt;
      const daysSinceLastActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastActivity > 7) {
        alerts.push(`Aucune activité détectée pour ${child.user.firstName} depuis 7 jours.`);
      }

      return {
        id: child.id,
        userId: child.user.id,
        firstName: child.user.firstName || '',
        lastName: child.user.lastName || '',
        email: child.user.email || '',

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
        nexusIndex,
        alerts,
        
        progressionHistory: history.map(h => ({
          date: h.date.toISOString(),
          nexusIndex: Math.round(h.ssn),
          ssn: Math.round(h.ssn * 0.9), // Mocked sub-metrics
          uai: Math.round(h.ssn * 0.85)
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
    console.error('[Parent Dashboard API] Error fetching parent dashboard data:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
