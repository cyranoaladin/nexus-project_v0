import type { NsiProgress, SubjectProgress, PatternProgress, FlashcardProgress, SelfAssessmentProgress, MockExamResult, OralFourPhrases, FiveDayTaskProgress } from '@/data/nsi-pratique-2026/types';

const STORAGE_KEY = 'nsi-pratique-2026-progress';
const STORAGE_VERSION = 1;

function getDefaultProgress(): NsiProgress {
  return {
    subjects: {},
    patterns: {},
    flashcards: {},
    fiveDayPlan: {},
    selfAssessment: {},
    mockExams: [],
    oralPhrases: {},
  };
}

export function loadProgress(): NsiProgress {
  if (typeof window === 'undefined') return getDefaultProgress();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return getDefaultProgress();
    const parsed = JSON.parse(stored);
    // Version migration: reset if incompatible
    if (parsed._version !== STORAGE_VERSION) {
      const fresh = getDefaultProgress();
      saveProgress(fresh);
      return fresh;
    }
    return { ...getDefaultProgress(), ...parsed };
  } catch {
    return getDefaultProgress();
  }
}

export function saveProgress(progress: NsiProgress): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...progress, _version: STORAGE_VERSION }));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

/** Export progress as JSON string for backup */
export function exportProgress(): string {
  return JSON.stringify(loadProgress(), null, 2);
}

/** Import progress from JSON string */
export function importProgress(json: string): NsiProgress {
  const parsed = JSON.parse(json);
  const progress: NsiProgress = { ...getDefaultProgress(), ...parsed };
  saveProgress(progress);
  return progress;
}

export function updateSubjectProgress(
  subjectId: number,
  update: Partial<SubjectProgress>
): NsiProgress {
  const progress = loadProgress();
  const existing = progress.subjects[subjectId];
  const merged: SubjectProgress = Object.assign(
    { status: 'not_started' as const },
    existing,
    update,
    { lastWorkedAt: new Date().toISOString() },
  );
  progress.subjects[subjectId] = merged;
  saveProgress(progress);
  return progress;
}

export function updatePatternProgress(
  patternId: number,
  update: Partial<PatternProgress>
): NsiProgress {
  const progress = loadProgress();
  progress.patterns[patternId] = Object.assign(
    { mastered: false, writtenByHand: false },
    progress.patterns[patternId],
    update,
    { lastPracticedAt: new Date().toISOString() },
  );
  saveProgress(progress);
  return progress;
}

export function updateFlashcardProgress(
  cardId: string,
  update: Partial<FlashcardProgress>
): NsiProgress {
  const progress = loadProgress();
  progress.flashcards[cardId] = Object.assign(
    { level: 0 },
    progress.flashcards[cardId],
    update,
    { lastReviewedAt: new Date().toISOString() },
  );
  saveProgress(progress);
  return progress;
}

export function updateFiveDayTask(
  taskKey: string,
  update: Partial<FiveDayTaskProgress>
): NsiProgress {
  const progress = loadProgress();
  progress.fiveDayPlan[taskKey] = Object.assign(
    { completed: false },
    progress.fiveDayPlan[taskKey],
    update,
  );
  saveProgress(progress);
  return progress;
}

export function updateSelfAssessment(
  itemId: string,
  update: Partial<SelfAssessmentProgress>
): NsiProgress {
  const progress = loadProgress();
  progress.selfAssessment[itemId] = Object.assign(
    { status: 'not_assessed' as const },
    progress.selfAssessment[itemId],
    update,
  );
  saveProgress(progress);
  return progress;
}

export function addMockExamResult(result: MockExamResult): NsiProgress {
  const progress = loadProgress();
  progress.mockExams.push(result);
  saveProgress(progress);
  return progress;
}

export function updateOralPhrases(
  subjectId: number,
  update: Partial<OralFourPhrases>
): NsiProgress {
  const progress = loadProgress();
  progress.oralPhrases[subjectId] = Object.assign(
    { contract: '', strategy: '', edgeCase: '', test: '', markedAsExplained: false },
    progress.oralPhrases[subjectId],
    update,
  );
  saveProgress(progress);
  return progress;
}

export function resetProgress(): NsiProgress {
  const progress = getDefaultProgress();
  saveProgress(progress);
  return progress;
}
