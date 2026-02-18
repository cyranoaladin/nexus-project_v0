/**
 * Next Step Engine — Intelligent "what to do next" recommendations per role.
 *
 * At each login / dashboard load, computes the most relevant next action
 * based on the user's role, account state, bilans, sessions, credits, and progression.
 *
 * Usage (Server Component or API route):
 *   import { getNextStep } from '@/lib/next-step-engine';
 *   const step = await getNextStep(userId);
 *   // → { type: 'BOOK_SESSION', message: '...', link: '/dashboard/parent/reserver', priority: 'high' }
 */

import { prisma } from '@/lib/prisma';
import { UserRole } from '@/types/enums';

/** Priority level for the recommended action */
export type StepPriority = 'critical' | 'high' | 'medium' | 'low';

/** A single recommended next step */
export interface NextStep {
  /** Machine-readable step type */
  type: string;
  /** Human-readable message (French) */
  message: string;
  /** Optional link to navigate to */
  link?: string;
  /** Priority level */
  priority: StepPriority;
  /** Optional icon hint for the UI (Lucide icon name) */
  icon?: string;
}

/**
 * Compute the most relevant next step for a user.
 *
 * @param userId - The authenticated user's ID
 * @returns The recommended next step, or null if no recommendation
 */
export async function getNextStep(userId: string): Promise<NextStep | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        firstName: true,
        activatedAt: true,
        parentProfile: {
          select: {
            id: true,
            children: {
              select: {
                id: true,
                credits: true,
                completedSessions: true,
                totalSessions: true,
                subscriptions: {
                  where: { status: 'ACTIVE' },
                  select: { id: true, planName: true },
                  take: 1,
                },
              },
            },
          },
        },
        student: {
          select: {
            id: true,
            credits: true,
            completedSessions: true,
            totalSessions: true,
            subscriptions: {
              where: { status: 'ACTIVE' },
              select: { id: true },
              take: 1,
            },
          },
        },
        coachProfile: {
          select: { id: true },
        },
      },
    });

    if (!user) return null;

    switch (user.role) {
      case UserRole.PARENT:
        return computeParentStep(user);
      case UserRole.ELEVE:
        return computeEleveStep(user);
      case UserRole.COACH:
        return computeCoachStep(user);
      case UserRole.ASSISTANTE:
        return computeAssistanteStep();
      case UserRole.ADMIN:
        return computeAdminStep();
      default:
        return null;
    }
  } catch (error) {
    console.error('[NextStepEngine] Error computing next step:', error);
    return null;
  }
}

// ─── PARENT ──────────────────────────────────────────────────────────────────

type ParentUser = {
  id: string;
  parentProfile: {
    id: string;
    children: {
      id: string;
      credits: number;
      completedSessions: number;
      totalSessions: number;
      subscriptions: { id: string; planName: string }[];
    }[];
  } | null;
};

