import type { BilanDiagnosticMathsData } from '@/lib/validations';

/**
 * Scoring engine for the Bilan Diagnostic Pré-Stage Maths v1.3
 * Implements ReadinessScore, RiskIndex, Decision, and alert detection.
 */

interface DomainScore {
  domain: string;
  score: number;
  evaluatedCount: number;
  totalCount: number;
  gaps: string[];
  dominantErrors: string[];
  priority: 'high' | 'medium' | 'low';
}

interface ScoringAlert {
  type: 'danger' | 'warning' | 'info';
  code: string;
  message: string;
}

export interface ScoringResult {
  readinessScore: number;
  riskIndex: number;
  recommendation: 'Pallier2_confirmed' | 'Pallier2_conditional' | 'Pallier1_recommended';
  recommendationMessage: string;
  domainScores: DomainScore[];
  alerts: ScoringAlert[];
  dataQuality: {
    activeDomains: number;
    evaluatedCompetencies: number;
    lowConfidence: boolean;
  };
}

const DOMAIN_WEIGHTS: Record<string, number> = {
  analysis: 0.30,
  algebra: 0.25,
  geometry: 0.20,
  probabilities: 0.15,
  python: 0.10,
};

/**
 * Calculate the ReadinessScore from competency data.
 * For each active domain (≥2 evaluated competencies):
 *   Score_D = (mean(mastery) / 4) × 100
 * ReadinessScore = weighted average of active domain scores.
 */
function calculateReadinessScore(
  competencies: BilanDiagnosticMathsData['competencies']
): { score: number; domainScores: DomainScore[]; activeDomains: number; evaluatedTotal: number } {
  const domainScores: DomainScore[] = [];
  let weightedSum = 0;
  let weightSum = 0;
  let activeDomains = 0;
  let evaluatedTotal = 0;

  const domains = ['algebra', 'analysis', 'geometry', 'probabilities', 'python'] as const;

  for (const domain of domains) {
    const items = competencies[domain] || [];
    const evaluated = items.filter(
      (c) => c.status !== 'not_studied' && c.status !== 'unknown' && c.mastery !== null
    );
    const gaps = items
      .filter((c) => c.mastery !== null && c.mastery <= 1)
      .map((c) => c.skillLabel);
    const allErrors = items.flatMap((c) => c.errorTypes || []);
    const errorCounts: Record<string, number> = {};
    for (const e of allErrors) {
      errorCounts[e] = (errorCounts[e] || 0) + 1;
    }
    const dominantErrors = Object.entries(errorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([e]) => e);

    evaluatedTotal += evaluated.length;

    if (evaluated.length >= 2) {
      const meanMastery = evaluated.reduce((sum, c) => sum + (c.mastery ?? 0), 0) / evaluated.length;
      const domainScore = (meanMastery / 4) * 100;
      const weight = DOMAIN_WEIGHTS[domain] || 0.10;

      weightedSum += weight * domainScore;
      weightSum += weight;
      activeDomains++;

      const priority: 'high' | 'medium' | 'low' =
        domainScore < 50 ? 'high' : domainScore < 70 ? 'medium' : 'low';

      domainScores.push({
        domain,
        score: Math.round(domainScore),
        evaluatedCount: evaluated.length,
        totalCount: items.length,
        gaps,
        dominantErrors,
        priority,
      });
    } else {
      domainScores.push({
        domain,
        score: 0,
        evaluatedCount: evaluated.length,
        totalCount: items.length,
        gaps,
        dominantErrors,
        priority: 'high',
      });
    }
  }

  const readinessScore = weightSum > 0 ? Math.round(weightedSum / weightSum) : 0;

  return { score: readinessScore, domainScores, activeDomains, evaluatedTotal };
}

/**
 * Calculate the RiskIndex from exam preparation data.
 * Performance = 0.40 × (miniTest.score/6 × 100)
 *             + 0.20 × (completedInTime ? 100 : 40)
 *             + 0.25 × (mean(redaction, justifications)/4 × 100)
 *             + 0.15 × (stress/4 × 100)
 * RiskIndex = 100 - Performance
 */
