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
import { AcademicTrack, GradeLevel, MathsLevel, Subject, UserRole } from '@prisma/client';
import { getActiveTrajectory, parseMilestones } from '@/lib/trajectory';
import { getNextStep } from '@/lib/next-step-engine';
import { getUserEntitlements } from '@/lib/entitlement/engine';
import { listOfficialPdfsForProfile } from '@/lib/programme/official-pdfs';
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
  EleveHub,
  EleveHubResourceCategory,
  EleveHubResource,
} from '@/components/dashboard/eleve/types';

// ─── Subject normaliser ───────────────────────────────────────────────────────

const SUBJECT_TO_BILAN_SUBJECT: Record<string, EleveBilanSubject> = {
  MATHEMATIQUES: 'MATHEMATIQUES',
  MATHS_STMG: 'MATHS_STMG',
  NSI: 'NSI',
  DROIT_ECO: 'DROIT_ECO',
  MANAGEMENT: 'MANAGEMENT',
  SGN: 'SGN',
  FRANCAIS: 'FRANCAIS',
};

const SUBJECT_LABELS: Record<EleveBilanSubject, string> = {
  MATHEMATIQUES: 'Mathématiques',
  MATHS_STMG: 'Mathématiques STMG',
  NSI: 'NSI',
  DROIT_ECO: 'Droit-Économie',
  MANAGEMENT: 'Management',
  SGN: 'Sciences de gestion et numérique',
  FRANCAIS: 'Français',
  MIXTE: 'Multi-matières',
};

// ─── Hub Ressources Pédagogiques builder (Lot B) ─────────────────────────────

/**
 * Empty Hub skeleton — every category present with [] to simplify UI rendering.
 */
function emptyHub(): EleveHub {
  return {
    byCategory: {
      INTERACTIVE_PROGRAM: [],
      OFFICIAL_PROGRAM: [],
      OFFICIAL_AUTOMATISMES: [],
      OFFICIAL_SUJET: [],
      COACH_RESOURCE: [],
      USER_DOCUMENT: [],
      RAG_REFERENCE: [],
      INVOICE: [],
      RECEIPT: [],
      STAGE_BILAN: [],
    },
    totalCount: 0,
    recentlyAddedCount: 0,
  };
}

function addInteractiveProgramResources(
  hub: EleveHub,
  input: { level: GradeLevel; track: AcademicTrack }
) {
  const isStmg =
    input.track === AcademicTrack.STMG ||
    input.track === AcademicTrack.STMG_NON_LYCEEN;

  if (!isStmg || input.level !== GradeLevel.PREMIERE) {
    return;
  }

  const resources: EleveHubResource[] = [
    {
      id: 'interactive:maths-stmg',
      category: 'INTERACTIVE_PROGRAM',
      title: 'Mathématiques STMG — livret interactif',
      subtitle: 'Parcours gamifié, automatismes et QCM chrono',
      level: input.level,
      track: input.track,
      subject: Subject.MATHEMATIQUES,
      type: 'LINK',
      externalUrl: '/dashboard/eleve/programme/maths',
      badge: 'INTERACTIF',
    },
    {
      id: 'interactive:maths-stmg-qcm',
      category: 'INTERACTIVE_PROGRAM',
      title: 'Banque QCM Maths STMG — 30 questions',
      subtitle: 'Questions corrigées par domaine du programme',
      level: input.level,
      track: input.track,
      subject: Subject.MATHEMATIQUES,
      type: 'LINK',
      externalUrl: '/dashboard/eleve/programme/maths#qcm',
      badge: 'INTERACTIF',
    },
    {
      id: 'interactive:maths-stmg-skill-graph',
      category: 'INTERACTIVE_PROGRAM',
      title: 'Skill graph Maths STMG — 17 compétences',
      subtitle: 'Suites, fonctions, évolutions, statistiques, probabilités et tableur',
      level: input.level,
      track: input.track,
      subject: Subject.MATHEMATIQUES,
      type: 'LINK',
      externalUrl: '/dashboard/eleve/programme/maths#programme',
      badge: 'INTERACTIF',
    },
    {
      id: 'interactive:sgn-stmg',
      category: 'INTERACTIVE_PROGRAM',
      title: 'Sciences de gestion et numérique',
      subtitle: 'Interface interactive du programme STMG',
      level: input.level,
      track: input.track,
      subject: Subject.SES,
      type: 'LINK',
      externalUrl: '/dashboard/eleve/programme/sgn',
      badge: 'INTERACTIF',
    },
    {
      id: 'interactive:management-stmg',
      category: 'INTERACTIVE_PROGRAM',
      title: 'Management',
      subtitle: 'Interface interactive du programme STMG',
      level: input.level,
      track: input.track,
      subject: Subject.SES,
      type: 'LINK',
      externalUrl: '/dashboard/eleve/programme/management',
      badge: 'INTERACTIF',
    },
    {
      id: 'interactive:droit-eco-stmg',
      category: 'INTERACTIVE_PROGRAM',
      title: 'Droit-Économie',
      subtitle: 'Interface interactive du programme STMG',
      level: input.level,
      track: input.track,
      subject: Subject.SES,
      type: 'LINK',
      externalUrl: '/dashboard/eleve/programme/droit_eco',
      badge: 'INTERACTIF',
    },
    {
      id: 'interactive:eaf',
      category: 'INTERACTIVE_PROGRAM',
      title: 'Français EAF',
      subtitle: 'Accès à Nexus EAF',
      level: input.level,
      track: input.track,
      subject: Subject.FRANCAIS,
      type: 'LINK',
      externalUrl: 'https://eaf.nexusreussite.academy',
      badge: 'INTERACTIF',
    },
  ];

  hub.byCategory.INTERACTIVE_PROGRAM.push(...resources);
}