async function computeParentStep(user: ParentUser): Promise<NextStep | null> {
  const children = user.parentProfile?.children ?? [];

  // Step 1: No children linked → critical
  if (children.length === 0) {
    return {
      type: 'ADD_CHILD',
      message: 'Ajoutez votre premier enfant pour commencer',
      link: '/dashboard/parent',
      priority: 'critical',
      icon: 'UserPlus',
    };
  }

  const firstChild = children[0];

  // Step 2: No active subscription → high
  if (firstChild.subscriptions.length === 0) {
    return {
      type: 'SUBSCRIBE',
      message: 'Choisissez un abonnement pour débloquer les séances',
      link: '/offres',
      priority: 'high',
      icon: 'CreditCard',
    };
  }

  // Step 3: No credits left → high
  if (firstChild.credits <= 0) {
    return {
      type: 'BUY_CREDITS',
      message: 'Vos crédits sont épuisés. Rechargez pour réserver une séance',
      link: '/dashboard/parent',
      priority: 'high',
      icon: 'Coins',
    };
  }

  // Step 4: No sessions completed yet → do first bilan
  if (firstChild.completedSessions === 0) {
    // Check if a bilan exists
    const _bilanCount = await prisma.diagnostic.count({
      where: {
        // Diagnostics are linked via student email or parent context
        // For now, check if any upcoming session exists
      },
    });

    // Check for upcoming sessions
    const upcomingSession = await prisma.sessionBooking.findFirst({
      where: {
        studentId: user.id,
        status: 'SCHEDULED',
        scheduledDate: { gte: new Date() },
      },
      orderBy: { scheduledDate: 'asc' },
    });

    if (!upcomingSession) {
      return {
        type: 'BOOK_SESSION',
        message: 'Réservez la première séance de coaching',
        link: '/dashboard/parent',
        priority: 'high',
        icon: 'CalendarPlus',
      };
    }

    return {
      type: 'UPCOMING_SESSION',
      message: `Prochaine séance le ${upcomingSession.scheduledDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`,
      link: '/dashboard/parent',
      priority: 'medium',
      icon: 'Calendar',
    };
  }

  // Step 5: Has credits + has sessions → book next
  const nextSession = await prisma.sessionBooking.findFirst({
    where: {
      studentId: user.id,
      status: 'SCHEDULED',
      scheduledDate: { gte: new Date() },
    },
    orderBy: { scheduledDate: 'asc' },
  });

  if (!nextSession) {
    return {
      type: 'BOOK_SESSION',
      message: 'Réservez votre prochaine séance',
      link: '/dashboard/parent',
      priority: 'medium',
      icon: 'CalendarPlus',
    };
  }

  return {
    type: 'VIEW_PROGRESS',
    message: 'Consultez la progression de votre enfant',
    link: '/dashboard/parent',
    priority: 'low',
    icon: 'TrendingUp',
  };
}

// ─── ELEVE ───────────────────────────────────────────────────────────────────

type EleveUser = {
  id: string;
  activatedAt: Date | null;
  student: {
    id: string;
    credits: number;
    completedSessions: number;
    totalSessions: number;
    subscriptions: { id: string }[];
  } | null;
};

async function computeEleveStep(user: EleveUser): Promise<NextStep | null> {
  // Step 1: Account not activated
  if (!user.activatedAt) {
    return {
      type: 'ACTIVATE_ACCOUNT',
      message: 'Votre compte est en attente d\'activation',
      priority: 'critical',
      icon: 'ShieldAlert',
    };
  }

  // Step 2: No student profile
  if (!user.student) {
    return {
      type: 'WAIT_PARENT',
      message: 'Votre parent doit finaliser votre inscription',
      priority: 'high',
      icon: 'Clock',
    };
  }

  // Step 3: Check upcoming session
  const nextSession = await prisma.sessionBooking.findFirst({
    where: {
      studentId: user.id,
      status: 'SCHEDULED',
      scheduledDate: { gte: new Date() },
    },
    orderBy: { scheduledDate: 'asc' },
    select: { scheduledDate: true, subject: true },
  });

  if (nextSession) {
    return {
      type: 'VIEW_SESSION',
      message: `Prochaine séance : ${nextSession.subject} le ${nextSession.scheduledDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`,
      link: '/dashboard/eleve',
      priority: 'medium',
      icon: 'Calendar',
    };
  }

  // Step 4: No upcoming session → explore resources
  return {
    type: 'EXPLORE_RESOURCES',
    message: 'Découvrez vos ressources pédagogiques',
    link: '/dashboard/eleve',
    priority: 'low',
    icon: 'BookOpen',
  };
}

// ─── COACH ───────────────────────────────────────────────────────────────────

type CoachUser = {
  id: string;
  coachProfile: { id: string } | null;
};