function calculateRiskIndex(examPrep: BilanDiagnosticMathsData['examPrep']): number {
  const miniTestComponent = (examPrep.miniTest.score / 6) * 100;
  const timeComponent = examPrep.miniTest.completedInTime ? 100 : 40;
  const redactionMean =
    ((examPrep.selfRatings.redaction + examPrep.selfRatings.justifications) / 2 / 4) * 100;
  const stressComponent = (examPrep.selfRatings.stress / 4) * 100;

  const performance =
    0.40 * miniTestComponent +
    0.20 * timeComponent +
    0.25 * redactionMean +
    0.15 * stressComponent;

  return Math.round(100 - performance);
}

/**
 * Detect alerts based on the diagnostic data.
 */
function detectAlerts(data: BilanDiagnosticMathsData): ScoringAlert[] {
  const alerts: ScoringAlert[] = [];

  if (data.examPrep.selfRatings.stress >= 3) {
    alerts.push({
      type: 'warning',
      code: 'HIGH_STRESS',
      message: 'Gestion du stress à travailler (auto-évaluation ≥ 3/4)',
    });
  }

  if (data.examPrep.miniTest.score <= 2) {
    alerts.push({
      type: 'danger',
      code: 'WEAK_AUTOMATISMS',
      message: 'Automatismes très fragiles (mini-test ≤ 2/6)',
    });
  }

  if (data.examPrep.signals.feeling === 'panic') {
    alerts.push({
      type: 'danger',
      code: 'PANIC_SIGNAL',
      message: 'Signal de détresse — suivi prioritaire recommandé',
    });
  }

  const allCompetencies = [
    ...(data.competencies.algebra || []),
    ...(data.competencies.analysis || []),
    ...(data.competencies.geometry || []),
    ...(data.competencies.probabilities || []),
    ...(data.competencies.python || []),
  ];
  const highFrictionCount = allCompetencies.filter(
    (c) => c.friction !== null && c.friction >= 3
  ).length;
  if (highFrictionCount >= 2) {
    alerts.push({
      type: 'warning',
      code: 'MULTIPLE_BLOCKAGES',
      message: `Blocages identifiés sur ${highFrictionCount} compétences (friction ≥ 3)`,
    });
  }

  const weeklyWork = data.methodology.weeklyWork;
  if (weeklyWork) {
    const hours = parseFloat(weeklyWork);
    if (!isNaN(hours) && hours < 2) {
      alerts.push({
        type: 'info',
        code: 'LOW_WORK_VOLUME',
        message: 'Volume de travail hebdomadaire à augmenter (< 2h)',
      });
    }
  }

  if (data.methodology.maxConcentration === '30min') {
    alerts.push({
      type: 'info',
      code: 'LOW_ENDURANCE',
      message: 'Endurance de concentration à développer (≤ 30min)',
    });
  }

  return alerts;
}

/**
 * Main scoring function: computes all scores and returns a complete ScoringResult.
 */
export function computeScoring(data: BilanDiagnosticMathsData): ScoringResult {
  const { score: readinessScore, domainScores, activeDomains, evaluatedTotal } =
    calculateReadinessScore(data.competencies);

  const riskIndex = calculateRiskIndex(data.examPrep);

  const lowConfidence = activeDomains < 3;

  let recommendation: ScoringResult['recommendation'];
  let recommendationMessage: string;

  if (readinessScore >= 60 && riskIndex <= 55) {
    recommendation = 'Pallier2_confirmed';
    recommendationMessage = 'Profil compatible avec le Pallier 2 Excellence';
  } else if (readinessScore >= 48 && riskIndex <= 70) {
    recommendation = 'Pallier2_conditional';
    recommendationMessage = 'Pallier 2 possible avec accompagnement renforcé';
  } else {
    recommendation = 'Pallier1_recommended';
    recommendationMessage =
      'Le Pallier 1 Fondamentaux est recommandé pour consolider les bases';
  }

  const alerts = detectAlerts(data);

  if (lowConfidence) {
    alerts.push({
      type: 'warning',
      code: 'LOW_DATA_QUALITY',
      message: `Données insuffisantes : seulement ${activeDomains} domaine(s) actif(s) sur 5`,
    });
  }

  return {
    readinessScore,
    riskIndex,
    recommendation,
    recommendationMessage,
    domainScores,
    alerts,
    dataQuality: {
      activeDomains,
      evaluatedCompetencies: evaluatedTotal,
      lowConfidence,
    },
  };
}
