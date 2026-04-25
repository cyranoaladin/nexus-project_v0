/**
 * Student Dashboard Payload Builder
 *
 * Single source of truth: assembles the complete EleveDashboardData payload
 * from 8–9 Prisma queries (all in parallel after the first load).
 *
 * Filtering rules:
 * - Bilans: WHERE studentMarkdown IS NOT NULL (implicit audience=nexus exclusion)
 * - Automatismes: null for STMG track (EDS only)
 * - Survival: null unless STMG + PREMIERE
 */

import { prisma } from '@/lib/prisma';
import { AcademicTrack, GradeLevel, MathsLevel } from '@prisma/client';
import { getActiveTrajectory, parseMilestones } from '@/lib/trajectory';
import { getNextStep } from '@/lib/next-step-engine';
import { getUserEntitlements } from '@/lib/entitlement/engine';
import type {
  EleveDashboardData,
  EleveBilan,
  EleveBilanSubject,
  EleveResource,
  EleveStageItem,
  EleveTrajectoryMilestone,
  EleveTrajectoryMilestoneStatus,
  EleveFeuilleDeRouteItem,
  EleveAlert,
  EleveAutomatismesProgress,
} from '@/components/dashboard/eleve/types';

// ─── Subject normaliser ───────────────────────────────────────────────────────

const SUBJECT_TO_BILAN_SUBJECT: Record<string, EleveBilanSubject> = {
  MATHEMATIQUES: 'MATHEMATIQUES',
  MATHS_STMG: 'MATHS_STMG',
  NSI: 'NSI',
  DROIT_ECO: 'DROIT_ECO',
  MANAGEMENT: 'MANAGEMENT',
  SGN: 'SGN',
};

const SUBJECT_LABELS: Record<EleveBilanSubject, string> = {
  MATHEMATIQUES: 'Mathématiques',
  MATHS_STMG: 'Mathématiques STMG',
  NSI: 'NSI',
  DROIT_ECO: 'Droit-Économie',
  MANAGEMENT: 'Management',
  SGN: 'Sciences de gestion et numérique',
  MIXTE: 'Multi-matières',
};

function normaliseBilanSubject(rawSubject: string): EleveBilanSubject {
  const normalised = SUBJECT_TO_BILAN_SUBJECT[rawSubject.toUpperCase()];
  if (!normalised) {
    console.warn(`[dashboard] unknown bilan subject: "${rawSubject}", falling back to MIXTE`);
    return 'MIXTE';
  }
  return normalised;
}

// ─── Builders ────────────────────────────────────────────────────────────────

/**
 * Map a Bilan DB row to the EleveBilan shape.
 * Only call for bilans WHERE studentMarkdown IS NOT NULL (guaranteed by query).
 */
function toBilan(bilan: {
  id: string;
  publicShareId: string;
  type: string;
  subject: string;
  status: string;
  globalScore: number | null;
  ssn: number | null;
  confidenceIndex: number | null;
  analysisJson: unknown;
  parentsMarkdown: string | null;
  createdAt: Date;
}): EleveBilan {
  const analysis = bilan.analysisJson as {
    trustLevel?: string;
    topPriorities?: unknown[];
    forces?: unknown[];
    faiblesses?: unknown[];
  } | null;

  const trustLevel = (['high', 'medium', 'low'] as const).find(
    (v) => v === analysis?.trustLevel
  ) ?? null;

  const topPriorities = Array.isArray(analysis?.topPriorities)
    ? analysis.topPriorities.slice(0, 3).map(String)
    : [];

  const subject = normaliseBilanSubject(bilan.subject);

  return {
    id: bilan.id,
    publicShareId: bilan.publicShareId,
    type: bilan.type as EleveBilan['type'],
    subject,
    subjectLabel: SUBJECT_LABELS[subject],
    status: bilan.status as EleveBilan['status'],
    globalScore: bilan.globalScore,
    ssn: bilan.ssn,
    confidenceIndex: bilan.confidenceIndex,
    trustLevel,
    topPriorities,
    hasParentsRender: bilan.parentsMarkdown !== null,
    createdAt: bilan.createdAt.toISOString(),
    resultUrl: `/bilan-pallier2-maths/resultat/${bilan.publicShareId}`,
  };
}

