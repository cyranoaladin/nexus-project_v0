import {
  getEafCoachReportCompletion,
  isEafCoachReportComplete,
  isStudentBilanComplete,
} from '@/lib/reports/stage/completeness';

describe('stage report completeness', () => {
  it('computes EAF coach report completion from required fields', () => {
    const completion = getEafCoachReportCompletion({
      writingMethod: 'Méthode solide',
      languageMastery: 'Syntaxe à consolider',
      literaryCulture: 'Références présentes',
    });

    expect(completion.isComplete).toBe(false);
    expect(completion.completionRatio).toBe(43);
    expect(completion.missingFields).toContain('strengths');
  });

  it('requires VALIDATED status and all required EAF fields', () => {
    const report = {
      status: 'VALIDATED',
      writingMethod: 'ok',
      languageMastery: 'ok',
      literaryCulture: 'ok',
      strengths: 'ok',
      areasToImprove: 'ok',
      nextSessionGoals: 'ok',
      coachFreeComment: 'ok',
    };

    expect(isEafCoachReportComplete(report as any)).toBe(true);
    expect(isEafCoachReportComplete({ ...report, status: 'DRAFT' } as any)).toBe(false);
    expect(isEafCoachReportComplete({ ...report, strengths: '   ' } as any)).toBe(false);
  });

  it('requires a completed student stage-post bilan with expected EAF blocks', () => {
    const bilan = {
      type: 'STAGE_POST',
      status: 'COMPLETED',
      subject: 'FRANCAIS',
      sourceData: {
        answers: {
          profile: {},
          beforeStage: {},
          examMethod: {},
          commentary: {},
          dissertation: {},
          writing: {},
          support: {},
          finalReview: {},
        },
      },
    };

    expect(isStudentBilanComplete(bilan as any)).toBe(true);
    expect(isStudentBilanComplete({ ...bilan, status: 'PENDING' } as any)).toBe(false);
    expect(isStudentBilanComplete({ ...bilan, sourceData: { answers: { profile: {} } } } as any)).toBe(false);
  });
});
