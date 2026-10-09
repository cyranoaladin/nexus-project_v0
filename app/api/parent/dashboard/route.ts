export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { authorizeParentStudentRecords, familyReadAllowed } from '@/lib/families/student-access-authority';
import type { Prisma } from '@prisma/client';
import { combineDateAndTime } from '@/lib/planning/invariants';
import { tunisTodayUtcMidnight } from '@/lib/planning/series';
import { courseLabel } from '@/lib/curriculum/catalog';

type StudentBadge = Prisma.StudentBadgeGetPayload<{
  include: {
    badge: true;
  };
}>;

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    if (session.user.role !== 'PARENT') {
      return NextResponse.json({ error: 'Accès réservé aux parents' }, { status: 403 });
    }

    // Decide current family authority from stored identity facts before any
    // child names, activation metadata, subscriptions, progression or planning.
    const identity = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, children: { select: {
        id: true, userId: true, parent: { select: { userId: true } },
      } } },
    });
    if (!identity) return NextResponse.json({ error: 'Profil parent introuvable' }, { status: 404 });
    const decisions = await authorizeParentStudentRecords(session.user.id, identity.children, 'read');
    if (decisions.some(decision => decision.status === 'AUTHORITY_UNAVAILABLE')) {
      return NextResponse.json({ error: 'Family authority unavailable' },
        { status: 503, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie, Authorization' } });
    }
    const allowed = new Set(decisions.filter(familyReadAllowed).map(decision => decision.id));
    const studentIds = identity.children.filter(student => allowed.has(student.id)).map(student => student.id);

    const parentProfile = studentIds.length === 0 ? { children: [] } : await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        children: {
          where: { id: { in: studentIds } },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                activatedAt: true,
                activationExpiry: true,
              },
            },
            subscriptions: {
              where: { status: 'ACTIVE' },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                id: true,
                planName: true,
                status: true,
                startDate: true,
                endDate: true,
                ariaSubjects: true
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
    const consentLinks = studentIds.length === 0 ? [] : await prisma.parentStudentLink.findMany({
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

      // Séances futures canoniques de CET enfant, filtrées directement par
      // `studentProfileId` (Student.id) — jamais par l'ancien `User.id` ni
      // par une relation traversant `User.studentSessions`. Bornée aux
      // occurrences actives (`SCHEDULED`) à partir d'aujourd'hui (Africa/
      // Tunis, même convention que `app/api/assistante/planning/series/
      // [seriesId]/route.ts`), triée chronologiquement croissant.
      const bookings = await prisma.sessionBooking.findMany({
        where: {
          studentProfileId: child.id,
          status: 'SCHEDULED',
          scheduledDate: { gte: tunisTodayUtcMidnight() },
        },
        orderBy: [{ scheduledDate: 'asc' }, { startTime: 'asc' }],
        take: 5,
        select: {
          id: true,
          subject: true,
          academicCourseKey: true,
          scheduledDate: true,
          startTime: true,
          endTime: true,
          status: true,
          modality: true,
          location: true,
          type: true,
          duration: true,
          planningSeriesId: true,
          coach: {
            select: {
              firstName: true,
              lastName: true,
              coachProfile: { select: { pseudonym: true } },
            },
          },
        },
      });

      // Time/course/coach/modality/location/status/series — projection
      // complète requise par la Tâche 13 pour l'affichage parent par enfant.
      const mappedSessions = bookings.map((s) => ({
        id: s.id,
        subject: s.subject,
        academicCourseKey: s.academicCourseKey,
        courseLabel: s.academicCourseKey ? courseLabel(s.academicCourseKey) : null,
        scheduledAt: combineDateAndTime(s.scheduledDate, s.startTime).toISOString(),
        endAt: combineDateAndTime(s.scheduledDate, s.endTime).toISOString(),
        coachName: s.coach?.coachProfile?.pseudonym ?? (`${s.coach?.firstName ?? ''} ${s.coach?.lastName ?? ''}`.trim() || 'Coach'),
        type: s.type === 'INDIVIDUAL' ? 'COURS_ONLINE' : 'COURS_COLLECTIF',
        modality: s.modality,
        location: s.location,
        status: s.status,
        duration: s.duration ?? 60,
        planningSeriesId: s.planningSeriesId,
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
    }, { headers: { 'Cache-Control': 'private, no-store' } });

  } catch {
    console.error('PARENT_DASHBOARD_READ_FAILED');
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
