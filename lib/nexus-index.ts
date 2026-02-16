/**
 * Nexus Index™ — Composite score measuring student progression quality.
 *
 * The index aggregates 4 pillars into a single 0–100 score:
 *   1. Assiduité  (30%) — Session attendance rate
 *   2. Progression (30%) — Coach performance ratings trend
 *   3. Engagement  (20%) — Platform interaction depth (ARIA, feedback, reports)
 *   4. Régularité  (20%) — Session frequency consistency over time
 *
 * Each pillar is scored 0–100 independently, then weighted.
 *
 * Usage:
 *   import { computeNexusIndex } from '@/lib/nexus-index';
 *   const index = await computeNexusIndex(studentUserId);
 */

import { prisma } from '@/lib/prisma';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Individual pillar score (0–100) */
export interface PillarScore {
  /** Pillar identifier */
  key: 'assiduite' | 'progression' | 'engagement' | 'regularite';
  /** Human-readable label */
  label: string;
  /** Score 0–100 */
  score: number;
  /** Weight in the global index (0–1, sum = 1) */
  weight: number;
  /** Weighted contribution to global score */
  weighted: number;
}

/** Trend direction based on recent vs historical data */
export type Trend = 'up' | 'down' | 'stable';

/** Complete Nexus Index result */
export interface NexusIndexResult {
  /** Global composite score (0–100) */
  globalScore: number;
  /** Qualitative level derived from globalScore */
  level: 'excellent' | 'bon' | 'en_progression' | 'a_renforcer' | 'debutant';
  /** Trend direction (comparing last 30 days vs previous 30 days) */
  trend: Trend;
  /** Individual pillar breakdown */
  pillars: PillarScore[];
  /** ISO timestamp of computation */
  computedAt: string;
  /** Number of data points used (sessions, conversations, etc.) */
  dataPoints: number;
}

/** Raw data fetched from DB for index computation */
export interface NexusIndexData {
  /** All session bookings for the student (userId) */
  sessions: SessionData[];
  /** Session reports written by coaches */
  reports: ReportData[];
  /** ARIA conversation count */
  ariaConversationCount: number;
  /** ARIA messages with feedback */
  ariaFeedbackCount: number;
  /** Diagnostic/assessment count */
  diagnosticCount: number;
  /** Student record */
  student: { id: string; createdAt: Date } | null;
}

interface SessionData {
  status: string;
  scheduledDate: Date;
  rating: number | null;
  studentAttended: boolean | null;
  completedAt: Date | null;
}

interface ReportData {
  performanceRating: number;
  engagementLevel: string | null;
  createdAt: Date;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Pillar weights — must sum to 1.0 */
export const PILLAR_WEIGHTS = {
  assiduite: 0.30,
  progression: 0.30,
  engagement: 0.20,
  regularite: 0.20,
} as const;

/** Minimum sessions required for a meaningful index */
export const MIN_SESSIONS_FOR_INDEX = 3;

/** Number of days for "recent" window (trend computation) */
const RECENT_WINDOW_DAYS = 30;

/** Level thresholds */
const LEVEL_THRESHOLDS = {
  excellent: 80,
  bon: 60,
  en_progression: 40,
  a_renforcer: 20,
} as const;

// ─── Main Entry Point ────────────────────────────────────────────────────────

/**
 * Compute the Nexus Index for a student.
 *
 * @param studentUserId - The User.id of the student (not Student.id)
 * @returns NexusIndexResult or null if insufficient data
 */
export async function computeNexusIndex(
  studentUserId: string
): Promise<NexusIndexResult | null> {
  try {
    const data = await fetchIndexData(studentUserId);
    return computeFromData(data);
  } catch (error) {
    console.error('[NexusIndex] Error computing index:', error);
    return null;
  }
}

/**
 * Pure computation function — no DB access, fully testable.
 *
 * @param data - Pre-fetched data for computation
 * @returns NexusIndexResult or null if insufficient data
 */
export function computeFromData(data: NexusIndexData): NexusIndexResult | null {
  if (!data.student) return null;

  const completedSessions = data.sessions.filter(
    (s) => s.status === 'COMPLETED'
  );

  // Not enough data for a meaningful index
  if (data.sessions.length < MIN_SESSIONS_FOR_INDEX) {
    return buildResult({
      assiduite: 0,
      progression: 0,
      engagement: 0,
      regularite: 0,
      trend: 'stable',
      dataPoints: data.sessions.length,
    });
  }

  const assiduite = computeAssiduite(data.sessions);
  const progression = computeProgression(data.reports);
  const engagement = computeEngagement(
    completedSessions.length,
    data.ariaConversationCount,
    data.ariaFeedbackCount,
    data.diagnosticCount,
    data.reports.length
  );
  const regularite = computeRegularite(
    completedSessions,
    data.student.createdAt
  );
  const trend = computeTrend(data.sessions, data.reports);

  const dataPoints =
    data.sessions.length +
    data.reports.length +
    data.ariaConversationCount +
    data.diagnosticCount;

  return buildResult({
    assiduite,
    progression,
    engagement,
    regularite,
    trend,
    dataPoints,
  });
}

// ─── Pillar Computations ─────────────────────────────────────────────────────

/**
 * Assiduité (0–100): Ratio of attended sessions vs total scheduled.
 * - COMPLETED with studentAttended=true → full credit
 * - COMPLETED with studentAttended=null → assumed attended (80% credit)
 * - CANCELLED / NO_SHOW → 0 credit
 * - SCHEDULED / CONFIRMED → excluded (future)
 */
export function computeAssiduite(sessions: SessionData[]): number {
  const relevantStatuses = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];
  const relevant = sessions.filter((s) =>
    relevantStatuses.includes(s.status)
  );

