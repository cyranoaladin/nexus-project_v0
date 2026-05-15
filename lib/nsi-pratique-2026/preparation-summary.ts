import type { NsiProgress } from '@/data/nsi-pratique-2026/types';
import type { NsiSubject, NsiPattern } from '@/data/nsi-pratique-2026/types';
import { computeStats, getRecommendedNextAction } from './recommendations';

export interface NsiPreparationSummary {
  globalRate: number; // 0-100
  readinessLevel: 'ready' | 'almost' | 'consolidate';
  readinessLabel: string;
  subjectsMastered: number;
  subjectsTotal: number;
  subjectsToReview: string[];
  subjectsNotStarted: string[];
  patternsMastered: number;
  patternsTotal: number;
  mockExamsCount: number;
  oralQuestionsWorked: number;
  estimatedMinutesRemaining: number;
  lastActivity: string | null;
  recommendation: string | null;
  planProgress: { completed: number; total: number };
  assessmentProgress: { ok: number; total: number };
}

const READINESS_LABELS: Record<string, string> = {
  ready: 'Prêt pour l\'épreuve',
  almost: 'Presque prêt',
  consolidate: 'À consolider',
};

export function generateNsiPreparationSummary(
  progress: NsiProgress,
  subjects: NsiSubject[],
  _patterns: NsiPattern[]
): NsiPreparationSummary {
  const stats = computeStats(progress);
  const rec = getRecommendedNextAction(progress);

  const subjectsToReview: string[] = [];
  const subjectsNotStarted: string[] = [];

  for (const s of subjects) {
    const sp = progress.subjects[s.id];
    if (!sp || sp.status === 'not_started') {
      subjectsNotStarted.push(s.shortTitle);
    } else if (sp.status === 'needs_review') {
      subjectsToReview.push(s.shortTitle);
    }
  }

  const globalRate = stats.totalSubjects > 0
    ? Math.round((stats.subjectsMastered / stats.totalSubjects) * 100)
    : 0;

  return {
    globalRate,
    readinessLevel: stats.readinessLevel,
    readinessLabel: READINESS_LABELS[stats.readinessLevel] ?? 'À consolider',
    subjectsMastered: stats.subjectsMastered,
    subjectsTotal: stats.totalSubjects,
    subjectsToReview,
    subjectsNotStarted,
    patternsMastered: stats.patternsMastered,
    patternsTotal: stats.totalPatterns,
    mockExamsCount: stats.mockExamsCount,
    oralQuestionsWorked: stats.oralQuestionsWorked,
    estimatedMinutesRemaining: stats.estimatedMinutesRemaining,
    lastActivity: stats.lastWorkedSubjectId
      ? subjects.find(s => s.id === stats.lastWorkedSubjectId)?.shortTitle ?? null
      : null,
    recommendation: rec?.label ?? null,
    planProgress: { completed: stats.planCompleted, total: stats.planTotal },
    assessmentProgress: { ok: stats.assessmentOk, total: stats.assessmentTotal },
  };
}
