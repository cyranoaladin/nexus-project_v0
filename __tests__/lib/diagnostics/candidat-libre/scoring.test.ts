jest.mock('server-only', () => ({}));

import { scoreDiagnosticModule } from '@/lib/diagnostics/candidat-libre/scoring.server';
import type { DiagnosticAnswer } from '@/lib/diagnostics/candidat-libre/types';

describe('candidate diagnostic scoring', () => {
  it('scores exact answers and excludes NOT_STUDIED from mastery denominator', () => {
    const answers: Record<string, DiagnosticAnswer> = {
      'math-01': { questionId: 'math-01', value: 'a', status: 'ANSWERED', confidence: 3 },
      'math-02': { questionId: 'math-02', value: 'a', status: 'ANSWERED', confidence: 3 },
      'math-03': { questionId: 'math-03', value: 'NOT_STUDIED', status: 'NOT_STUDIED', confidence: 0 },
    };
    const result = scoreDiagnosticModule('mathematiques', answers);
    expect(result.evidence.find((item) => item.questionId === 'math-01')?.status).toBe('CORRECT');
    expect(result.evidence.find((item) => item.questionId === 'math-02')?.status).toBe('INCORRECT');
    expect(result.evidence.find((item) => item.questionId === 'math-03')?.status).toBe('NOT_STUDIED');
    expect(result.coveragePercentage).toBeLessThan(100);
    expect(result.confidenceCalibration.overconfidenceCount).toBeGreaterThanOrEqual(1);
  });

  it('never exposes manual items as automatically correct', () => {
    const result = scoreDiagnosticModule('mathematiques', {
      'math-25': { questionId: 'math-25', value: 'Une démonstration rédigée.', status: 'ANSWERED', confidence: 3 },
    });
    expect(result.manualReviewQuestionIds).toContain('math-25');
    expect(result.evidence.find((item) => item.questionId === 'math-25')?.status).toBe('MANUAL_REVIEW');
  });
});
