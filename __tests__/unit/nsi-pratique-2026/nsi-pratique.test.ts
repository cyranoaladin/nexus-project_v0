/**
 * Unit tests — NSI Pratique 2026 module
 *
 * Covers:
 *   - lib/nsi-pratique-2026/progress-storage.ts
 *   - lib/nsi-pratique-2026/recommendations.ts
 *   - data/nsi-pratique-2026/subjects.ts  (data integrity)
 *   - data/nsi-pratique-2026/patterns.ts  (data integrity)
 */

// ─── localStorage mock ───────────────────────────────────────────────────────

const localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: jest.fn((key: string) => localStorageStore[key] ?? null),
  setItem: jest.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: jest.fn((key: string) => { delete localStorageStore[key]; }),
  clear: jest.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Ensure `window` exists so the storage functions don't short-circuit
if (typeof global.window === 'undefined') {
  (global as any).window = global;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clearStorage() {
  localStorageMock.clear();
  jest.clearAllMocks();
  // Restore implementations after clearAllMocks
  localStorageMock.getItem.mockImplementation((key: string) => localStorageStore[key] ?? null);
  localStorageMock.setItem.mockImplementation((key: string, value: string) => { localStorageStore[key] = value; });
  localStorageMock.removeItem.mockImplementation((key: string) => { delete localStorageStore[key]; });
  localStorageMock.clear.mockImplementation(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); });
}

// ─── Imports ─────────────────────────────────────────────────────────────────

import {
  loadProgress,
  saveProgress,
  updateSubjectProgress,
  updatePatternProgress,
  updateFlashcardProgress,
  addMockExamResult,
  resetProgress,
  updateFiveDayTask,
  updateSelfAssessment,
  updateOralPhrases,
  exportProgress,
  importProgress,
} from '@/lib/nsi-pratique-2026/progress-storage';

import {
  computeStats,
  getRecommendedNextAction,
} from '@/lib/nsi-pratique-2026/recommendations';

import type { NsiProgress, MockExamResult } from '@/data/nsi-pratique-2026/types';

import { nsiSubjects } from '@/data/nsi-pratique-2026/subjects';
import { nsiPatterns } from '@/data/nsi-pratique-2026/patterns';
import { fiveDayPlan } from '@/data/nsi-pratique-2026/five-day-plan';
import { oralQuestions, selfAssessmentItems, oralFormulas, examDayReflexes } from '@/data/nsi-pratique-2026/oral-questions';
import { canAccessNsiFeature, canAccessSubject, NSI_FEATURES, FREE_SUBJECT_IDS } from '@/lib/nsi-pratique-2026/gating';
import { generateNsiPreparationSummary } from '@/lib/nsi-pratique-2026/preparation-summary';

// ═══════════════════════════════════════════════════════════════════════════
// progress-storage.ts
// ═══════════════════════════════════════════════════════════════════════════