/**
 * Map a UserDocument to EleveResource.
 * Only USER_DOCUMENT resources are returned (coach resources TBD).
 */
function toResource(doc: {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}): EleveResource {
  return {
    id: doc.id,
    type: 'USER_DOCUMENT',
    title: doc.title,
    uploadedAt: doc.createdAt.toISOString(),
    downloadUrl: `/api/student/documents/${doc.id}/download`,
    sizeBytes: doc.sizeBytes,
    mimeType: doc.mimeType,
  };
}

/**
 * Map a StageReservation + Stage to EleveStageItem.
 */
function toStageItem(
  reservation: {
    id: string;
    richStatus: string | null;
    status: string;
    stage: {
      id: string;
      slug: string;
      title: string;
      startDate: Date;
      endDate: Date;
      location: string | null;
    } | null;
  },
  bilanPublicShareId: string | null
): EleveStageItem | null {
  if (!reservation.stage) return null;

  const rawStatus = reservation.richStatus ?? reservation.status;
  const STATUS_MAP: Record<string, EleveStageItem['reservationStatus']> = {
    PENDING: 'PENDING',
    CONFIRMED: 'CONFIRMED',
    WAITLISTED: 'WAITLISTED',
    CANCELLED: 'CANCELLED',
    COMPLETED: 'COMPLETED',
    PENDING_BANK_TRANSFER: 'PENDING',
    PAID: 'CONFIRMED',
  };
  const reservationStatus = STATUS_MAP[rawStatus] ?? 'PENDING';

  return {
    stageId: reservation.stage.id,
    stageSlug: reservation.stage.slug,
    title: reservation.stage.title,
    startDate: reservation.stage.startDate.toISOString(),
    endDate: reservation.stage.endDate.toISOString(),
    location: reservation.stage.location,
    reservationId: reservation.id,
    reservationStatus,
    hasBilan: bilanPublicShareId !== null,
    bilanUrl: bilanPublicShareId
      ? `/bilan-pallier2-maths/resultat/${bilanPublicShareId}`
      : null,
  };
}

/**
 * Map a Trajectory + Milestone[] to EleveTrajectoryMilestone.
 */
function toTrajectoryMilestone(m: {
  id: string;
  title: string;
  targetDate: string;
  completed: boolean;
  completedAt: string | null;
}): EleveTrajectoryMilestone {
  const now = new Date();
  const target = new Date(m.targetDate);
  let status: EleveTrajectoryMilestoneStatus;
  if (m.completed) {
    status = 'COMPLETED';
  } else if (target <= now) {
    status = 'IN_PROGRESS'; // overdue milestone still active
  } else {
    status = 'UPCOMING';
  }
  return {
    id: m.id,
    title: m.title,
    description: null, // not stored in JSON milestone schema
    targetDate: m.targetDate,
    status,
    category: 'CUSTOM',
    completed: m.completed,
    completedAt: m.completedAt,
  };
}

/**
 * Derive automatismes stats from MathsProgress.
 * No dedicated AutomatismeAttempt model exists — we use the MathsProgress JSON fields.
 */