  if (relevant.length === 0) return 50; // Neutral if no past sessions

  let attendedScore = 0;
  for (const session of relevant) {
    if (session.status === 'COMPLETED') {
      attendedScore += session.studentAttended === true ? 1.0 : 0.8;
    }
    // CANCELLED and NO_SHOW contribute 0
  }

  return clamp(Math.round((attendedScore / relevant.length) * 100));
}

/**
 * Progression (0–100): Weighted average of coach performance ratings.
 * - Recent reports weighted 2x vs older ones
 * - performanceRating is 1–5, mapped to 0–100
 */
export function computeProgression(reports: ReportData[]): number {
  if (reports.length === 0) return 50; // Neutral baseline

  const now = new Date();
  const recentCutoff = new Date(
    now.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  let weightedSum = 0;
  let totalWeight = 0;

  for (const report of reports) {
    const isRecent = report.createdAt >= recentCutoff;
    const weight = isRecent ? 2.0 : 1.0;
    // Map 1–5 rating to 0–100
    const normalized = ((report.performanceRating - 1) / 4) * 100;
    weightedSum += normalized * weight;
    totalWeight += weight;
  }

  return clamp(Math.round(weightedSum / totalWeight));
}

/**
 * Engagement (0–100): Composite of platform interaction signals.
 * - Sessions completed: up to 40 points (10 sessions = max)
 * - ARIA conversations: up to 25 points (5 conversations = max)
 * - ARIA feedback given: up to 15 points (10 feedbacks = max)
 * - Diagnostics taken: up to 10 points (2 diagnostics = max)
 * - Reports received: up to 10 points (5 reports = max)
 */
export function computeEngagement(
  completedSessionCount: number,
  ariaConversationCount: number,
  ariaFeedbackCount: number,
  diagnosticCount: number,
  reportCount: number
): number {
  const sessionPoints = Math.min(completedSessionCount / 10, 1) * 40;
  const ariaPoints = Math.min(ariaConversationCount / 5, 1) * 25;
  const feedbackPoints = Math.min(ariaFeedbackCount / 10, 1) * 15;
  const diagnosticPoints = Math.min(diagnosticCount / 2, 1) * 10;
  const reportPoints = Math.min(reportCount / 5, 1) * 10;

  return clamp(
    Math.round(
      sessionPoints +
        ariaPoints +
        feedbackPoints +
        diagnosticPoints +
        reportPoints
    )
  );
}

/**
 * Régularité (0–100): Consistency of session frequency.
 * Measures how evenly sessions are spread over the student's active period.
 * - Ideal: 1+ session per week
 * - Penalized for long gaps (>14 days without a session)
 */
export function computeRegularite(
  completedSessions: SessionData[],
  studentCreatedAt: Date
): number {
  if (completedSessions.length < 2) return 30; // Low baseline for insufficient data

  // Sort by date
  const sorted = [...completedSessions].sort(
    (a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime()
  );

  const now = new Date();
  const accountAgeDays = Math.max(
    1,
    (now.getTime() - studentCreatedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const accountAgeWeeks = Math.max(1, accountAgeDays / 7);

  // Sessions per week ratio (ideal = 1.0+)
  const sessionsPerWeek = completedSessions.length / accountAgeWeeks;
  const frequencyScore = Math.min(sessionsPerWeek / 1.0, 1.0) * 60;

  // Gap penalty: count gaps > 14 days between consecutive sessions
  let longGaps = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gapDays =
      (sorted[i].scheduledDate.getTime() -
        sorted[i - 1].scheduledDate.getTime()) /
      (1000 * 60 * 60 * 24);
    if (gapDays > 14) longGaps++;
  }

  const maxPossibleGaps = Math.max(1, sorted.length - 1);
  const gapPenalty = (longGaps / maxPossibleGaps) * 40;

  return clamp(Math.round(frequencyScore + (40 - gapPenalty)));
}

// ─── Trend Computation ───────────────────────────────────────────────────────

/**
 * Compute trend by comparing recent window performance vs previous window.
 */
export function computeTrend(
  sessions: SessionData[],
  reports: ReportData[]
): Trend {
  const now = new Date();
  const recentCutoff = new Date(
    now.getTime() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const previousCutoff = new Date(
    now.getTime() - 2 * RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  // Compare completion rates
  const recentSessions = sessions.filter(
    (s) => s.scheduledDate >= recentCutoff
  );
  const previousSessions = sessions.filter(
    (s) => s.scheduledDate >= previousCutoff && s.scheduledDate < recentCutoff
  );

  const recentCompletionRate = computeCompletionRate(recentSessions);
  const previousCompletionRate = computeCompletionRate(previousSessions);

  // Compare report ratings
  const recentReports = reports.filter((r) => r.createdAt >= recentCutoff);
  const previousReports = reports.filter(
    (r) => r.createdAt >= previousCutoff && r.createdAt < recentCutoff
  );

  const recentAvgRating = averageRating(recentReports);
  const previousAvgRating = averageRating(previousReports);

  // Weighted signal: 60% completion rate trend, 40% rating trend
  const completionDelta = recentCompletionRate - previousCompletionRate;
  const ratingDelta = recentAvgRating - previousAvgRating;

  const signal = completionDelta * 0.6 + ratingDelta * 0.4;

  // Threshold: ±5% to avoid noise
  if (signal > 5) return 'up';
  if (signal < -5) return 'down';
  return 'stable';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeCompletionRate(sessions: SessionData[]): number {
  if (sessions.length === 0) return 50;
  const completed = sessions.filter((s) => s.status === 'COMPLETED').length;
  return (completed / sessions.length) * 100;
}

function averageRating(reports: ReportData[]): number {
  if (reports.length === 0) return 50;
  const sum = reports.reduce((acc, r) => acc + r.performanceRating, 0);
  return ((sum / reports.length - 1) / 4) * 100; // Map 1–5 to 0–100
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function getLevel(
  score: number
): NexusIndexResult['level'] {
  if (score >= LEVEL_THRESHOLDS.excellent) return 'excellent';
  if (score >= LEVEL_THRESHOLDS.bon) return 'bon';
  if (score >= LEVEL_THRESHOLDS.en_progression) return 'en_progression';
  if (score >= LEVEL_THRESHOLDS.a_renforcer) return 'a_renforcer';
  return 'debutant';
}

interface BuildResultInput {
  assiduite: number;
  progression: number;
  engagement: number;
  regularite: number;
  trend: Trend;
  dataPoints: number;
}

function buildResult(input: BuildResultInput): NexusIndexResult {
  const pillars: PillarScore[] = [
    {
      key: 'assiduite',
      label: 'Assiduité',
      score: input.assiduite,
      weight: PILLAR_WEIGHTS.assiduite,
      weighted: Math.round(input.assiduite * PILLAR_WEIGHTS.assiduite),
    },
    {
      key: 'progression',
      label: 'Progression',
      score: input.progression,
      weight: PILLAR_WEIGHTS.progression,
      weighted: Math.round(input.progression * PILLAR_WEIGHTS.progression),
    },
    {
      key: 'engagement',
      label: 'Engagement',
      score: input.engagement,
      weight: PILLAR_WEIGHTS.engagement,
      weighted: Math.round(input.engagement * PILLAR_WEIGHTS.engagement),
    },
    {
      key: 'regularite',
      label: 'Régularité',
      score: input.regularite,
      weight: PILLAR_WEIGHTS.regularite,
      weighted: Math.round(input.regularite * PILLAR_WEIGHTS.regularite),
    },
  ];

  const globalScore = pillars.reduce((sum, p) => sum + p.weighted, 0);

  return {
    globalScore: clamp(globalScore),
    level: getLevel(globalScore),
    trend: input.trend,
    pillars,
    computedAt: new Date().toISOString(),
    dataPoints: input.dataPoints,
  };
}

// ─── Data Fetching ───────────────────────────────────────────────────────────

/**
 * Fetch all data needed for Nexus Index computation.
 * Separated from computation for testability.
 */
export async function fetchIndexData(
  studentUserId: string
): Promise<NexusIndexData> {
  const student = await prisma.student.findUnique({
    where: { userId: studentUserId },
    select: { id: true, createdAt: true },
  });

  if (!student) {
    return {
      sessions: [],
      reports: [],
      ariaConversationCount: 0,
      ariaFeedbackCount: 0,
      diagnosticCount: 0,
      student: null,
    };
  }

  // Parallel queries for performance
  const [sessions, reports, ariaConversationCount, ariaFeedbackCount, diagnosticCount] =
    await Promise.all([
      prisma.sessionBooking.findMany({
        where: { studentId: studentUserId },
        select: {
          status: true,
          scheduledDate: true,
          rating: true,
          studentAttended: true,
          completedAt: true,
        },
        orderBy: { scheduledDate: 'asc' },
      }),
      prisma.sessionReport.findMany({
        where: { studentId: student.id },
        select: {
          performanceRating: true,
          engagementLevel: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.ariaConversation.count({
        where: { studentId: student.id },
      }),
      prisma.ariaMessage.count({
        where: {
          conversation: { studentId: student.id },
          feedback: { not: null },
        },
      }),
      prisma.diagnostic.count({
        where: {
          studentEmail: studentUserId, // Diagnostics use email, not userId
          status: { in: ['SCORED', 'ANALYZED'] },
        },
      }),
    ]);

  return {
    sessions,
    reports,
    ariaConversationCount,
    ariaFeedbackCount,
    diagnosticCount,
    student,
  };
}
