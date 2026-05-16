import {
  hasMeaningfulProgress,
  isServerProgressEmpty,
  sanitizeNsiProgressPayload,
  mergeNsiProgress,
} from '@/lib/nsi-pratique-2026/progress-merge';
import type { NsiProgress } from '@/data/nsi-pratique-2026/types';

const emptyProgress: NsiProgress = {
  subjects: {},
  patterns: {},
  flashcards: {},
  fiveDayPlan: {},
  selfAssessment: {},
  mockExams: [],
  oralPhrases: {},
};

describe('hasMeaningfulProgress', () => {
  it('returns false for null', () => {
    expect(hasMeaningfulProgress(null)).toBe(false);
  });

  it('returns false for empty progress', () => {
    expect(hasMeaningfulProgress(emptyProgress)).toBe(false);
  });

  it('returns true when subjects exist', () => {
    expect(hasMeaningfulProgress({ ...emptyProgress, subjects: { 1: { status: 'read', lastWorkedAt: '' } } })).toBe(true);
  });

  it('returns true when mockExams exist', () => {
    expect(hasMeaningfulProgress({ ...emptyProgress, mockExams: [{ subjectId: 1, date: '2026-05-16', completedSteps: ['step1'] }] })).toBe(true);
  });
});

describe('isServerProgressEmpty', () => {
  it('returns true for null', () => {
    expect(isServerProgressEmpty(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(isServerProgressEmpty(undefined)).toBe(true);
  });

  it('returns false for an object', () => {
    expect(isServerProgressEmpty({})).toBe(false);
  });
});

describe('sanitizeNsiProgressPayload', () => {
  it('returns null for non-object', () => {
    expect(sanitizeNsiProgressPayload(null)).toBeNull();
    expect(sanitizeNsiProgressPayload('string')).toBeNull();
    expect(sanitizeNsiProgressPayload([1, 2])).toBeNull();
  });

  it('returns null if forbidden key present', () => {
    expect(sanitizeNsiProgressPayload({ subjects: {}, userId: 'x' })).toBeNull();
    expect(sanitizeNsiProgressPayload({ subjects: {}, password: 'x' })).toBeNull();
    expect(sanitizeNsiProgressPayload({ subjects: {}, token: 'x' })).toBeNull();
    expect(sanitizeNsiProgressPayload({ subjects: {}, email: 'x' })).toBeNull();
  });

  it('strips unknown keys', () => {
    const result = sanitizeNsiProgressPayload({
      subjects: { 1: { status: 'mastered' } },
      unknownKey: 'should be stripped',
      anotherOne: 123,
    });
    expect(result).not.toBeNull();
    expect(result!.subjects).toEqual({ 1: { status: 'mastered' } });
    expect((result as unknown as Record<string, unknown>)['unknownKey']).toBeUndefined();
  });

  it('returns sanitized progress for valid input', () => {
    const input = {
      subjects: { 1: { status: 'mastered' } },
      patterns: {},
      flashcards: {},
      fiveDayPlan: {},
      selfAssessment: {},
      mockExams: [],
      oralPhrases: {},
    };
    const result = sanitizeNsiProgressPayload(input);
    expect(result).toEqual(input);
  });
});

describe('mergeNsiProgress', () => {
  it('merges subjects by timestamp — most recent wins', () => {
    const local: NsiProgress = {
      ...emptyProgress,
      subjects: {
        1: { status: 'mastered', lastWorkedAt: '2026-05-16T10:00:00Z' },
        2: { status: 'read', lastWorkedAt: '2026-05-15T08:00:00Z' },
      },
    };
    const server: NsiProgress = {
      ...emptyProgress,
      subjects: {
        1: { status: 'read', lastWorkedAt: '2026-05-14T10:00:00Z' },
        3: { status: 'mastered', lastWorkedAt: '2026-05-16T09:00:00Z' },
      },
    };

    const result = mergeNsiProgress(local, server);

    // Subject 1: local is newer → local wins
    expect(result.subjects[1].status).toBe('mastered');
    // Subject 2: only in local → kept
    expect(result.subjects[2].status).toBe('read');
    // Subject 3: only in server → kept
    expect(result.subjects[3].status).toBe('mastered');
  });

  it('merges fiveDayPlan — completed beats not completed', () => {
    const local: NsiProgress = {
      ...emptyProgress,
      fiveDayPlan: {
        'day1-task1': { completed: true },
        'day2-task1': { completed: false },
      },
    };
    const server: NsiProgress = {
      ...emptyProgress,
      fiveDayPlan: {
        'day1-task1': { completed: false },
        'day3-task1': { completed: true },
      },
    };

    const result = mergeNsiProgress(local, server);

    expect(result.fiveDayPlan['day1-task1'].completed).toBe(true); // local wins (completed)
    expect(result.fiveDayPlan['day2-task1'].completed).toBe(false); // only in local
    expect(result.fiveDayPlan['day3-task1'].completed).toBe(true); // only in server
  });

  it('merges mockExams — union with deduplication', () => {
    const local: NsiProgress = {
      ...emptyProgress,
      mockExams: [
        { subjectId: 1, date: '2026-05-15', completedSteps: ['step1'] },
        { subjectId: 2, date: '2026-05-16', completedSteps: ['step2'] },
      ],
    };
    const server: NsiProgress = {
      ...emptyProgress,
      mockExams: [
        { subjectId: 1, date: '2026-05-15', completedSteps: ['step1'] },
        { subjectId: 3, date: '2026-05-16', completedSteps: ['step3'] },
      ],
    };

    const result = mergeNsiProgress(local, server);

    // Should have 3 unique exams
    expect(result.mockExams).toHaveLength(3);
  });

  it('merges oralPhrases — entry with more content wins', () => {
    const local: NsiProgress = {
      ...emptyProgress,
      oralPhrases: {
        1: { contract: 'Mon contrat', strategy: 'Ma stratégie', edgeCase: '', test: '', markedAsExplained: false },
      },
    };
    const server: NsiProgress = {
      ...emptyProgress,
      oralPhrases: {
        1: { contract: '', strategy: '', edgeCase: '', test: '', markedAsExplained: false },
      },
    };

    const result = mergeNsiProgress(local, server);
    expect(result.oralPhrases[1].contract).toBe('Mon contrat'); // local has more content
  });

  it('does not lose local-only data', () => {
    const local: NsiProgress = {
      ...emptyProgress,
      patterns: { 5: { mastered: true, writtenByHand: true, lastPracticedAt: '2026-05-16T10:00:00Z' } },
    };
    const server: NsiProgress = emptyProgress;

    const result = mergeNsiProgress(local, server);
    expect(result.patterns[5].mastered).toBe(true);
  });
});
