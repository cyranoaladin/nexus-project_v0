import { validateNsiProgressPayload } from '@/lib/nsi-pratique-2026/progress-validation';

describe('validateNsiProgressPayload', () => {
  it('rejects null', () => {
    const result = validateNsiProgressPayload(null);
    expect(result.valid).toBe(false);
  });

  it('rejects array', () => {
    const result = validateNsiProgressPayload([1, 2, 3]);
    expect(result.valid).toBe(false);
  });

  it('rejects string', () => {
    const result = validateNsiProgressPayload('hello');
    expect(result.valid).toBe(false);
  });

  it('rejects forbidden key: userId', () => {
    const result = validateNsiProgressPayload({ subjects: {}, userId: 'u1' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('userId');
  });

  it('rejects forbidden key: password', () => {
    const result = validateNsiProgressPayload({ subjects: {}, password: 'secret' });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('password');
  });

  it('rejects forbidden key: token', () => {
    const result = validateNsiProgressPayload({ subjects: {}, token: 'abc' });
    expect(result.valid).toBe(false);
  });

  it('rejects forbidden key: email', () => {
    const result = validateNsiProgressPayload({ subjects: {}, email: 'x@y.z' });
    expect(result.valid).toBe(false);
  });

  it('rejects unknown top-level keys', () => {
    const result = validateNsiProgressPayload({
      subjects: {},
      patterns: {},
      flashcards: {},
      fiveDayPlan: {},
      selfAssessment: {},
      mockExams: [],
      oralPhrases: {},
      randomStuff: 'should fail',
    });
    expect(result.valid).toBe(false);
  });

  it('rejects payload too large', () => {
    const bigData = { subjects: {} as Record<string, unknown> };
    for (let i = 0; i < 5000; i++) {
      bigData.subjects[i.toString()] = { status: 'mastered', lastWorkedAt: new Date().toISOString().repeat(10) };
    }
    const result = validateNsiProgressPayload(bigData);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('too large');
  });

  it('accepts valid empty progress', () => {
    const result = validateNsiProgressPayload({
      subjects: {},
      patterns: {},
      flashcards: {},
      fiveDayPlan: {},
      selfAssessment: {},
      mockExams: [],
      oralPhrases: {},
    });
    expect(result.valid).toBe(true);
  });

  it('accepts valid progress with data', () => {
    const result = validateNsiProgressPayload({
      subjects: { 1: { status: 'mastered', lastWorkedAt: '2026-05-16T10:00:00Z' } },
      patterns: { 2: { mastered: true, writtenByHand: false, lastPracticedAt: '2026-05-16T10:00:00Z' } },
      flashcards: {},
      fiveDayPlan: { 'day1-task1': { completed: true } },
      selfAssessment: {},
      mockExams: [{ subjectId: 1, date: '2026-05-16', duration: 45 }],
      oralPhrases: {},
    });
    expect(result.valid).toBe(true);
  });

  it('accepts minimal payload — defaults fill missing keys', () => {
    const result = validateNsiProgressPayload({
      subjects: { 1: { status: 'in_progress' } },
    });
    // strict() only rejects UNKNOWN keys, not missing ones (defaults apply)
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.patterns).toEqual({});
      expect(result.data.mockExams).toEqual([]);
    }
  });
});