function toAutomatismesProgress(mathsProgress: {
  quizScore: number;
  bestCombo: number;
  streak: number;
  lastActivityDate: string | null;
  exerciseResults: unknown;
}): EleveAutomatismesProgress {
  // exerciseResults shape: Record<chapterId, { attempts: number; correct: number }> or similar
  const results = mathsProgress.exerciseResults as Record<
    string,
    { attempts?: number; correct?: number }
  > | null;

  let totalAttempted = 0;
  let totalCorrect = 0;

  if (results && typeof results === 'object') {
    for (const chapter of Object.values(results)) {
      if (chapter && typeof chapter === 'object') {
        totalAttempted += chapter.attempts ?? 0;
        totalCorrect += chapter.correct ?? 0;
      }
    }
  }

  // Fallback to quizScore if exerciseResults is empty/unstructured
  if (totalAttempted === 0 && mathsProgress.quizScore > 0) {
    totalAttempted = mathsProgress.quizScore;
    totalCorrect = mathsProgress.quizScore; // conservative fallback
  }

  const accuracy = totalAttempted > 0 ? totalCorrect / totalAttempted : 0;

  return {
    totalAttempted,
    totalCorrect,
    accuracy: Math.round(accuracy * 100) / 100,
    bestStreak: mathsProgress.bestCombo,
    lastAttemptAt: mathsProgress.lastActivityDate ?? null,
  };
}

// ─── Feeuille de route builder ────────────────────────────────────────────────

function buildFeuilleDeRoute(
  student: {
    id: string;
    academicTrack: AcademicTrack;
    gradeLevel: GradeLevel;
    survivalMode: boolean;
  },
  nextStepResult: Awaited<ReturnType<typeof getNextStep>>,
  recentBilans: EleveBilan[],
  upcomingStages: EleveStageItem[],
  nextSession: EleveDashboardData['nextSession'],
  mathsProgress: { completedChapters: string[]; lastActivityDate: string | null } | null
): EleveFeuilleDeRouteItem[] {
  const items: EleveFeuilleDeRouteItem[] = [];

  // 1. Next step from engine (highest priority) — result pre-fetched in Promise.all
  if (nextStepResult) {
    items.push({
      id: 'next-step-engine',
      type: 'EXERCISE',
      title: nextStepResult.message,
      estimatedMinutes: 15,
      priority: 1,
      href: nextStepResult.link ?? '/dashboard/eleve',
      done: false,
    });
  }

  // 2. Unread analyzed bilan (all items already have studentMarkdown by query filter)
  const unreadBilan = recentBilans.find(
    (b) => b.status === 'COMPLETED'
  );
  if (unreadBilan && items.length < 5) {
    items.push({
      id: `bilan-${unreadBilan.id}`,
      type: 'BILAN',
      title: `Voir mon bilan diagnostique — ${unreadBilan.subjectLabel}`,
      estimatedMinutes: 10,
      priority: 2,
      href: unreadBilan.resultUrl,
      done: false,
    });
  }

  // 3. No session in next 7 days → book one
  const hasUpcomingSession = nextSession &&
    new Date(nextSession.scheduledAt) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (!hasUpcomingSession && items.length < 5) {
    items.push({
      id: 'book-session',
      type: 'SESSION_BOOK',
      title: 'Réserver une séance de coaching',
      estimatedMinutes: 5,
      priority: 3,
      href: '/dashboard/eleve?tab=booking',
      done: false,
    });
  }

  // 4. Survival ritual pending (STMG only)
  if (student.academicTrack === AcademicTrack.STMG && student.survivalMode && items.length < 5) {
    items.push({
      id: 'survival-ritual',
      type: 'RITUAL',
      title: 'Compléter le rituel quotidien Mode Survie',
      estimatedMinutes: 20,
      priority: 4,
      href: '/dashboard/eleve#survival',
      done: false,
    });
  }

  // 5. Chapter with <30% progress and stale activity (EDS only)
  if (
    student.academicTrack !== AcademicTrack.STMG &&
    student.academicTrack !== AcademicTrack.STMG_NON_LYCEEN &&
    mathsProgress &&
    items.length < 5
  ) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const stale =
      !mathsProgress.lastActivityDate ||
      mathsProgress.lastActivityDate < sevenDaysAgo;
    if (stale) {
      items.push({
        id: 'resume-maths',
        type: 'CHAPTER',
        title: 'Reprendre votre progression en Mathématiques',
        estimatedMinutes: 30,
        priority: 5,
        href: '/dashboard/eleve/programme/maths',
        done: false,
      });
    }
  }

  return items.slice(0, 5);
}