async function computeCoachStep(user: CoachUser): Promise<NextStep | null> {
  if (!user.coachProfile) {
    return {
      type: 'COMPLETE_PROFILE',
      message: 'Complétez votre profil coach',
      link: '/dashboard/coach',
      priority: 'critical',
      icon: 'UserCog',
    };
  }

  // Check for sessions needing a report
  const unreportedSessions = await prisma.sessionBooking.count({
    where: {
      coachId: user.id,
      status: 'COMPLETED',
      report: null,
    },
  });

  if (unreportedSessions > 0) {
    return {
      type: 'SUBMIT_REPORT',
      message: `${unreportedSessions} compte${unreportedSessions > 1 ? 's' : ''}-rendu${unreportedSessions > 1 ? 's' : ''} en attente`,
      link: '/dashboard/coach',
      priority: 'high',
      icon: 'FileText',
    };
  }

  // Check upcoming sessions today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todaySessions = await prisma.sessionBooking.count({
    where: {
      coachId: user.id,
      status: 'SCHEDULED',
      scheduledDate: { gte: today, lt: tomorrow },
    },
  });

  if (todaySessions > 0) {
    return {
      type: 'TODAY_SESSIONS',
      message: `${todaySessions} séance${todaySessions > 1 ? 's' : ''} aujourd'hui`,
      link: '/dashboard/coach',
      priority: 'medium',
      icon: 'CalendarCheck',
    };
  }

  // Check availability slots
  const availabilityCount = await prisma.coachAvailability.count({
    where: {
      coachId: user.id,
      isAvailable: true,
    },
  });

  if (availabilityCount === 0) {
    return {
      type: 'SET_AVAILABILITY',
      message: 'Définissez vos créneaux de disponibilité',
      link: '/dashboard/coach',
      priority: 'medium',
      icon: 'Clock',
    };
  }

  return {
    type: 'ALL_GOOD',
    message: 'Tout est à jour. Consultez votre planning',
    link: '/dashboard/coach',
    priority: 'low',
    icon: 'CheckCircle',
  };
}

// ─── ASSISTANTE ──────────────────────────────────────────────────────────────

async function computeAssistanteStep(): Promise<NextStep | null> {
  // Check pending subscription requests
  const pendingSubscriptions = await prisma.subscriptionRequest.count({
    where: { status: 'PENDING' },
  });

  if (pendingSubscriptions > 0) {
    return {
      type: 'PROCESS_SUBSCRIPTIONS',
      message: `${pendingSubscriptions} demande${pendingSubscriptions > 1 ? 's' : ''} d'abonnement en attente`,
      link: '/dashboard/assistante',
      priority: 'high',
      icon: 'Inbox',
    };
  }

  // Check pending payments
  const pendingPayments = await prisma.payment.count({
    where: { status: 'PENDING' },
  });

  if (pendingPayments > 0) {
    return {
      type: 'PROCESS_PAYMENTS',
      message: `${pendingPayments} paiement${pendingPayments > 1 ? 's' : ''} en attente de validation`,
      link: '/dashboard/assistante',
      priority: 'high',
      icon: 'CreditCard',
    };
  }

  // Check upcoming sessions today that may need attention
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const todaySessionCount = await prisma.sessionBooking.count({
    where: {
      status: 'SCHEDULED',
      scheduledDate: { gte: todayStart, lt: todayEnd },
    },
  });

  if (todaySessionCount > 0) {
    return {
      type: 'TODAY_SESSIONS',
      message: `${todaySessionCount} séance${todaySessionCount > 1 ? 's' : ''} programmée${todaySessionCount > 1 ? 's' : ''} aujourd'hui`,
      link: '/dashboard/assistante',
      priority: 'medium',
      icon: 'CalendarCheck',
    };
  }

  return {
    type: 'ALL_CLEAR',
    message: 'Aucune action urgente. Tout est à jour !',
    link: '/dashboard/assistante',
    priority: 'low',
    icon: 'CheckCircle',
  };
}

// ─── ADMIN ───────────────────────────────────────────────────────────────────

async function computeAdminStep(): Promise<NextStep | null> {
  // Check total users this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const newUsersThisMonth = await prisma.user.count({
    where: { createdAt: { gte: startOfMonth } },
  });

  // Check failed payments
  const failedPayments = await prisma.payment.count({
    where: {
      status: 'FAILED',
      createdAt: { gte: startOfMonth },
    },
  });

  if (failedPayments > 0) {
    return {
      type: 'REVIEW_FAILED_PAYMENTS',
      message: `${failedPayments} paiement${failedPayments > 1 ? 's' : ''} échoué${failedPayments > 1 ? 's' : ''} ce mois`,
      link: '/dashboard/admin',
      priority: 'high',
      icon: 'AlertTriangle',
    };
  }

  return {
    type: 'VIEW_METRICS',
    message: `${newUsersThisMonth} nouveau${newUsersThisMonth > 1 ? 'x' : ''} utilisateur${newUsersThisMonth > 1 ? 's' : ''} ce mois`,
    link: '/dashboard/admin',
    priority: 'low',
    icon: 'BarChart3',
  };
}
