/**
 * Coach-side summary computation for NSI Pratique 2026 progress data.
 * Reuses computeStats from recommendations.ts and adds coach-specific metrics.
 * All logic lives here — not in React components.
 */
import { computeStats, getRecommendedNextAction } from './recommendations';
import { nsiSubjects } from '@/data/nsi-pratique-2026/subjects';
import { nsiPatterns } from '@/data/nsi-pratique-2026/patterns';
import type { NsiProgress, SubjectStatus } from '@/data/nsi-pratique-2026/types';

export type ReadinessLevel = 'ready' | 'almost' | 'consolidate' | 'none';

export interface CoachStudentSummary {
  // Identity
  studentId: string;
  userId: string;
  firstName: string;
  lastName: string;
  hasProgress: boolean;
  lastUpdated: string | null;

  // Subjects (23 total)
  subjectsMastered: number;
  subjectsSeen: number;
  subjectsToReview: number;
  subjectsNotStarted: number;
  subjectsTotal: number;
  statusCounts: Record<SubjectStatus, number>;

  // Patterns (8 total)
  patternsMastered: number;
  patternsTotal: number;

  // Plan 5 jours
  planCompleted: number;
  planTotal: number;

  // Self-assessment
  assessmentOk: number;
  assessmentTotal: number;

  // Mock exams
  mockExamsCount: number;

  // Oral
  oralQuestionsWorked: number;

  // Derived
  readiness: ReadinessLevel;
  readinessLabel: string;
  progressPercent: number;
  estimatedMinutesRemaining: number;
  recommendation: string | null;
}

const READINESS_LABELS: Record<ReadinessLevel, string> = {
  ready: 'Prêt',
  almost: 'Presque prêt',
  consolidate: 'À consolider',
  none: 'Pas commencé',
};

const TOTAL_SUBJECTS = 23;
const TOTAL_PATTERNS = 8;

/**
 * Compute a complete coach-visible summary from raw NsiProgress data.
 */
export function computeCoachStudentSummary(
  identity: { studentId: string; userId: string; firstName: string; lastName: string },
  progressData: NsiProgress | null,
  lastUpdated: string | null,
): CoachStudentSummary {
  if (!progressData) {
    return {
      ...identity,
      hasProgress: false,
      lastUpdated,
      subjectsMastered: 0,
      subjectsSeen: 0,
      subjectsToReview: 0,
      subjectsNotStarted: TOTAL_SUBJECTS,
      subjectsTotal: TOTAL_SUBJECTS,
      statusCounts: {
        not_started: TOTAL_SUBJECTS, read: 0, coded: 0,
        tested: 0, explained: 0, mastered: 0, needs_review: 0,
      },
      patternsMastered: 0,
      patternsTotal: TOTAL_PATTERNS,
      planCompleted: 0,
      planTotal: 0,
      assessmentOk: 0,
      assessmentTotal: 0,
      mockExamsCount: 0,
      oralQuestionsWorked: 0,
      readiness: 'none',
      readinessLabel: READINESS_LABELS.none,
      progressPercent: 0,
      estimatedMinutesRemaining: TOTAL_SUBJECTS * 30,
      recommendation: null,
    };
  }

  const stats = computeStats(progressData, TOTAL_SUBJECTS, TOTAL_PATTERNS);
  const rec = getRecommendedNextAction(progressData, TOTAL_SUBJECTS, TOTAL_PATTERNS);

  const readiness: ReadinessLevel = stats.readinessLevel === 'ready'
    ? 'ready'
    : stats.readinessLevel === 'almost'
      ? 'almost'
      : 'consolidate';

  const progressPercent = TOTAL_SUBJECTS > 0
    ? Math.round((stats.subjectsMastered / TOTAL_SUBJECTS) * 100)
    : 0;

  return {
    ...identity,
    hasProgress: true,
    lastUpdated,
    subjectsMastered: stats.subjectsMastered,
    subjectsSeen: stats.subjectsSeen,
    subjectsToReview: stats.subjectsToReview,
    subjectsNotStarted: stats.subjectsNotStarted,
    subjectsTotal: TOTAL_SUBJECTS,
    statusCounts: stats.statusCounts,
    patternsMastered: stats.patternsMastered,
    patternsTotal: TOTAL_PATTERNS,
    planCompleted: stats.planCompleted,
    planTotal: stats.planTotal,
    assessmentOk: stats.assessmentOk,
    assessmentTotal: stats.assessmentTotal,
    mockExamsCount: stats.mockExamsCount,
    oralQuestionsWorked: stats.oralQuestionsWorked,
    readiness,
    readinessLabel: READINESS_LABELS[readiness],
    progressPercent,
    estimatedMinutesRemaining: stats.estimatedMinutesRemaining,
    recommendation: rec?.label ?? null,
  };
}

/**
 * Aggregate stats across all students for the coach overview.
 */
export function computeCoachCohortStats(summaries: CoachStudentSummary[]) {
  let ready = 0;
  let almost = 0;
  let consolidate = 0;
  let noProgress = 0;

  for (const s of summaries) {
    if (s.readiness === 'ready') ready++;
    else if (s.readiness === 'almost') almost++;
    else if (s.readiness === 'none') noProgress++;
    else consolidate++;
  }

  return {
    total: summaries.length,
    ready,
    almost,
    consolidate,
    noProgress,
    averageProgress: summaries.length > 0
      ? Math.round(summaries.reduce((sum, s) => sum + s.progressPercent, 0) / summaries.length)
      : 0,
    totalMockExams: summaries.reduce((sum, s) => sum + s.mockExamsCount, 0),
  };
}

/**
 * For the detail page: compute per-subject detail for display.
 */
export function getSubjectDetails(progress: NsiProgress) {
  return nsiSubjects.map((subject) => {
    const sp = progress.subjects[subject.id];
    return {
      id: subject.id,
      title: subject.title,
      shortTitle: subject.shortTitle,
      family: subject.family,
      difficulty: subject.difficulty,
      status: sp?.status ?? 'not_started' as SubjectStatus,
      lastWorkedAt: sp?.lastWorkedAt ?? null,
      notes: sp?.notes ?? null,
      patterns: subject.patterns,
    };
  });
}

/**
 * For the detail page: compute per-pattern detail for display.
 */
export function getPatternDetails(progress: NsiProgress) {
  return nsiPatterns.map((pattern) => {
    const pp = progress.patterns[pattern.id];
    return {
      id: pattern.id,
      title: pattern.title,
      mastered: pp?.mastered ?? false,
      writtenByHand: pp?.writtenByHand ?? false,
      lastPracticedAt: pp?.lastPracticedAt ?? null,
      relatedSubjects: pattern.relatedSubjects,
    };
  });
}