// ─── Alerts builder ───────────────────────────────────────────────────────────

function buildAlertes(
  student: { gradeLevel: GradeLevel; survivalMode: boolean; credits: number },
  nextSession: EleveDashboardData['nextSession'],
  creditsBalance: number
): EleveAlert[] {
  const alerts: EleveAlert[] = [];

  // Critical: low credits
  if (creditsBalance <= 0) {
    alerts.push({
      id: 'no-credits',
      severity: 'critical',
      title: 'Aucun crédit disponible',
      body: 'Vous ne pouvez pas réserver de séance sans crédits. Contactez votre famille.',
      actionLabel: 'Voir les offres',
      actionHref: '/offres',
    });
  } else if (creditsBalance === 1) {
    alerts.push({
      id: 'low-credits',
      severity: 'warning',
      title: 'Dernier crédit',
      body: 'Il ne vous reste plus qu\'un crédit. Pensez à en recharger.',
    });
  }

  // Warning: no upcoming session
  if (!nextSession) {
    alerts.push({
      id: 'no-session',
      severity: 'warning',
      title: 'Aucune séance programmée',
      body: 'Réservez une séance avec votre coach pour continuer votre progression.',
      actionLabel: 'Réserver',
      actionHref: '/dashboard/eleve?tab=booking',
    });
  }

  return alerts.slice(0, 3);
}

// ─── Credit helpers ───────────────────────────────────────────────────────────

function computeCredits(transactions: Array<{
  amount: number;
  expiresAt: Date | null;
}>): { balance: number; nonExpiredCount: number; nextExpiryAt: string | null } {
  const now = new Date();
  const nonExpired = transactions.filter(
    (tx) => tx.expiresAt === null || tx.expiresAt > now
  );
  const balance = nonExpired.reduce((sum, tx) => sum + (tx.amount ?? 0), 0);
  const nextExpiry = nonExpired
    .map((tx) => tx.expiresAt)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  return {
    balance,
    nonExpiredCount: nonExpired.length,
    nextExpiryAt: nextExpiry ? nextExpiry.toISOString() : null,
  };
}

// ─── Main payload builder ─────────────────────────────────────────────────────

