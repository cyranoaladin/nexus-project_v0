export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { AcademicTrack, MathsLevel, Subject } from '@prisma/client';

type TrackProgress = {
  totalXp: number;
  completedChapters: string[];
};

type StudentDashboardSession = {
  user?: {
    id?: string;
    role?: string;
  };
} | null;

const EDS_SKILL_GRAPH_BY_SUBJECT: Partial<Record<Subject, string>> = {
  [Subject.MATHEMATIQUES]: 'maths_premiere',
  [Subject.NSI]: 'nsi_premiere',
  [Subject.PHYSIQUE_CHIMIE]: 'physique_chimie_premiere',
  [Subject.SVT]: 'svt_premiere',
  [Subject.FRANCAIS]: 'francais_premiere',
  [Subject.PHILOSOPHIE]: 'philosophie_premiere',
  [Subject.HISTOIRE_GEO]: 'histoire_geo_premiere',
  [Subject.ANGLAIS]: 'anglais_premiere',
  [Subject.ESPAGNOL]: 'espagnol_premiere',
  [Subject.SES]: 'ses_premiere',
};

const STMG_MODULES = [
  { module: 'MATHS_STMG', label: 'Mathématiques STMG', subject: Subject.MATHEMATIQUES, skillGraphRef: 'maths_premiere_stmg' },
  { module: 'SGN', label: 'Sciences de gestion et numérique', subject: Subject.SES, skillGraphRef: 'sgn_premiere_stmg' },
  { module: 'MANAGEMENT', label: 'Management', subject: Subject.SES, skillGraphRef: 'management_premiere_stmg' },
  { module: 'DROIT_ECO', label: 'Droit-Économie', subject: Subject.SES, skillGraphRef: 'droit_eco_premiere_stmg' },
] as const;

function normalizeProgress(progress?: TrackProgress | null) {
  return {
    totalXp: progress?.totalXp ?? 0,
    completedChapters: progress?.completedChapters ?? [],
  };
}

export async function GET(request: NextRequest) {
  try {
    // Get the current session (wrapped: auth() can throw UntrustedHost in standalone)
    let session: StudentDashboardSession = null;
    try {
      session = await auth() as StudentDashboardSession;
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

    // Fetch student data
    const student = await prisma.student.findUnique({
      where: { userId: studentId },
      include: {
        user: {
          include: {
            mathsProgress: {
              where: { level: MathsLevel.PREMIERE },
            },
          },
        },
        subscriptions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        sessions: {
          where: {
            status: { in: ['SCHEDULED', 'COMPLETED', 'CONFIRMED'] }
          },
          include: {
            coach: {
              include: {
                user: true
              }
            }
          },
          orderBy: { scheduledAt: 'desc' }
        },
        ariaConversations: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            messages: true
          }
        },
        creditTransactions: {
          where: {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
          }
        },
        badges: {
          include: {
            badge: true
          },
          orderBy: { earnedAt: 'desc' },
          take: 5
        },
        bilans: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      }
    });

    if (!student) {
      console.error('[Student Dashboard API] Student not found');
      return NextResponse.json(
        { error: 'Student not found' },
        { status: 404 }
      );
    }


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

    // Compute credit balance from non-expired transactions
    const creditBalance = (student.creditTransactions ?? []).reduce(
      (sum, tx) => sum + (tx.amount ?? 0),
      0
    );

    const academicTrack = student.academicTrack ?? AcademicTrack.EDS_GENERALE;
    const gradeLevel = student.gradeLevel ?? 'PREMIERE';
    const isStmgTrack =
      academicTrack === AcademicTrack.STMG ||
      academicTrack === AcademicTrack.STMG_NON_LYCEEN;
    const mathsProgress = student.user.mathsProgress ?? [];
    const progressForTrack = (track: AcademicTrack) => mathsProgress.find((progress) => progress.track === track);
    const edsProgress = normalizeProgress(progressForTrack(AcademicTrack.EDS_GENERALE));
    const stmgProgress = normalizeProgress(progressForTrack(AcademicTrack.STMG));

    const trackContent = isStmgTrack
      ? {
          stmgModules: STMG_MODULES.map((module) => ({
            ...module,
            progress: module.module === 'MATHS_STMG' ? stmgProgress : normalizeProgress(null),
          })),
        }
      : {
          specialties: (student.specialties ?? []).map((subject) => ({
            subject,
            skillGraphRef: EDS_SKILL_GRAPH_BY_SUBJECT[subject] ?? `${String(subject).toLowerCase()}_premiere`,
            progress: subject === Subject.MATHEMATIQUES ? edsProgress : normalizeProgress(null),
          })),
        };

    // Format dashboard data
    const dashboardData = {
      student: {
        id: student.id,
        firstName: student.user.firstName,
        lastName: student.user.lastName,
        email: student.user.email,
        grade: student.grade,
        gradeLevel,
        academicTrack,
        specialties: student.specialties ?? [],
        stmgPathway: student.stmgPathway ?? null,
        school: student.school
      },
      cockpit: {
        seanceDuJour: nextSession ?? null,
        feuilleDeRoute: [],
        prochaineSession: nextSession ?? null,
        alertes: [],
      },
      nexusIndex: { value: null, trend: null, history: [] },
      trackContent,
      ariaQuota: null,
      sessionsCount: student.sessions.length,
      lastBilan: student.bilans?.[0] ?? null,
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
      credits: {
        balance: creditBalance,
      },
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

    return NextResponse.json(dashboardData);

  } catch (error) {
    console.error('Error fetching student dashboard data:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