/**
 * Decide UserDocument category based on uploader role:
 *   - uploadedBy.role === COACH and uploadedById !== userId → COACH_RESOURCE
 *   - otherwise (no uploader, system, admin, parent, self) → USER_DOCUMENT
 */
function userDocCategory(
  doc: { uploadedById: string | null; uploadedBy: { id: string; role: UserRole; firstName: string | null; lastName: string | null } | null },
  studentUserId: string,
): EleveHubResourceCategory {
  if (
    doc.uploadedBy &&
    doc.uploadedBy.role === UserRole.COACH &&
    doc.uploadedById !== studentUserId
  ) {
    return 'COACH_RESOURCE';
  }
  return 'USER_DOCUMENT';
}

/**
 * Build the Hub Ressources Pédagogiques aggregator.
 *
 * Aggregation sources:
 *   - OFFICIAL_PROGRAM | OFFICIAL_AUTOMATISMES | OFFICIAL_SUJET → static mapping
 *     filtered by (level × track) via lib/programme/official-pdfs.
 *   - COACH_RESOURCE | USER_DOCUMENT → derived from already-fetched userDocs (Q5).
 *   - RAG_REFERENCE → currently empty (TODO: requires schema extension to track
 *     consulted RAG sources per ARIA conversation; out-of-scope for Lot B).
 *   - INVOICE | RECEIPT → derived from userInvoices (Q10).
 *   - STAGE_BILAN → derived from already-computed stageItems (no extra query).
 *
 * Note: this builder does NOT issue any Prisma query of its own. It consumes
 * data already fetched by the main payload builder (Q5, Q10, derived stages).
 */
