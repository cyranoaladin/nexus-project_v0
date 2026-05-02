import type { Bilan, EafPreparationReport } from '@prisma/client';

export function isStudentBilanComplete(bilan: Bilan): boolean {
  if (bilan.type !== 'STAGE_POST') return false;

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

export function isEafCoachReportComplete(report: EafPreparationReport): boolean {
  if (report.status !== 'VALIDATED') return false;

  const requiredFields: (keyof EafPreparationReport)[] = [
    'writingMethod',
    'languageMastery',
    'literaryCulture',
    'strengths',
    'areasToImprove',
    'nextSessionGoals',
    'coachFreeComment',
  ];

  return requiredFields.every(field => !!report[field]);
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
