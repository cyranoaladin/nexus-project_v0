import type { NsiProgress, SubjectStatus } from '@/data/nsi-pratique-2026/types';

export interface Recommendation {
  type: 'subject' | 'pattern' | 'mock' | 'flashcard';
  label: string;
  subjectId?: number;
  patternId?: number;
  priority: number;
}

export function getRecommendedNextAction(
  progress: NsiProgress,
  totalSubjects: number = 23,
  totalPatterns: number = 8
): Recommendation | null {
  // Priority 1: Subject marked "needs_review"
  for (let id = 1; id <= totalSubjects; id++) {
    const s = progress.subjects[id];
    if (s?.status === 'needs_review') {
      return {
        type: 'subject',
        label: `Revoir le sujet ${id} (marqué "à revoir")`,
        subjectId: id,
        priority: 1,
      };
    }
  }

  // Priority 2: Subject not started
  for (let id = 1; id <= totalSubjects; id++) {
    const s = progress.subjects[id];
    if (!s || s.status === 'not_started') {
      return {
        type: 'subject',
        label: `Commencer le sujet ${id} (non commencé)`,
        subjectId: id,
        priority: 2,
      };
    }
  }

  // Priority 3: Pattern not mastered linked to multiple subjects
  for (let id = 1; id <= totalPatterns; id++) {
    const p = progress.patterns[id];
    if (!p || !p.mastered) {
      return {
        type: 'pattern',
        label: `Travailler le patron de code ${id}`,
        patternId: id,
        priority: 3,
      };
    }
  }

  // Priority 4: Random mock exam if everything is advanced
  return {
    type: 'mock',
    label: 'Lancer un sujet blanc aléatoire',
    priority: 4,
  };
}

export function computeStats(progress: NsiProgress, totalSubjects: number = 23, totalPatterns: number = 8) {
  let subjectsSeen = 0;
  let subjectsMastered = 0;
  let subjectsToReview = 0;
  let subjectsNotStarted = 0;

  const statusCounts: Record<SubjectStatus, number> = {
    not_started: 0,
    read: 0,
    coded: 0,
    tested: 0,
    explained: 0,
    mastered: 0,
    needs_review: 0,
  };

  for (let id = 1; id <= totalSubjects; id++) {
    const s = progress.subjects[id];
    if (!s || s.status === 'not_started') {
      subjectsNotStarted++;
      statusCounts.not_started++;
    } else {
      subjectsSeen++;
      statusCounts[s.status]++;
      if (s.status === 'mastered') subjectsMastered++;
      if (s.status === 'needs_review') subjectsToReview++;
    }
  }

  let patternsMastered = 0;
  for (let id = 1; id <= totalPatterns; id++) {
    if (progress.patterns[id]?.mastered) patternsMastered++;
  }

  let oralQuestionsWorked = 0;
  for (const fc of Object.values(progress.flashcards)) {
    if (fc.level > 0) oralQuestionsWorked++;
  }

  // Estimate remaining time: ~30 min per non-mastered subject
  const remainingSubjects = totalSubjects - subjectsMastered;
  const estimatedMinutesRemaining = remainingSubjects * 30;

  // Last worked subject
  let lastWorkedSubjectId: number | null = null;
  let lastWorkedDate: string | null = null;
  for (let id = 1; id <= totalSubjects; id++) {
    const s = progress.subjects[id];
    if (s?.lastWorkedAt) {
      if (!lastWorkedDate || s.lastWorkedAt > lastWorkedDate) {
        lastWorkedDate = s.lastWorkedAt;
        lastWorkedSubjectId = id;
      }
    }
  }

  // Five day plan completion
  const planTasks = Object.values(progress.fiveDayPlan);
  const planCompleted = planTasks.filter(t => t.completed).length;
  const planTotal = planTasks.length;

  // Self assessment score
  const assessmentEntries = Object.values(progress.selfAssessment);
  const assessmentOk = assessmentEntries.filter(a => a.status === 'ok').length;
  const assessmentTotal = assessmentEntries.length;

  let readinessLevel: 'ready' | 'almost' | 'consolidate' = 'consolidate';
  if (subjectsMastered >= 20 && patternsMastered >= 7 && assessmentOk >= 6) {
    readinessLevel = 'ready';
  } else if (subjectsMastered >= 12 && patternsMastered >= 5) {
    readinessLevel = 'almost';
  }

  return {
    subjectsSeen,
    subjectsMastered,
    subjectsToReview,
    subjectsNotStarted,
    statusCounts,
    patternsMastered,
    oralQuestionsWorked,
    estimatedMinutesRemaining,
    lastWorkedSubjectId,
    mockExamsCount: progress.mockExams.length,
    planCompleted,
    planTotal,
    assessmentOk,
    assessmentTotal,
    readinessLevel,
    totalSubjects,
    totalPatterns,
  };
}