export function buildHub(input: {
  level: GradeLevel;
  track: AcademicTrack;
  studentUserId: string;
  userDocs: ReadonlyArray<{
    id: string;
    title: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
    documentType: string;
    visibilityScope: string;
    subject: string | null;
    description: string | null;
    uploadedById: string | null;
    uploadedBy: { id: string; role: UserRole; firstName: string | null; lastName: string | null } | null;
  }>;
  invoices: ReadonlyArray<{
    id: string;
    number: string;
    status: string;
    issuedAt: Date;
    paidAt: Date | null;
    total: number;
    currency: string;
    pdfUrl: string | null;
  }>;
  stageItems: ReadonlyArray<EleveStageItem>;
}): EleveHub {
  const hub = emptyHub();
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // ── Official PDFs (static, gated by level × track) ──────────────────────
  for (const pdf of listOfficialPdfsForProfile(input.level, input.track)) {
    const category: EleveHubResourceCategory =
      pdf.category === 'PROGRAM'
        ? 'OFFICIAL_PROGRAM'
        : pdf.category === 'AUTOMATISMES'
          ? 'OFFICIAL_AUTOMATISMES'
          : 'OFFICIAL_SUJET'; // PROGRAM | AUTOMATISMES | SUJET | EXEMPLE all map to one of three official buckets
    const bucket: EleveHubResourceCategory =
      pdf.category === 'EXEMPLE' ? 'OFFICIAL_SUJET' : category;
    hub.byCategory[bucket].push({
      id: `official:${pdf.slug}`,
      category: bucket,
      title: pdf.title,
      subtitle: pdf.description,
      level: pdf.level,
      track: pdf.track === 'BOTH' || pdf.track === 'ALL' ? input.track : pdf.track,
      type: 'PDF',
      sizeBytes: pdf.sizeBytes,
      uploadedAt: pdf.publishedAt,
      downloadUrl: `/api/student/resources/official/${pdf.slug}`,
      badge: 'OFFICIEL',
    });
  }

  // ── Existing interactive programme interfaces ───────────────────────────
  addInteractiveProgramResources(hub, { level: input.level, track: input.track });

  // ── User documents → COACH_RESOURCE or USER_DOCUMENT ────────────────────
  for (const doc of input.userDocs) {
    const cat = userDocCategory(doc, input.studentUserId);
    const isPdf = doc.mimeType === 'application/pdf';
    const isMd = doc.mimeType === 'text/markdown' || doc.mimeType === 'text/x-markdown';
    const mediaType: EleveHubResource['type'] = isPdf
      ? 'PDF'
      : isMd
        ? 'MARKDOWN'
        : doc.mimeType.startsWith('text/')
          ? 'MARKDOWN'
          : 'PDF';

    const isRecent = doc.createdAt.getTime() >= sevenDaysAgo;
    const uploaderName =
      cat === 'COACH_RESOURCE' && doc.uploadedBy
        ? `${doc.uploadedBy.firstName ?? ''} ${doc.uploadedBy.lastName ?? ''}`.trim() || undefined
        : undefined;

    hub.byCategory[cat].push({
      id: `userdoc:${doc.id}`,
      category: cat,
      title: doc.title,
      subtitle: doc.description ?? undefined,
      subject: (doc.subject ?? undefined) as EleveHubResource['subject'],
      type: mediaType,
      uploadedAt: doc.createdAt.toISOString(),
      sizeBytes: doc.sizeBytes,
      downloadUrl: `/api/student/documents/${doc.id}/download`,
      uploaderRole: doc.uploadedBy?.role,
      uploaderName,
      badge: cat === 'COACH_RESOURCE' ? 'COACH' : isRecent ? 'NOUVEAU' : 'PERSONNEL',
    });
  }

  // ── Invoices ─────────────────────────────────────────────────────────────
  for (const inv of input.invoices) {
    const isReceipt = inv.status === 'PAID' && inv.paidAt !== null;
    const cat: EleveHubResourceCategory = isReceipt ? 'RECEIPT' : 'INVOICE';
    hub.byCategory[cat].push({
      id: `invoice:${inv.id}`,
      category: cat,
      title: isReceipt
        ? `Reçu de paiement n°${inv.number}`
        : `Facture n°${inv.number}`,
      subtitle: `${(inv.total / 1000).toFixed(2)} ${inv.currency}`,
      type: inv.pdfUrl ? 'PDF' : 'LINK',
      uploadedAt: inv.issuedAt.toISOString(),
      downloadUrl: inv.pdfUrl ?? undefined,
      externalUrl: inv.pdfUrl ? undefined : `/dashboard/eleve/factures/${inv.id}`,
    });
  }

  // ── Stage bilans (derived from already-computed stageItems) ─────────────
  for (const stage of input.stageItems) {
    if (stage.hasBilan && stage.bilanUrl) {
      hub.byCategory.STAGE_BILAN.push({
        id: `stage-bilan:${stage.reservationId}`,
        category: 'STAGE_BILAN',
        title: `Bilan post-stage — ${stage.title}`,
        subtitle: `Stage du ${new Date(stage.startDate).toLocaleDateString('fr-FR')}`,
        type: 'LINK',
        uploadedAt: stage.endDate,
        externalUrl: stage.bilanUrl,
      });
    }
  }

  // ── RAG_REFERENCE ──────────────────────────────────────────────────────
  // TODO (post Lot B): surface RAG sources consulted during ARIA conversations.
  //   Requires either a schema extension (AriaConversation.referencesUsed) or a
  //   denormalised view from the RAG ingestor. Out-of-scope for Lot B.

  // ── Tally totals ────────────────────────────────────────────────────────
  for (const list of Object.values(hub.byCategory)) {
    hub.totalCount += list.length;
    for (const r of list) {
      if (r.uploadedAt && new Date(r.uploadedAt).getTime() >= sevenDaysAgo) {
        hub.recentlyAddedCount += 1;
      }
    }
  }

  return hub;
}

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
    resultUrl: `/dashboard/eleve/bilans/${bilan.publicShareId}`,
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
      ? `/dashboard/eleve/bilans/${bilanPublicShareId}`
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

  // ── Q2–Q8 + Q10: Parallel independent queries ──────────────────────────────────
  const [
    mathsProgressForTrack,
    recentBilansRaw,
    allStageReservations,
    userDocs,
    userEntitlements,
    trajectoryData,
    nextStepResult,
    userInvoices,
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
    // Only return published bilans
    prisma.bilan.findMany({
      where: {
        studentId: student.id,
        studentMarkdown: { not: null },
        isPublished: true,
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
        documentType: true,
        visibilityScope: true,
        subject: true,
        description: true,
        uploadedById: true,
        uploadedBy: {
          select: {
            id: true,
            role: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),

    // Q6: Entitlements (ARIA features)
    getUserEntitlements(userId),

    // Q7: Active trajectory
    getActiveTrajectory(student.id),

    // Q8: Next step engine
    getNextStep(userId).catch(() => null),

    // Q10: Invoices addressed to this student (beneficiaryUserId)
    // Used by the Hub to surface INVOICE / RECEIPT entries
    prisma.invoice.findMany({
      where: { beneficiaryUserId: userId },
      orderBy: { issuedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        number: true,
        status: true,
        issuedAt: true,
        paidAt: true,
        total: true,
        currency: true,
        pdfUrl: true,
      },
    }),
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
        isPublished: true,
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

  // ── Build Hub Ressources Pédagogiques ───────────────────────────────────────
  const hub = buildHub({
    level: gradeLevel,
    track: academicTrack,
    studentUserId: student.id,
    userDocs,
    invoices: userInvoices,
    stageItems,
  });

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
    hub,
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