export async function buildStudentDashboardPayload(userId: string): Promise<EleveDashboardData> {
  // ── Q1: Student + all inlined relations ──────────────────────────────────
  const student = await prisma.student.findUnique({
    where: { userId },
    include: {
      user: {
        include: {
          mathsProgress: true,
        },
      },
      sessions: {
        where: {
          status: { in: ['SCHEDULED', 'CONFIRMED', 'COMPLETED'] },
        },
        include: {
          coach: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
        orderBy: { scheduledAt: 'desc' },
        take: 20,
      },
      ariaConversations: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          messages: {
            select: { createdAt: true },
            where: {
              createdAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              },
            },
          },
        },
      },
      creditTransactions: {
        where: {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { amount: true, expiresAt: true },
      },
      badges: {
        include: { badge: true },
        orderBy: { earnedAt: 'desc' },
        take: 10,
      },
      survivalProgress: true,
    },
  });

  if (!student) {
    throw new Error(`Student not found for userId=${userId}`);
  }

  const academicTrack = student.academicTrack ?? AcademicTrack.EDS_GENERALE;
  const gradeLevel = student.gradeLevel ?? GradeLevel.PREMIERE;
  const isStmg =
    academicTrack === AcademicTrack.STMG ||
    academicTrack === AcademicTrack.STMG_NON_LYCEEN;

  // ── Q2–Q8: Parallel independent queries ──────────────────────────────────
  const [
    mathsProgressForTrack,
    recentBilansRaw,
    allStageReservations,
    userDocs,
    userEntitlements,
    trajectoryData,
    nextStepResult,
  ] = await Promise.all([
    // Q2: MathsProgress for this student's track
    prisma.mathsProgress.findFirst({
      where: {
        userId,
        level: gradeLevel === GradeLevel.PREMIERE ? MathsLevel.PREMIERE : MathsLevel.TERMINALE,
        track: academicTrack,
      },
    }),

    // Q3: Recent bilans — studentMarkdown IS NOT NULL excludes nexus-only renders
    prisma.bilan.findMany({
      where: {
        studentId: student.id,
        studentMarkdown: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        id: true,
        publicShareId: true,
        type: true,
        subject: true,
        status: true,
        globalScore: true,
        ssn: true,
        confidenceIndex: true,
        analysisJson: true,
        parentsMarkdown: true,
        createdAt: true,
      },
    }),

    // Q4: All stage reservations for this student
    prisma.stageReservation.findMany({
      where: {
        OR: [
          { studentId: student.id },
          { email: student.user.email },
        ],
      },
      include: {
        stage: {
          select: {
            id: true,
            slug: true,
            title: true,
            startDate: true,
            endDate: true,
            location: true,
          },
        },
      },
      orderBy: [{ stage: { startDate: 'asc' } }],
    }),

    // Q5: User documents
    prisma.userDocument.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        title: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    }),

    // Q6: Entitlements (ARIA features)
    getUserEntitlements(userId),

    // Q7: Active trajectory
    getActiveTrajectory(student.id),

    // Q8: Next step engine
    getNextStep(userId).catch(() => null),
  ]);

  // Q9: Stage bilans lookup (only if reservations exist)
  const stageIds = allStageReservations
    .map((r) => r.stage?.id)
    .filter((id): id is string => id !== undefined);

  const stageBilansMap = new Map<string, string>(); // stageId → publicShareId
  if (stageIds.length > 0) {
    const stageBilans = await prisma.bilan.findMany({
      where: {
        studentId: student.id,
        stageId: { in: stageIds },
        type: 'STAGE_POST',
        studentMarkdown: { not: null },
      },
      select: { stageId: true, publicShareId: true },
    });
    for (const sb of stageBilans) {
      if (sb.stageId) stageBilansMap.set(sb.stageId, sb.publicShareId);
    }
  }

  // ── Compute derived data ─────────────────────────────────────────────────

  // Sessions
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const upcomingSessionsRaw = student.sessions.filter(
    (s) =>
      (s.status === 'SCHEDULED' || s.status === 'CONFIRMED') &&
      new Date(s.scheduledAt) > now
  );
  const nextSession = upcomingSessionsRaw.at(-1) ?? null;

  const todaySession = student.sessions.find(
    (s) =>
      (s.status === 'SCHEDULED' || s.status === 'CONFIRMED') &&
      new Date(s.scheduledAt) >= today &&
      new Date(s.scheduledAt) < todayEnd
  ) ?? null;

  const recentSessions = student.sessions.slice(0, 5).map((s) => ({
    id: s.id,
    title: s.title,
    subject: String(s.subject),
    status: s.status,
    scheduledAt: s.scheduledAt.toISOString(),
    coach: s.coach
      ? {
          firstName: s.coach.user.firstName ?? '',
          lastName: s.coach.user.lastName ?? '',
          pseudonym: s.coach.pseudonym,
        }
      : null,
  }));

  const formatSession = (s: typeof nextSession | null) =>
    s
      ? {
          id: s.id,
          title: s.title,
          subject: String(s.subject),
          scheduledAt: s.scheduledAt.toISOString(),
          duration: s.duration ?? 60,
          coach: s.coach
            ? {
                firstName: s.coach.user.firstName ?? '',
                lastName: s.coach.user.lastName ?? '',
                pseudonym: s.coach.pseudonym,
              }
            : null,
        }
      : null;

  // ARIA stats
  const ariaMessagesToday = student.ariaConversations.reduce(
    (count, conv) => count + conv.messages.length,
    0
  );

  // Credits
  const credits = computeCredits(student.creditTransactions);

  // Entitlements
  const activeFeatures = userEntitlements.flatMap((e) => e.features);
  const canUseAriaMaths = activeFeatures.includes('aria_maths');
  const canUseAriaNsi = activeFeatures.includes('aria_nsi');

  // Bilans
  const recentBilans = recentBilansRaw.map(toBilan);

  // Stages
  const stageItems = allStageReservations
    .map((r) => toStageItem(r, stageBilansMap.get(r.stage?.id ?? '') ?? null))
    .filter((item): item is EleveStageItem => item !== null);

  const upcomingStages = stageItems.filter(
    (item) => new Date(item.endDate) >= now && item.reservationStatus !== 'CANCELLED'
  );
  const pastStages = stageItems.filter(
    (item) =>
      new Date(item.endDate) < now ||
      item.reservationStatus === 'CANCELLED' ||
      item.reservationStatus === 'COMPLETED'
  );

  // Resources
  const resources = userDocs.map(toResource);

  // Track content
  const EDS_SKILL_GRAPH_BY_SUBJECT: Partial<Record<string, string>> = {
    MATHEMATIQUES: 'maths_premiere',
    NSI: 'nsi_premiere',
    PHYSIQUE_CHIMIE: 'physique_chimie_premiere',
    SVT: 'svt_premiere',
    FRANCAIS: 'francais_premiere',
    PHILOSOPHIE: 'philosophie_premiere',
    HISTOIRE_GEO: 'histoire_geo_premiere',
    ANGLAIS: 'anglais_premiere',
    ESPAGNOL: 'espagnol_premiere',
    SES: 'ses_premiere',
  };

  const STMG_MODULES_DEF = [
    { module: 'MATHS_STMG', label: 'Mathématiques STMG', subject: 'MATHEMATIQUES' as const, skillGraphRef: 'maths_premiere_stmg', diagnosticKey: 'maths-premiere-stmg-p2' },
    { module: 'SGN', label: 'Sciences de gestion et numérique', subject: 'SES' as const, skillGraphRef: 'sgn_premiere_stmg', diagnosticKey: 'sgn-premiere-stmg-p2' },
    { module: 'MANAGEMENT', label: 'Management', subject: 'SES' as const, skillGraphRef: 'management_premiere_stmg', diagnosticKey: 'management-premiere-stmg-p2' },
    { module: 'DROIT_ECO', label: 'Droit-Économie', subject: 'SES' as const, skillGraphRef: 'droit_eco_premiere_stmg', diagnosticKey: 'droit-eco-premiere-stmg-p2' },
  ] as const;

  const CHAPTER_COUNTS_BY_TRACK: Partial<Record<string, number>> = {
    maths_premiere: 12,
    maths_premiere_stmg: 8,
    nsi_premiere: 10,
    sgn_premiere_stmg: 6,
    management_premiere_stmg: 6,
    droit_eco_premiere_stmg: 8,
  };

  const makeProgress = (mp: typeof mathsProgressForTrack, skillRef: string) => ({
    totalXp: mp?.totalXp ?? 0,
    completedChapters: mp?.completedChapters ?? [],
    masteredChapters: mp?.masteredChapters ?? [],
    totalChaptersInProgram: CHAPTER_COUNTS_BY_TRACK[skillRef] ?? 10,
    bestCombo: mp?.bestCombo ?? 0,
    streak: mp?.streak ?? 0,
  });

  const trackContent: EleveDashboardData['trackContent'] = isStmg
    ? {
        specialties: [],
        stmgModules: STMG_MODULES_DEF.map((m) => ({
          subject: m.subject,
          module: m.module,
          label: m.label,
          skillGraphRef: m.skillGraphRef,
          progress: makeProgress(
            m.module === 'MATHS_STMG' ? mathsProgressForTrack : null,
            m.skillGraphRef
          ),
          diagnosticKey: m.diagnosticKey,
        })),
      }
    : {
        specialties: (student.specialties ?? []).map((subject) => {
          const skillRef = EDS_SKILL_GRAPH_BY_SUBJECT[String(subject)] ?? `${String(subject).toLowerCase()}_premiere`;
          return {
            subject,
            skillGraphRef: skillRef,
            progress: makeProgress(
              String(subject) === 'MATHEMATIQUES' ? mathsProgressForTrack : null,
              skillRef
            ),
            diagnosticKey:
              String(subject) === 'MATHEMATIQUES' ? 'maths-premiere-p2' :
              String(subject) === 'NSI' ? 'nsi-premiere-p2' :
              undefined,
          };
        }),
        stmgModules: [],
      };

  // Trajectory
  const rawMilestones = trajectoryData
    ? parseMilestones(trajectoryData.milestones)
    : [];
  const milestones: EleveTrajectoryMilestone[] = rawMilestones.map(toTrajectoryMilestone);
  const nextMilestoneAt = milestones
    .filter((m) => m.status === 'UPCOMING' || m.status === 'IN_PROGRESS')
    .sort((a, b) => a.targetDate.localeCompare(b.targetDate))[0]?.targetDate ?? null;

  // Automatismes (EDS Première only, derived from mathsProgress)
  const automatismes: EleveDashboardData['automatismes'] =
    !isStmg && mathsProgressForTrack
      ? toAutomatismesProgress(mathsProgressForTrack)
      : null;

  // Survival
  const survivalProgress: EleveDashboardData['survivalProgress'] =
    isStmg && gradeLevel === GradeLevel.PREMIERE && student.survivalMode
      ? (student.survivalProgress as EleveDashboardData['survivalProgress'])
      : null;

  // Feeuille de route + alertes
  const feuilleDeRoute = buildFeuilleDeRoute(
    { id: student.id, academicTrack, gradeLevel, survivalMode: student.survivalMode },
    nextStepResult,
    recentBilans,
    upcomingStages,
    formatSession(nextSession),
    mathsProgressForTrack
      ? { completedChapters: mathsProgressForTrack.completedChapters, lastActivityDate: mathsProgressForTrack.lastActivityDate ?? null }
      : null
  );

  const alertes = buildAlertes(
    { gradeLevel, survivalMode: student.survivalMode, credits: credits.balance },
    formatSession(nextSession),
    credits.balance
  );

  // ── Assemble final payload ─────────────────────────────────────────────
  return {
    student: {
      id: student.id,
      firstName: student.user.firstName ?? '',
      lastName: student.user.lastName ?? '',
      email: student.user.email,
      grade: student.grade ?? '',
      gradeLevel,
      academicTrack,
      specialties: student.specialties ?? [],
      stmgPathway: student.stmgPathway ?? null,
      survivalMode: student.survivalMode,
      survivalModeReason: student.survivalModeReason ?? null,
      school: student.school ?? null,
    },
    cockpit: {
      seanceDuJour: formatSession(todaySession),
      feuilleDeRoute,
      alertes,
    },
    trackContent,
    sessionsCount: student.totalSessions,
    nextSession: formatSession(nextSession),
    recentSessions,
    lastBilan: recentBilans[0] ?? null,
    recentBilans,
    upcomingStages,
    pastStages,
    resources,
    ariaStats: {
      messagesToday: ariaMessagesToday,
      totalConversations: student.ariaConversations.length,
      canUseAriaMaths,
      canUseAriaNsi,
    },
    badges: student.badges.map((sb) => ({
      id: sb.badge.id,
      name: sb.badge.name,
      description: sb.badge.description,
      icon: sb.badge.icon ?? '',
      earnedAt: sb.earnedAt.toISOString(),
    })),
    trajectory: {
      id: trajectoryData?.id ?? null,
      title: trajectoryData?.title ?? null,
      progress: trajectoryData?.progress ?? 0,
      daysRemaining: trajectoryData?.daysRemaining ?? 0,
      milestones,
      nextMilestoneAt,
    },
    automatismes,
    survivalProgress,
    credits,
  };
}
