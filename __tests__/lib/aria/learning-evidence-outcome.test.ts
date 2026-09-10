import { AriaError } from '@/lib/aria/kernel/errors';
import { parseLearningEvidenceOutcome } from '@/lib/aria/domain/evidence/outcome';

describe('parseLearningEvidenceOutcome', () => {
  it('accepts a well-formed PRACTICE_ATTEMPT outcome', () => {
    expect(parseLearningEvidenceOutcome('PRACTICE_ATTEMPT', {
      outcome: 'CORRECT',
      activityAttemptId: 'attempt-1',
    })).toEqual({ outcome: 'CORRECT', activityAttemptId: 'attempt-1' });
  });

  it('accepts a well-formed ASSESSMENT_RESULT outcome', () => {
    expect(parseLearningEvidenceOutcome('ASSESSMENT_RESULT', {
      score: 8, maxScore: 10, assessmentAttemptId: 'assess-1',
    })).toEqual({ score: 8, maxScore: 10, assessmentAttemptId: 'assess-1' });
  });

  it('accepts a well-formed CONVERSATION_ASSESSMENT outcome', () => {
    expect(parseLearningEvidenceOutcome('CONVERSATION_ASSESSMENT', {
      assessment: 'DEVELOPING', turnId: 'turn-1',
    })).toEqual({ assessment: 'DEVELOPING', turnId: 'turn-1' });
  });

  it('accepts a well-formed CORRECTION_RESULT outcome', () => {
    expect(parseLearningEvidenceOutcome('CORRECTION_RESULT', {
      outcome: 'PARTIALLY_CORRECT', correctionId: 'corr-1', feedbackSummary: 'Bon raisonnement, erreur de signe.',
    })).toEqual({ outcome: 'PARTIALLY_CORRECT', correctionId: 'corr-1', feedbackSummary: 'Bon raisonnement, erreur de signe.' });
  });

  it('accepts a well-formed TEACHER_OBSERVATION outcome', () => {
    expect(parseLearningEvidenceOutcome('TEACHER_OBSERVATION', {
      note: 'Progrès net sur les suites.', observedByUserId: 'user-teacher-1',
    })).toEqual({ note: 'Progrès net sur les suites.', observedByUserId: 'user-teacher-1' });
  });

  it('accepts a well-formed COACH_FEEDBACK outcome', () => {
    expect(parseLearningEvidenceOutcome('COACH_FEEDBACK', {
      note: 'À revoir avant le prochain live.', observedByUserId: 'user-coach-1',
    })).toEqual({ note: 'À revoir avant le prochain live.', observedByUserId: 'user-coach-1' });
  });

  it('accepts a well-formed EXAM_SIMULATION outcome', () => {
    expect(parseLearningEvidenceOutcome('EXAM_SIMULATION', {
      score: 14, maxScore: 20, examSimulationId: 'exam-1',
    })).toEqual({ score: 14, maxScore: 20, examSimulationId: 'exam-1' });
  });

  it('fails closed on a malformed outcome for a valid source (wrong enum value)', () => {
    expect(() => parseLearningEvidenceOutcome('PRACTICE_ATTEMPT', {
      outcome: 'MAYBE', activityAttemptId: 'attempt-1',
    })).toThrow(AriaError);
  });

  it('fails closed on an outcome missing a required field', () => {
    expect(() => parseLearningEvidenceOutcome('ASSESSMENT_RESULT', {
      score: 8, maxScore: 10,
    })).toThrow(AriaError);
  });

  it('fails closed on an outcome carrying an unknown extra field (strict schemas)', () => {
    expect(() => parseLearningEvidenceOutcome('CONVERSATION_ASSESSMENT', {
      assessment: 'STRONG', turnId: 'turn-1', extra: 'not allowed',
    })).toThrow(AriaError);
  });

  it('fails closed on a source value impossible per types but reachable at runtime (e.g. a corrupted read)', () => {
    expect(() => parseLearningEvidenceOutcome(
      'NOT_A_REAL_SOURCE' as unknown as Parameters<typeof parseLearningEvidenceOutcome>[0],
      { anything: 'goes' },
    )).toThrow(AriaError);
  });

  it('never accepts free-form JSON — an empty object fails for every source', () => {
    const sources = [
      'PRACTICE_ATTEMPT', 'ASSESSMENT_RESULT', 'CONVERSATION_ASSESSMENT',
      'CORRECTION_RESULT', 'TEACHER_OBSERVATION', 'COACH_FEEDBACK', 'EXAM_SIMULATION',
    ] as const;
    for (const source of sources) {
      expect(() => parseLearningEvidenceOutcome(source, {})).toThrow(AriaError);
    }
  });
});