describe('progress-storage — loadProgress', () => {
  beforeEach(clearStorage);

  it('returns default progress when localStorage is empty', () => {
    const progress = loadProgress();
    expect(progress.subjects).toEqual({});
    expect(progress.patterns).toEqual({});
    expect(progress.flashcards).toEqual({});
    expect(progress.fiveDayPlan).toEqual({});
    expect(progress.selfAssessment).toEqual({});
    expect(progress.mockExams).toEqual([]);
    expect(progress.oralPhrases).toEqual({});
  });

  it('returns default progress when stored JSON is malformed', () => {
    localStorageMock.getItem.mockReturnValueOnce('{ bad json {{');
    const progress = loadProgress();
    expect(progress.subjects).toEqual({});
    expect(progress.mockExams).toEqual([]);
  });

  it('merges stored data with default progress (missing keys filled in)', () => {
    // Simulate stored progress missing some top-level keys
    const partial = { _version: 1, subjects: { 1: { status: 'read', lastWorkedAt: '2026-05-01T10:00:00.000Z' } } };
    localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(partial));
    const progress = loadProgress();
    expect(progress.subjects[1].status).toBe('read');
    // Keys absent from stored data must still exist (defaults)
    expect(progress.mockExams).toEqual([]);
    expect(progress.patterns).toEqual({});
  });

  it('reads from the correct storage key "nsi-pratique-2026-progress"', () => {
    loadProgress();
    expect(localStorageMock.getItem).toHaveBeenCalledWith('nsi-pratique-2026-progress');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('progress-storage — updateSubjectProgress', () => {
  beforeEach(clearStorage);

  it('saves a new subject with the provided status', () => {
    const result = updateSubjectProgress(3, { status: 'coded' });
    expect(result.subjects[3].status).toBe('coded');
  });

  it('sets lastWorkedAt to an ISO string', () => {
    const before = Date.now();
    const result = updateSubjectProgress(5, { status: 'tested' });
    const after = Date.now();
    const ts = new Date(result.subjects[5].lastWorkedAt!).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('merges with existing subject progress without losing unrelated fields', () => {
    updateSubjectProgress(7, { status: 'read', oralExplained: true });
    const result = updateSubjectProgress(7, { status: 'coded' });
    expect(result.subjects[7].status).toBe('coded');
    expect(result.subjects[7].oralExplained).toBe(true);
  });

  it('defaults status to "not_started" if none provided', () => {
    const result = updateSubjectProgress(1, {});
    expect(result.subjects[1].status).toBe('not_started');
  });

  it('persists the update to localStorage', () => {
    updateSubjectProgress(2, { status: 'mastered' });
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'nsi-pratique-2026-progress',
      expect.stringContaining('"mastered"'),
    );
  });

  it('persists across subsequent loadProgress calls', () => {
    updateSubjectProgress(10, { status: 'explained' });
    const loaded = loadProgress();
    expect(loaded.subjects[10].status).toBe('explained');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('progress-storage — updatePatternProgress', () => {
  beforeEach(clearStorage);

  it('saves a new pattern with mastered=true', () => {
    const result = updatePatternProgress(1, { mastered: true });
    expect(result.patterns[1].mastered).toBe(true);
  });

  it('defaults mastered and writtenByHand to false when not provided', () => {
    const result = updatePatternProgress(2, {});
    expect(result.patterns[2].mastered).toBe(false);
    expect(result.patterns[2].writtenByHand).toBe(false);
  });

  it('sets lastPracticedAt to an ISO string', () => {
    const before = Date.now();
    const result = updatePatternProgress(3, { mastered: false });
    const after = Date.now();
    const ts = new Date(result.patterns[3].lastPracticedAt!).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('merges without losing writtenByHand flag', () => {
    updatePatternProgress(4, { writtenByHand: true });
    const result = updatePatternProgress(4, { mastered: true });
    expect(result.patterns[4].writtenByHand).toBe(true);
    expect(result.patterns[4].mastered).toBe(true);
  });

  it('persists across subsequent loadProgress calls', () => {
    updatePatternProgress(5, { mastered: true, writtenByHand: true });
    const loaded = loadProgress();
    expect(loaded.patterns[5].mastered).toBe(true);
    expect(loaded.patterns[5].writtenByHand).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('progress-storage — updateFlashcardProgress (Leitner)', () => {
  beforeEach(clearStorage);

  it('saves a flashcard with level 0 by default', () => {
    const result = updateFlashcardProgress('card-abc', {});
    expect(result.flashcards['card-abc'].level).toBe(0);
  });

  it('saves a flashcard with the provided Leitner level', () => {
    const result = updateFlashcardProgress('card-xyz', { level: 3 });
    expect(result.flashcards['card-xyz'].level).toBe(3);
  });

  it('updates the Leitner level from 1 to 4', () => {
    updateFlashcardProgress('card-1', { level: 1 });
    const result = updateFlashcardProgress('card-1', { level: 4 });
    expect(result.flashcards['card-1'].level).toBe(4);
  });

  it('sets lastReviewedAt to an ISO string', () => {
    const before = Date.now();
    const result = updateFlashcardProgress('card-2', { level: 2 });
    const after = Date.now();
    const ts = new Date(result.flashcards['card-2'].lastReviewedAt!).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('persists across subsequent loadProgress calls', () => {
    updateFlashcardProgress('card-persist', { level: 3 });
    const loaded = loadProgress();
    expect(loaded.flashcards['card-persist'].level).toBe(3);
  });

  it('handles multiple cards independently', () => {
    updateFlashcardProgress('card-A', { level: 1 });
    updateFlashcardProgress('card-B', { level: 4 });
    const loaded = loadProgress();
    expect(loaded.flashcards['card-A'].level).toBe(1);
    expect(loaded.flashcards['card-B'].level).toBe(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('progress-storage — addMockExamResult', () => {
  beforeEach(clearStorage);

  it('appends a mock exam result to an empty list', () => {
    const exam: MockExamResult = {
      subjectId: 7,
      date: '2026-05-10T14:00:00.000Z',
      completedSteps: ['read', 'coded'],
      selfScore: 4,
    };
    const result = addMockExamResult(exam);
    expect(result.mockExams).toHaveLength(1);
    expect(result.mockExams[0].subjectId).toBe(7);
    expect(result.mockExams[0].selfScore).toBe(4);
  });

  it('appends multiple results in order', () => {
    const exam1: MockExamResult = { subjectId: 1, date: '2026-05-01T10:00:00.000Z', completedSteps: [] };
    const exam2: MockExamResult = { subjectId: 2, date: '2026-05-02T10:00:00.000Z', completedSteps: ['coded'] };
    addMockExamResult(exam1);
    const result = addMockExamResult(exam2);
    expect(result.mockExams).toHaveLength(2);
    expect(result.mockExams[1].subjectId).toBe(2);
  });

  it('persists mock exam results across loadProgress calls', () => {
    const exam: MockExamResult = { subjectId: 15, date: '2026-05-15T09:00:00.000Z', completedSteps: ['read'] };
    addMockExamResult(exam);
    const loaded = loadProgress();
    expect(loaded.mockExams).toHaveLength(1);
    expect(loaded.mockExams[0].subjectId).toBe(15);
  });

  it('stores optional notes field', () => {
    const exam: MockExamResult = {
      subjectId: 3,
      date: '2026-05-12T08:00:00.000Z',
      completedSteps: ['coded', 'tested'],
      notes: 'Tricky edge case with empty list',
    };
    const result = addMockExamResult(exam);
    expect(result.mockExams[0].notes).toBe('Tricky edge case with empty list');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('progress-storage — resetProgress', () => {
  beforeEach(clearStorage);

  it('returns a fresh default progress object', () => {
    // Populate some data first
    updateSubjectProgress(1, { status: 'mastered' });
    updatePatternProgress(1, { mastered: true });
    addMockExamResult({ subjectId: 5, date: '2026-05-01T00:00:00.000Z', completedSteps: [] });

    const reset = resetProgress();
    expect(reset.subjects).toEqual({});
    expect(reset.patterns).toEqual({});
    expect(reset.mockExams).toEqual([]);
    expect(reset.flashcards).toEqual({});
  });

  it('persists the reset to localStorage', () => {
    updateSubjectProgress(1, { status: 'mastered' });
    resetProgress();
    const loaded = loadProgress();
    expect(loaded.subjects).toEqual({});
    expect(loaded.mockExams).toEqual([]);
  });

  it('writes the default progress to localStorage (not null)', () => {
    resetProgress();
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'nsi-pratique-2026-progress',
      expect.stringContaining('"subjects"'),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('progress-storage — updateFiveDayTask', () => {
  beforeEach(clearStorage);

  it('marks a task as completed', () => {
    const result = updateFiveDayTask('day1-matin-0', { completed: true });
    expect(result.fiveDayPlan['day1-matin-0'].completed).toBe(true);
  });

  it('defaults completed to false when not provided', () => {
    const result = updateFiveDayTask('day2-soir-1', {});
    expect(result.fiveDayPlan['day2-soir-1'].completed).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('progress-storage — updateSelfAssessment', () => {
  beforeEach(clearStorage);

  it('saves a self-assessment as ok', () => {
    const result = updateSelfAssessment('item-1', { status: 'ok' });
    expect(result.selfAssessment['item-1'].status).toBe('ok');
  });

  it('defaults status to "not_assessed" when not provided', () => {
    const result = updateSelfAssessment('item-2', {});
    expect(result.selfAssessment['item-2'].status).toBe('not_assessed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('progress-storage — updateOralPhrases', () => {
  beforeEach(clearStorage);

  it('saves oral phrases for a subject', () => {
    const result = updateOralPhrases(1, {
      contract: 'Je dois retourner...',
      strategy: 'Je parcours...',
      edgeCase: 'Si la liste est vide...',
      test: 'Je teste avec [1,1,2]...',
      markedAsExplained: true,
    });
    expect(result.oralPhrases[1].contract).toBe('Je dois retourner...');
    expect(result.oralPhrases[1].markedAsExplained).toBe(true);
  });

  it('defaults all string fields to empty strings', () => {
    const result = updateOralPhrases(2, {});
    expect(result.oralPhrases[2].contract).toBe('');
    expect(result.oralPhrases[2].strategy).toBe('');
    expect(result.oralPhrases[2].edgeCase).toBe('');
    expect(result.oralPhrases[2].test).toBe('');
    expect(result.oralPhrases[2].markedAsExplained).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// recommendations.ts — computeStats
// ═══════════════════════════════════════════════════════════════════════════

describe('computeStats — empty progress', () => {
  const emptyProgress: NsiProgress = {
    subjects: {},
    patterns: {},
    flashcards: {},
    fiveDayPlan: {},
    selfAssessment: {},
    mockExams: [],
    oralPhrases: {},
  };

  it('reports all 23 subjects as not started', () => {
    const stats = computeStats(emptyProgress);
    expect(stats.subjectsNotStarted).toBe(23);
    expect(stats.subjectsSeen).toBe(0);
    expect(stats.subjectsMastered).toBe(0);
    expect(stats.subjectsToReview).toBe(0);
  });

  it('reports 0 patterns mastered', () => {
    const stats = computeStats(emptyProgress);
    expect(stats.patternsMastered).toBe(0);
  });

  it('reports 0 oral questions worked', () => {
    const stats = computeStats(emptyProgress);
    expect(stats.oralQuestionsWorked).toBe(0);
  });

  it('reports 0 mock exams', () => {
    const stats = computeStats(emptyProgress);
    expect(stats.mockExamsCount).toBe(0);
  });

  it('estimates 23 × 30 = 690 minutes remaining', () => {
    const stats = computeStats(emptyProgress);
    expect(stats.estimatedMinutesRemaining).toBe(690);
  });

  it('sets readinessLevel to "consolidate"', () => {
    const stats = computeStats(emptyProgress);
    expect(stats.readinessLevel).toBe('consolidate');
  });

  it('reports lastWorkedSubjectId as null', () => {
    const stats = computeStats(emptyProgress);
    expect(stats.lastWorkedSubjectId).toBeNull();
  });

  it('uses default totalSubjects=23 and totalPatterns=8', () => {
    const stats = computeStats(emptyProgress);
    expect(stats.totalSubjects).toBe(23);
    expect(stats.totalPatterns).toBe(8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('computeStats — partial progress', () => {
  function makeProgress(overrides: Partial<NsiProgress> = {}): NsiProgress {
    return {
      subjects: {},
      patterns: {},
      flashcards: {},
      fiveDayPlan: {},
      selfAssessment: {},
      mockExams: [],
      oralPhrases: {},
      ...overrides,
    };
  }

  it('counts mastered subjects correctly', () => {
    const progress = makeProgress({
      subjects: {
        1: { status: 'mastered', lastWorkedAt: '2026-05-01T00:00:00.000Z' },
        2: { status: 'mastered', lastWorkedAt: '2026-05-02T00:00:00.000Z' },
        3: { status: 'coded', lastWorkedAt: '2026-05-03T00:00:00.000Z' },
      },
    });
    const stats = computeStats(progress);
    expect(stats.subjectsMastered).toBe(2);
    expect(stats.subjectsSeen).toBe(3);
    expect(stats.subjectsNotStarted).toBe(20);
  });

  it('counts subjects marked needs_review', () => {
    const progress = makeProgress({
      subjects: {
        5: { status: 'needs_review', lastWorkedAt: '2026-05-10T00:00:00.000Z' },
      },
    });
    const stats = computeStats(progress);
    expect(stats.subjectsToReview).toBe(1);
    expect(stats.statusCounts.needs_review).toBe(1);
  });

  it('counts mastered patterns', () => {
    const progress = makeProgress({
      patterns: {
        1: { mastered: true, writtenByHand: false },
        2: { mastered: true, writtenByHand: true },
        3: { mastered: false, writtenByHand: false },
      },
    });
    const stats = computeStats(progress);
    expect(stats.patternsMastered).toBe(2);
  });

  it('counts oral questions worked (flashcard level > 0)', () => {
    const progress = makeProgress({
      flashcards: {
        'q1': { level: 1, lastReviewedAt: '2026-05-01T00:00:00.000Z' },
        'q2': { level: 0, lastReviewedAt: '2026-05-01T00:00:00.000Z' },
        'q3': { level: 3, lastReviewedAt: '2026-05-01T00:00:00.000Z' },
      },
    });
    const stats = computeStats(progress);
    expect(stats.oralQuestionsWorked).toBe(2);
  });

  it('identifies the most recently worked subject', () => {
    const progress = makeProgress({
      subjects: {
        4: { status: 'coded', lastWorkedAt: '2026-05-10T08:00:00.000Z' },
        9: { status: 'tested', lastWorkedAt: '2026-05-14T20:00:00.000Z' },
        2: { status: 'read', lastWorkedAt: '2026-05-01T00:00:00.000Z' },
      },
    });
    const stats = computeStats(progress);
    expect(stats.lastWorkedSubjectId).toBe(9);
  });

  it('estimates remaining time based on non-mastered subjects', () => {
    // 3 mastered out of 23 → 20 remaining × 30 min
    const subjects: NsiProgress['subjects'] = {};
    for (let i = 1; i <= 3; i++) {
      subjects[i] = { status: 'mastered', lastWorkedAt: '2026-05-01T00:00:00.000Z' };
    }
    const progress = makeProgress({ subjects });
    const stats = computeStats(progress);
    expect(stats.estimatedMinutesRemaining).toBe(20 * 30);
  });

  it('counts plan tasks and completed tasks', () => {
    const progress = makeProgress({
      fiveDayPlan: {
        'task-1': { completed: true },
        'task-2': { completed: false },
        'task-3': { completed: true },
      },
    });
    const stats = computeStats(progress);
    expect(stats.planTotal).toBe(3);
    expect(stats.planCompleted).toBe(2);
  });

  it('counts self-assessment ok items', () => {
    const progress = makeProgress({
      selfAssessment: {
        'a': { status: 'ok' },
        'b': { status: 'needs_review' },
        'c': { status: 'ok' },
        'd': { status: 'not_assessed' },
      },
    });
    const stats = computeStats(progress);
    expect(stats.assessmentOk).toBe(2);
    expect(stats.assessmentTotal).toBe(4);
  });

  it('counts mock exams', () => {
    const progress = makeProgress({
      mockExams: [
        { subjectId: 1, date: '2026-05-01T00:00:00.000Z', completedSteps: [] },
        { subjectId: 2, date: '2026-05-05T00:00:00.000Z', completedSteps: [] },
      ],
    });
    const stats = computeStats(progress);
    expect(stats.mockExamsCount).toBe(2);
  });

  it('uses custom totalSubjects / totalPatterns arguments', () => {
    const progress = makeProgress();
    const stats = computeStats(progress, 10, 4);
    expect(stats.totalSubjects).toBe(10);
    expect(stats.totalPatterns).toBe(4);
    expect(stats.subjectsNotStarted).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('computeStats — readinessLevel thresholds', () => {
  function makeProgress(overrides: Partial<NsiProgress> = {}): NsiProgress {
    return {
      subjects: {},
      patterns: {},
      flashcards: {},
      fiveDayPlan: {},
      selfAssessment: {},
      mockExams: [],
      oralPhrases: {},
      ...overrides,
    };
  }

  function buildMasteredSubjects(count: number): NsiProgress['subjects'] {
    const subjects: NsiProgress['subjects'] = {};
    for (let i = 1; i <= count; i++) {
      subjects[i] = { status: 'mastered', lastWorkedAt: '2026-05-01T00:00:00.000Z' };
    }
    return subjects;
  }

  function buildMasteredPatterns(count: number): NsiProgress['patterns'] {
    const patterns: NsiProgress['patterns'] = {};
    for (let i = 1; i <= count; i++) {
      patterns[i] = { mastered: true, writtenByHand: false };
    }
    return patterns;
  }

  function buildOkAssessments(count: number): NsiProgress['selfAssessment'] {
    const selfAssessment: NsiProgress['selfAssessment'] = {};
    for (let i = 0; i < count; i++) {
      selfAssessment[`item-${i}`] = { status: 'ok' };
    }
    return selfAssessment;
  }

  it('returns "consolidate" when below both thresholds', () => {
    const progress = makeProgress({
      subjects: buildMasteredSubjects(5),
      patterns: buildMasteredPatterns(2),
    });
    const stats = computeStats(progress);
    expect(stats.readinessLevel).toBe('consolidate');
  });

  it('returns "almost" when >= 12 subjects mastered AND >= 5 patterns mastered', () => {
    const progress = makeProgress({
      subjects: buildMasteredSubjects(12),
      patterns: buildMasteredPatterns(5),
    });
    const stats = computeStats(progress);
    expect(stats.readinessLevel).toBe('almost');
  });

  it('stays "consolidate" when subjects >= 12 but patterns < 5', () => {
    const progress = makeProgress({
      subjects: buildMasteredSubjects(15),
      patterns: buildMasteredPatterns(4),
    });
    const stats = computeStats(progress);
    expect(stats.readinessLevel).toBe('consolidate');
  });

  it('stays "consolidate" when patterns >= 5 but subjects < 12', () => {
    const progress = makeProgress({
      subjects: buildMasteredSubjects(10),
      patterns: buildMasteredPatterns(6),
    });
    const stats = computeStats(progress);
    expect(stats.readinessLevel).toBe('consolidate');
  });

  it('returns "ready" when >= 20 subjects, >= 7 patterns, >= 6 ok assessments', () => {
    const progress = makeProgress({
      subjects: buildMasteredSubjects(20),
      patterns: buildMasteredPatterns(7),
      selfAssessment: buildOkAssessments(6),
    });
    const stats = computeStats(progress);
    expect(stats.readinessLevel).toBe('ready');
  });

  it('returns "almost" (not "ready") when 20+ subjects, 7+ patterns but < 6 ok assessments', () => {
    const progress = makeProgress({
      subjects: buildMasteredSubjects(20),
      patterns: buildMasteredPatterns(7),
      selfAssessment: buildOkAssessments(5),
    });
    const stats = computeStats(progress);
    expect(stats.readinessLevel).toBe('almost');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// recommendations.ts — getRecommendedNextAction
// ═══════════════════════════════════════════════════════════════════════════

describe('getRecommendedNextAction — priority ordering', () => {
  function makeProgress(overrides: Partial<NsiProgress> = {}): NsiProgress {
    return {
      subjects: {},
      patterns: {},
      flashcards: {},
      fiveDayPlan: {},
      selfAssessment: {},
      mockExams: [],
      oralPhrases: {},
      ...overrides,
    };
  }

  it('recommends the lowest-id "needs_review" subject first (priority 1)', () => {
    const progress = makeProgress({
      subjects: {
        3: { status: 'needs_review', lastWorkedAt: '2026-05-10T00:00:00.000Z' },
        1: { status: 'mastered', lastWorkedAt: '2026-05-01T00:00:00.000Z' },
      },
    });
    const rec = getRecommendedNextAction(progress);
    expect(rec).not.toBeNull();
    expect(rec!.type).toBe('subject');
    expect(rec!.priority).toBe(1);
    expect(rec!.subjectId).toBe(3);
    expect(rec!.label).toMatch(/revoir/i);
  });

  it('recommends a not-started subject when no needs_review exists (priority 2)', () => {
    // All subjects are mastered except subject 5 which is not in progress (not started)
    const subjects: NsiProgress['subjects'] = {};
    for (let i = 1; i <= 23; i++) {
      if (i !== 5) subjects[i] = { status: 'mastered', lastWorkedAt: '2026-05-01T00:00:00.000Z' };
    }
    // Subject 5 is missing → treated as not_started
    const progress = makeProgress({ subjects });
    const rec = getRecommendedNextAction(progress);
    expect(rec).not.toBeNull();
    expect(rec!.type).toBe('subject');
    expect(rec!.priority).toBe(2);
    expect(rec!.subjectId).toBe(5);
    expect(rec!.label).toMatch(/commencer/i);
  });

  it('recommends a not-started subject even when status is explicitly not_started', () => {
    const subjects: NsiProgress['subjects'] = {};
    for (let i = 1; i <= 23; i++) {
      subjects[i] = { status: i === 1 ? 'not_started' : 'mastered', lastWorkedAt: '2026-05-01T00:00:00.000Z' };
    }
    const progress = makeProgress({ subjects });
    const rec = getRecommendedNextAction(progress);
    expect(rec!.priority).toBe(2);
    expect(rec!.subjectId).toBe(1);
  });

  it('needs_review takes priority over not_started', () => {
    const subjects: NsiProgress['subjects'] = {};
    // Subject 1 is not started, subject 2 needs review
    subjects[2] = { status: 'needs_review', lastWorkedAt: '2026-05-10T00:00:00.000Z' };
    for (let i = 3; i <= 23; i++) {
      subjects[i] = { status: 'mastered', lastWorkedAt: '2026-05-01T00:00:00.000Z' };
    }
    const progress = makeProgress({ subjects });
    const rec = getRecommendedNextAction(progress);
    expect(rec!.priority).toBe(1);
    expect(rec!.type).toBe('subject');
    expect(rec!.subjectId).toBe(2);
  });

  it('recommends an unmastered pattern when all subjects are done (priority 3)', () => {
    const subjects: NsiProgress['subjects'] = {};
    for (let i = 1; i <= 23; i++) {
      subjects[i] = { status: 'mastered', lastWorkedAt: '2026-05-01T00:00:00.000Z' };
    }
    // Pattern 1 not mastered, patterns 2+ also not present
    const progress = makeProgress({ subjects });
    const rec = getRecommendedNextAction(progress);
    expect(rec).not.toBeNull();
    expect(rec!.type).toBe('pattern');
    expect(rec!.priority).toBe(3);
    expect(rec!.patternId).toBe(1);
    expect(rec!.label).toMatch(/patron/i);
  });

  it('recommends a mock exam when all subjects and patterns are done (priority 4)', () => {
    const subjects: NsiProgress['subjects'] = {};
    for (let i = 1; i <= 23; i++) {
      subjects[i] = { status: 'mastered', lastWorkedAt: '2026-05-01T00:00:00.000Z' };
    }
    const patterns: NsiProgress['patterns'] = {};
    for (let i = 1; i <= 8; i++) {
      patterns[i] = { mastered: true, writtenByHand: true };
    }
    const progress = makeProgress({ subjects, patterns });
    const rec = getRecommendedNextAction(progress);
    expect(rec).not.toBeNull();
    expect(rec!.type).toBe('mock');
    expect(rec!.priority).toBe(4);
    expect(rec!.label).toMatch(/blanc/i);
  });

  it('returns null-safe result — always returns a Recommendation (never null) for any input', () => {
    // Even empty progress should yield a recommendation
    const rec = getRecommendedNextAction(makeProgress());
    expect(rec).not.toBeNull();
  });

  it('respects custom totalSubjects and totalPatterns arguments', () => {
    const subjects: NsiProgress['subjects'] = {};
    subjects[1] = { status: 'mastered', lastWorkedAt: '2026-05-01T00:00:00.000Z' };
    subjects[2] = { status: 'mastered', lastWorkedAt: '2026-05-01T00:00:00.000Z' };
    const patterns: NsiProgress['patterns'] = {};
    patterns[1] = { mastered: true, writtenByHand: false };
    // With totalSubjects=2, totalPatterns=1, everything is done → mock
    const progress = makeProgress({ subjects, patterns });
    const rec = getRecommendedNextAction(progress, 2, 1);
    expect(rec!.type).toBe('mock');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Data integrity — subjects.ts
// ═══════════════════════════════════════════════════════════════════════════

describe('data integrity — nsiSubjects', () => {
  it('exports exactly 23 subjects', () => {
    expect(nsiSubjects).toHaveLength(23);
  });

  it('has unique IDs from 1 to 23', () => {
    const ids = nsiSubjects.map(s => s.id).sort((a, b) => a - b);
    expect(ids).toEqual(Array.from({ length: 23 }, (_, i) => i + 1));
  });

  it('every subject has a non-empty slug', () => {
    for (const subject of nsiSubjects) {
      expect(typeof subject.slug).toBe('string');
      expect(subject.slug.length).toBeGreaterThan(0);
    }
  });

  it('every subject has a non-empty title', () => {
    for (const subject of nsiSubjects) {
      expect(typeof subject.title).toBe('string');
      expect(subject.title.length).toBeGreaterThan(0);
    }
  });

  it('every subject has a non-empty shortTitle', () => {
    for (const subject of nsiSubjects) {
      expect(typeof subject.shortTitle).toBe('string');
      expect(subject.shortTitle.length).toBeGreaterThan(0);
    }
  });

  it('every subject has a valid difficulty value', () => {
    const validDifficulties = ['facile', 'moyen', 'difficile', 'expert'];
    for (const subject of nsiSubjects) {
      expect(validDifficulties).toContain(subject.difficulty);
    }
  });

  it('every subject has a positive estimatedTimeMinutes', () => {
    for (const subject of nsiSubjects) {
      expect(subject.estimatedTimeMinutes).toBeGreaterThan(0);
    }
  });

  it('every subject has a positive examTimeMinutes', () => {
    for (const subject of nsiSubjects) {
      expect(subject.examTimeMinutes).toBeGreaterThan(0);
    }
  });

  it('every subject has at least one concept', () => {
    for (const subject of nsiSubjects) {
      expect(Array.isArray(subject.concepts)).toBe(true);
      expect(subject.concepts.length).toBeGreaterThan(0);
    }
  });

  it('every subject has a non-empty mnemonic', () => {
    for (const subject of nsiSubjects) {
      expect(typeof subject.mnemonic).toBe('string');
      expect(subject.mnemonic.length).toBeGreaterThan(0);
    }
  });

  it('every subject has at least one verbalAlgorithm step', () => {
    for (const subject of nsiSubjects) {
      expect(Array.isArray(subject.verbalAlgorithm)).toBe(true);
      expect(subject.verbalAlgorithm.length).toBeGreaterThan(0);
    }
  });

  it('every subject has at least one examinerQuestion with non-empty fields', () => {
    for (const subject of nsiSubjects) {
      expect(Array.isArray(subject.examinerQuestions)).toBe(true);
      expect(subject.examinerQuestions.length).toBeGreaterThan(0);
      for (const q of subject.examinerQuestions) {
        expect(q.question.length).toBeGreaterThan(0);
        expect(q.expectedAnswer.length).toBeGreaterThan(0);
      }
    }
  });

  it('every subject has at least one trainingTask with required fields', () => {
    const validTaskTypes = ['code', 'oral', 'quiz', 'memory', 'debug'];
    for (const subject of nsiSubjects) {
      expect(Array.isArray(subject.trainingTasks)).toBe(true);
      expect(subject.trainingTasks.length).toBeGreaterThan(0);
      for (const task of subject.trainingTasks) {
        expect(validTaskTypes).toContain(task.type);
        expect(task.prompt.length).toBeGreaterThan(0);
        expect(Array.isArray(task.expectedElements)).toBe(true);
      }
    }
  });

  it('every subject has a non-empty revisionProtocol', () => {
    for (const subject of nsiSubjects) {
      expect(typeof subject.revisionProtocol).toBe('string');
      expect(subject.revisionProtocol.length).toBeGreaterThan(0);
    }
  });

  it('every subject has a patterns array (may be empty)', () => {
    for (const subject of nsiSubjects) {
      expect(Array.isArray(subject.patterns)).toBe(true);
    }
  });

  it('all pattern IDs referenced by subjects exist in nsiPatterns', () => {
    const patternIds = new Set(nsiPatterns.map(p => p.id));
    for (const subject of nsiSubjects) {
      for (const pid of subject.patterns) {
        expect(patternIds.has(pid)).toBe(true);
      }
    }
  });

  it('slugs are unique across all subjects', () => {
    const slugs = nsiSubjects.map(s => s.slug);
    const uniqueSlugs = new Set(slugs);
    expect(uniqueSlugs.size).toBe(slugs.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Data integrity — patterns.ts
// ═══════════════════════════════════════════════════════════════════════════

describe('data integrity — nsiPatterns', () => {
  it('exports exactly 8 patterns', () => {
    expect(nsiPatterns).toHaveLength(8);
  });

  it('has unique IDs from 1 to 8', () => {
    const ids = nsiPatterns.map(p => p.id).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('every pattern has a non-empty title', () => {
    for (const pattern of nsiPatterns) {
      expect(typeof pattern.title).toBe('string');
      expect(pattern.title.length).toBeGreaterThan(0);
    }
  });

  it('every pattern has a non-empty whenToUse field', () => {
    for (const pattern of nsiPatterns) {
      expect(typeof pattern.whenToUse).toBe('string');
      expect(pattern.whenToUse.length).toBeGreaterThan(0);
    }
  });

  it('every pattern has a non-empty mnemonic', () => {
    for (const pattern of nsiPatterns) {
      expect(typeof pattern.mnemonic).toBe('string');
      expect(pattern.mnemonic.length).toBeGreaterThan(0);
    }
  });

  it('every pattern has a non-empty code snippet', () => {
    for (const pattern of nsiPatterns) {
      expect(typeof pattern.code).toBe('string');
      expect(pattern.code.length).toBeGreaterThan(0);
    }
  });

  it('every pattern has at least one related subject', () => {
    for (const pattern of nsiPatterns) {
      expect(Array.isArray(pattern.relatedSubjects)).toBe(true);
      expect(pattern.relatedSubjects.length).toBeGreaterThan(0);
    }
  });

  it('all relatedSubjects IDs are valid (1–23)', () => {
    for (const pattern of nsiPatterns) {
      for (const sid of pattern.relatedSubjects) {
        expect(sid).toBeGreaterThanOrEqual(1);
        expect(sid).toBeLessThanOrEqual(23);
      }
    }
  });

  it('every pattern has a traps array (may be empty)', () => {
    for (const pattern of nsiPatterns) {
      expect(Array.isArray(pattern.traps)).toBe(true);
    }
  });

  it('cross-reference: patterns referenced in subjects also appear in nsiPatterns', () => {
    const patternIds = new Set(nsiPatterns.map(p => p.id));
    for (const subject of nsiSubjects) {
      for (const pid of subject.patterns) {
        expect(patternIds.has(pid)).toBe(true);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Five-day plan data integrity
// ═══════════════════════════════════════════════════════════════════════════

describe('data integrity — fiveDayPlan', () => {
  it('has exactly 5 days', () => {
    expect(fiveDayPlan).toHaveLength(5);
  });

  it('all subject references exist in nsiSubjects', () => {
    const subjectIds = new Set(nsiSubjects.map(s => s.id));
    for (const day of fiveDayPlan) {
      for (const slot of day.slots) {
        for (const task of slot.tasks) {
          if (task.subjectIds) {
            for (const sid of task.subjectIds) {
              expect(subjectIds.has(sid)).toBe(true);
            }
          }
        }
      }
    }
  });

  it('all 23 subjects are referenced at least once', () => {
    const referenced = new Set<number>();
    for (const day of fiveDayPlan) {
      for (const slot of day.slots) {
        for (const task of slot.tasks) {
          if (task.subjectIds) {
            task.subjectIds.forEach(id => referenced.add(id));
          }
        }
      }
    }
    for (let id = 1; id <= 23; id++) {
      expect(referenced.has(id)).toBe(true);
    }
  });

  it('mock exam is present on J-1', () => {
    const lastDay = fiveDayPlan[fiveDayPlan.length - 1];
    const hasMock = lastDay.slots.some(slot =>
      slot.tasks.some(task => task.type === 'mock')
    );
    expect(hasMock).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Oral questions & self-assessment data integrity
// ═══════════════════════════════════════════════════════════════════════════

describe('data integrity — oralQuestions', () => {
  it('has at least 10 questions', () => {
    expect(oralQuestions.length).toBeGreaterThanOrEqual(10);
  });

  it('all questions have unique IDs', () => {
    const ids = oralQuestions.map(q => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every question has non-empty question and answer', () => {
    for (const q of oralQuestions) {
      expect(q.question.length).toBeGreaterThan(0);
      expect(q.answer.length).toBeGreaterThan(0);
    }
  });
});

describe('data integrity — selfAssessmentItems', () => {
  it('has exactly 8 competencies', () => {
    expect(selfAssessmentItems).toHaveLength(8);
  });

  it('includes all required competency IDs', () => {
    const ids = selfAssessmentItems.map(i => i.id);
    const required = [
      'read-signature', 'write-assertions', 'explain-correction',
      'handle-data', 'fix-classic-bugs', 'ask-for-help',
      'test-before-finish', 'manage-time',
    ];
    for (const r of required) {
      expect(ids).toContain(r);
    }
  });
});

describe('data integrity — oralFormulas & examDayReflexes', () => {
  it('has 8 oral formulas', () => {
    expect(oralFormulas).toHaveLength(8);
  });

  it('has 7 exam day reflexes', () => {
    expect(examDayReflexes).toHaveLength(7);
  });

  it('all formulas are non-empty strings', () => {
    for (const f of oralFormulas) {
      expect(typeof f).toBe('string');
      expect(f.length).toBeGreaterThan(10);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Subject-level detailed checks
// ═══════════════════════════════════════════════════════════════════════════

describe('data integrity — subject content completeness', () => {
  it('every subject has at least one examiner question', () => {
    for (const s of nsiSubjects) {
      expect(s.examinerQuestions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every subject has at least one common trap', () => {
    for (const s of nsiSubjects) {
      expect(s.commonTraps.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every subject has at least one training task', () => {
    for (const s of nsiSubjects) {
      expect(s.trainingTasks.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every subject has a non-empty verbal algorithm', () => {
    for (const s of nsiSubjects) {
      expect(s.verbalAlgorithm.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every subject has a non-empty revision protocol', () => {
    for (const s of nsiSubjects) {
      expect(s.revisionProtocol.length).toBeGreaterThan(0);
    }
  });

  it('bidirectional cross-reference: patterns.relatedSubjects ↔ subjects.patterns', () => {
    for (const pattern of nsiPatterns) {
      for (const sid of pattern.relatedSubjects) {
        const subject = nsiSubjects.find(s => s.id === sid);
        expect(subject).toBeDefined();
        expect(subject!.patterns).toContain(pattern.id);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Flashcard Leitner logic
// ═══════════════════════════════════════════════════════════════════════════

describe('flashcard Leitner logic', () => {
  beforeEach(clearStorage);

  it('correct answer increases level', () => {
    updateFlashcardProgress('card-1', { level: 1 });
    const p = loadProgress();
    expect(p.flashcards['card-1'].level).toBe(1);

    updateFlashcardProgress('card-1', { level: 2 });
    const p2 = loadProgress();
    expect(p2.flashcards['card-1'].level).toBe(2);
  });

  it('level never exceeds 4 when set correctly', () => {
    updateFlashcardProgress('card-1', { level: 4 });
    const p = loadProgress();
    expect(p.flashcards['card-1'].level).toBe(4);
  });

  it('wrong answer resets level to 0', () => {
    updateFlashcardProgress('card-1', { level: 3 });
    updateFlashcardProgress('card-1', { level: 0 });
    const p = loadProgress();
    expect(p.flashcards['card-1'].level).toBe(0);
  });

  it('each card has independent level tracking', () => {
    updateFlashcardProgress('card-a', { level: 4 });
    updateFlashcardProgress('card-b', { level: 1 });
    updateFlashcardProgress('card-c', { level: 0 });
    const p = loadProgress();
    expect(p.flashcards['card-a'].level).toBe(4);
    expect(p.flashcards['card-b'].level).toBe(1);
    expect(p.flashcards['card-c'].level).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Storage versioning & export/import
// ═══════════════════════════════════════════════════════════════════════════

describe('progress-storage — versioning', () => {
  beforeEach(clearStorage);

  it('saved data includes _version', () => {
    updateSubjectProgress(1, { status: 'read' });
    const raw = localStorage.getItem('nsi-pratique-2026-progress');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed._version).toBe(1);
  });

  it('resets progress when version is missing (legacy data)', () => {
    localStorage.setItem(
      'nsi-pratique-2026-progress',
      JSON.stringify({ subjects: { 1: { status: 'mastered' } } })
    );
    const p = loadProgress();
    // Legacy data had no _version → should reset
    expect(p.subjects).toEqual({});
  });
});

describe('progress-storage — export/import', () => {
  beforeEach(clearStorage);

  it('exportProgress returns valid JSON', () => {
    updateSubjectProgress(1, { status: 'coded' });
    const json = exportProgress();
    const parsed = JSON.parse(json);
    expect(parsed.subjects[1].status).toBe('coded');
  });

  it('importProgress restores data', () => {
    const data = {
      subjects: { 5: { status: 'mastered', lastWorkedAt: '2026-01-01' } },
      patterns: {},
      flashcards: {},
      fiveDayPlan: {},
      selfAssessment: {},
      mockExams: [],
      oralPhrases: {},
    };
    const result = importProgress(JSON.stringify(data));
    expect(result.subjects[5].status).toBe('mastered');
    // Verify persisted
    const loaded = loadProgress();
    expect(loaded.subjects[5].status).toBe('mastered');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Feature gating
// ═══════════════════════════════════════════════════════════════════════════

describe('gating — canAccessNsiFeature (gating disabled)', () => {
  it('returns true for all features when gating is off', () => {
    for (const f of NSI_FEATURES) {
      expect(canAccessNsiFeature(f.key, 'free')).toBe(true);
    }
  });

  it('returns true for unknown features when gating is off', () => {
    expect(canAccessNsiFeature('nonexistent', 'free')).toBe(true);
  });
});

describe('gating — canAccessSubject (gating disabled)', () => {
  it('returns true for all subjects when gating is off', () => {
    for (let id = 1; id <= 23; id++) {
      expect(canAccessSubject(id, 'free')).toBe(true);
    }
  });
});

describe('gating — NSI_FEATURES structure', () => {
  it('has 13 features across 3 tiers', () => {
    expect(NSI_FEATURES).toHaveLength(13);
    const tiers = NSI_FEATURES.map(f => f.tier);
    expect(tiers.filter(t => t === 'free')).toHaveLength(4);
    expect(tiers.filter(t => t === 'premium')).toHaveLength(6);
    expect(tiers.filter(t => t === 'masterium')).toHaveLength(3);
  });

  it('FREE_SUBJECT_IDS contains subjects 1, 2, 5', () => {
    expect([...FREE_SUBJECT_IDS]).toEqual([1, 2, 5]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Preparation summary
// ═══════════════════════════════════════════════════════════════════════════

describe('generateNsiPreparationSummary', () => {
  beforeEach(clearStorage);

  it('returns correct defaults for empty progress', () => {
    const progress = loadProgress();
    const summary = generateNsiPreparationSummary(progress, nsiSubjects, nsiPatterns);

    expect(summary.globalRate).toBe(0);
    expect(summary.readinessLevel).toBe('consolidate');
    expect(summary.readinessLabel).toBe('À consolider');
    expect(summary.subjectsMastered).toBe(0);
    expect(summary.subjectsTotal).toBe(23);
    expect(summary.subjectsNotStarted).toHaveLength(23);
    expect(summary.subjectsToReview).toHaveLength(0);
    expect(summary.patternsMastered).toBe(0);
    expect(summary.recommendation).toBeTruthy();
    expect(summary.lastActivity).toBeNull();
  });

  it('reflects mastered subjects', () => {
    for (let id = 1; id <= 20; id++) {
      updateSubjectProgress(id, { status: 'mastered' });
    }
    for (let id = 1; id <= 7; id++) {
      updatePatternProgress(id, { mastered: true });
    }
    const progress = loadProgress();
    const summary = generateNsiPreparationSummary(progress, nsiSubjects, nsiPatterns);

    expect(summary.globalRate).toBe(Math.round((20 / 23) * 100));
    expect(summary.subjectsMastered).toBe(20);
    expect(summary.subjectsNotStarted).toHaveLength(3);
    expect(summary.patternsMastered).toBe(7);
    expect(summary.readinessLevel).toBe('almost');
  });

  it('shows last activity correctly', () => {
    updateSubjectProgress(5, { status: 'coded' });
    const progress = loadProgress();
    const summary = generateNsiPreparationSummary(progress, nsiSubjects, nsiPatterns);
    expect(summary.lastActivity).toBe(nsiSubjects.find(s => s.id === 5)!.shortTitle);
  });
});
