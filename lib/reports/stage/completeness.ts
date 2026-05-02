type StageBilanLike = {
  type: string;
  status: string;
  subject: string;
  sourceData?: unknown;
};

type EafPreparationReportLike = {
  status?: string | null;
  writingMethod?: string | null;
  languageMastery?: string | null;
  literaryCulture?: string | null;
  strengths?: string | null;
  areasToImprove?: string | null;
  nextSessionGoals?: string | null;
  coachFreeComment?: string | null;
};

export const EAF_REQUIRED_COACH_FIELDS = [
  'writingMethod',
  'languageMastery',
  'literaryCulture',
  'strengths',
  'areasToImprove',
  'nextSessionGoals',
  'coachFreeComment',
] as const satisfies readonly (keyof EafPreparationReportLike)[];

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isStudentBilanComplete(bilan: StageBilanLike): boolean {
  if (bilan.type !== 'STAGE_POST') return false;
  if (bilan.status !== 'COMPLETED') return false;

  // For both EAF and Math, we can check that sourceData exists and has some data
  if (!bilan.sourceData || typeof bilan.sourceData !== 'object') return false;
  
  const answers = (bilan.sourceData as Record<string, any>).answers;
  if (!answers || typeof answers !== 'object') return false;

  if (bilan.subject === 'FRANCAIS') {
    // EAF specific blocks
    const requiredBlocks = ['profile', 'beforeStage', 'examMethod', 'commentary', 'dissertation', 'writing', 'support', 'finalReview'];
    return requiredBlocks.every(block => !!answers[block]);
  }

  if (bilan.subject === 'MATHEMATIQUES') {
    // Maths specific blocks
    const requiredBlocks = ['profile', 'beforeStage', 'automatismes', 'analysis', 'sequences', 'scalarProduct', 'probabilities', 'finalAssessment', 'finalReview'];
    return requiredBlocks.every(block => !!answers[block]);
  }

  return true;
}

export function getEafCoachReportCompletion(report: Partial<EafPreparationReportLike>): {
  completionRatio: number;
  missingFields: string[];
  isComplete: boolean;
} {
  const missingFields = EAF_REQUIRED_COACH_FIELDS.filter((field) => !hasText(report[field]));
  const completedCount = EAF_REQUIRED_COACH_FIELDS.length - missingFields.length;
  const completionRatio = Math.round((completedCount / EAF_REQUIRED_COACH_FIELDS.length) * 100);

  return {
    completionRatio,
    missingFields,
    isComplete: missingFields.length === 0,
  };
}

export function isEafCoachReportComplete(report: EafPreparationReportLike): boolean {
  return report.status === 'VALIDATED' && getEafCoachReportCompletion(report).isComplete;
}

export function isMathsCoachReportComplete(report: any): boolean {
  if (report.status !== 'VALIDATED') return false;

  const requiredFields = [
    'attendanceAndEngagement',
    'automatismes',
    'analysis',
    'sequences',
    'scalarProduct',
    'probabilities',
    'finalAssessment',
    'parentRecommendations',
  ];

  const sourceData = report.sourceData || {};
  return requiredFields.every(field => !!sourceData[field] && Object.keys(sourceData[field]).length > 0);
}
