/**
 * Scoring Engine V2 — Three separate indices before aggregation.
 *
 * MasteryIndex:       Level on evaluated competencies (excludes not_studied)
 * CoverageIndex:      Proportion of program actually seen/evaluated
 * ExamReadinessIndex: Automatisms + time + writing + stress
 *
 * Then derives:
 *   ReadinessScore = weighted(Mastery, Coverage, ExamReadiness)
 *   RiskIndex      = 100 - ExamReadinessIndex
 *   Recommendation = based on thresholds from DiagnosticDefinition
 */

import type { BilanDiagnosticMathsData } from '@/lib/validations';
import type {
  ScoringV2Result,
  DomainScoreV2,
  ScoringAlertV2,
  DataQualityV2,
  ScoringPolicy,
} from './types';

/**
 * Default scoring policy (maths-premiere-p2 v1.3).
 * Can be overridden by DiagnosticDefinition.scoringPolicy.
 */
const DEFAULT_POLICY: ScoringPolicy = {
  domainWeights: {
    analysis: 0.30,
    algebra: 0.25,
    geometry: 0.20,
    probabilities: 0.15,
    python: 0.10,
  },
  thresholds: {
    confirmed: { readiness: 60, risk: 55 },
    conditional: { readiness: 48, risk: 70 },
  },
};

/**
 * Calculate per-domain scores with V2 granularity.
 */
function calculateDomainScores(
  competencies: BilanDiagnosticMathsData['competencies'],
  weights: Record<string, number>
): {
  domainScores: DomainScoreV2[];
  masteryIndex: number;
  coverageIndex: number;
  dataQuality: DataQualityV2;
} {
  const domainScores: DomainScoreV2[] = [];
  let weightedMasterySum = 0;
  let masteryWeightSum = 0;
  let totalItems = 0;
  let totalEvaluated = 0;
  let totalNotStudied = 0;
  let totalUnknown = 0;
  let activeDomains = 0;

  const domains = ['algebra', 'analysis', 'geometry', 'probabilities', 'python'] as const;

  for (const domain of domains) {
    const items = competencies[domain] || [];
    totalItems += items.length;

    const evaluated = items.filter(
      (c) => c.status !== 'not_studied' && c.status !== 'unknown' && c.mastery !== null
    );
    const notStudied = items.filter((c) => c.status === 'not_studied');
    const unknown = items.filter((c) => c.status === 'unknown');

    totalEvaluated += evaluated.length;
    totalNotStudied += notStudied.length;
    totalUnknown += unknown.length;

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

    if (evaluated.length >= 2) {
      const meanMastery = evaluated.reduce((sum, c) => sum + (c.mastery ?? 0), 0) / evaluated.length;
      const domainScore = (meanMastery / 4) * 100;
      const weight = weights[domain] || 0.10;

      weightedMasterySum += weight * domainScore;
      masteryWeightSum += weight;
      activeDomains++;

      const priority: DomainScoreV2['priority'] =
        domainScore < 35 ? 'critical' :
        domainScore < 50 ? 'high' :
        domainScore < 70 ? 'medium' : 'low';

      domainScores.push({
        domain,
        score: Math.round(domainScore),
        evaluatedCount: evaluated.length,
        totalCount: items.length,
        notStudiedCount: notStudied.length,
        unknownCount: unknown.length,
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
        notStudiedCount: notStudied.length,
        unknownCount: unknown.length,
        gaps,
        dominantErrors,
        priority: 'critical',
      });
    }
  }

  const masteryIndex = masteryWeightSum > 0
    ? Math.round(weightedMasterySum / masteryWeightSum)
    : 0;

  // CoverageIndex: proportion of items that are evaluated (not "not_studied" or "unknown")
  const coverageIndex = totalItems > 0
    ? Math.round((totalEvaluated / totalItems) * 100)
    : 0;

  const quality: DataQualityV2['quality'] =
    activeDomains >= 4 && totalUnknown <= 2 ? 'good' :
    activeDomains >= 3 ? 'partial' : 'insufficient';

  return {
    domainScores,
    masteryIndex,
    coverageIndex,
    dataQuality: {
      activeDomains,
      evaluatedCompetencies: totalEvaluated,
      notStudiedCompetencies: totalNotStudied,
      unknownCompetencies: totalUnknown,
      lowConfidence: activeDomains < 3,
      quality,
    },
  };
}

/**
 * Calculate ExamReadinessIndex from exam preparation data.
 *
 * Components:
 *   0.40 × (miniTest.score/6 × 100)
 *   0.20 × (completedInTime ? 100 : 40)
 *   0.25 × (mean(redaction, justifications)/4 × 100)
 *   0.15 × (invertedStress/4 × 100)  — stress is inverted: high stress = low readiness
 */
function calculateExamReadiness(examPrep: BilanDiagnosticMathsData['examPrep']): number {
  const miniTestComponent = (examPrep.miniTest.score / 6) * 100;
  const timeComponent = examPrep.miniTest.completedInTime ? 100 : 40;
  const writingMean =
    ((examPrep.selfRatings.redaction + examPrep.selfRatings.justifications) / 2 / 4) * 100;
  // Invert stress: 4 (max stress) → 0 readiness, 0 (no stress) → 100 readiness
  const stressComponent = ((4 - examPrep.selfRatings.stress) / 4) * 100;

  const readiness =
    0.40 * miniTestComponent +
    0.20 * timeComponent +
    0.25 * writingMean +
    0.15 * stressComponent;

  return Math.round(Math.max(0, Math.min(100, readiness)));
}

/**
 * Detect alerts with impact descriptions.
 */
function detectAlerts(
  data: BilanDiagnosticMathsData,
  dataQuality: DataQualityV2
): ScoringAlertV2[] {
  const alerts: ScoringAlertV2[] = [];

  if (data.examPrep.selfRatings.stress >= 3) {
    alerts.push({
      type: 'warning',
      code: 'HIGH_STRESS',
      message: 'Gestion du stress à travailler (auto-évaluation ≥ 3/4)',
      impact: 'Risque de sous-performance à l\'épreuve anticipée malgré un bon niveau technique',
    });
  }

  if (data.examPrep.miniTest.score <= 2) {
    alerts.push({
      type: 'danger',
      code: 'WEAK_AUTOMATISMS',
      message: 'Automatismes très fragiles (mini-test ≤ 2/6)',
      impact: 'Partie automatismes de l\'épreuve anticipée (sans calculatrice) fortement compromise',
    });
  }

  if (data.examPrep.signals.feeling === 'panic') {
    alerts.push({
      type: 'danger',
      code: 'PANIC_SIGNAL',
      message: 'Signal de détresse — suivi prioritaire recommandé',
      impact: 'Nécessite un accompagnement psycho-pédagogique avant le travail technique',
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
      impact: 'Risque de décrochage si les blocages ne sont pas traités en priorité',
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
        impact: 'Progression limitée sans augmentation du temps de travail personnel',
      });
    }
  }

  if (data.methodology.maxConcentration === '30min') {
    alerts.push({
      type: 'info',
      code: 'LOW_ENDURANCE',
      message: 'Endurance de concentration à développer (≤ 30min)',
      impact: 'L\'épreuve anticipée dure 2h — endurance insuffisante pour maintenir la qualité',
    });
  }

  if (dataQuality.lowConfidence) {
    alerts.push({
      type: 'warning',
      code: 'LOW_DATA_QUALITY',
      message: `Données insuffisantes : seulement ${dataQuality.activeDomains} domaine(s) actif(s) sur 5`,
      impact: 'Le scoring et les recommandations sont moins fiables — à confirmer en séance',
    });
  }

  if (dataQuality.unknownCompetencies >= 3) {
    alerts.push({
      type: 'info',
      code: 'HIGH_UNKNOWN',
      message: `${dataQuality.unknownCompetencies} compétences en statut "unknown" — l'élève ne sait pas situer sa progression`,
      impact: 'Pénalise la qualité des données — évaluation diagnostique en séance recommandée',
    });
  }

  return alerts;
}

/**
 * Build justification string for the recommendation decision.
 */
function buildJustification(
  masteryIndex: number,
  coverageIndex: number,
  examReadinessIndex: number,
  readinessScore: number,
  riskIndex: number,
  recommendation: ScoringV2Result['recommendation'],
  thresholds: ScoringPolicy['thresholds']
): { justification: string; upgradeConditions: string[] } {
  const parts: string[] = [];
  const upgradeConditions: string[] = [];

  if (recommendation === 'Pallier2_confirmed') {
    parts.push(`Mastery (${masteryIndex}%) et ExamReadiness (${examReadinessIndex}%) au-dessus des seuils.`);
    if (coverageIndex < 70) {
      parts.push(`Attention : couverture programme à ${coverageIndex}% — chapitres non abordés à planifier.`);
    }
  } else if (recommendation === 'Pallier2_conditional') {
    if (readinessScore < thresholds.confirmed.readiness) {
      parts.push(`ReadinessScore (${readinessScore}%) sous le seuil confirmé (${thresholds.confirmed.readiness}%).`);
      upgradeConditions.push(`Atteindre ${thresholds.confirmed.readiness}% de ReadinessScore (actuellement ${readinessScore}%)`);
    }
    if (riskIndex > thresholds.confirmed.risk) {
      parts.push(`RiskIndex (${riskIndex}%) au-dessus du seuil confirmé (${thresholds.confirmed.risk}%).`);
      upgradeConditions.push(`Réduire le RiskIndex sous ${thresholds.confirmed.risk}% (actuellement ${riskIndex}%)`);
    }
    parts.push('Pallier 2 possible avec accompagnement renforcé.');
  } else {
    parts.push(`Profil nécessitant une consolidation des fondamentaux avant le Pallier 2.`);
    if (masteryIndex < 40) {
      upgradeConditions.push(`Améliorer le MasteryIndex au-dessus de 40% (actuellement ${masteryIndex}%)`);
    }
    if (examReadinessIndex < 40) {
      upgradeConditions.push(`Améliorer l'ExamReadiness au-dessus de 40% (actuellement ${examReadinessIndex}%)`);
    }
  }

  return { justification: parts.join(' '), upgradeConditions };
}

/**
 * Main scoring function V2.
 * Computes all indices and returns a complete ScoringV2Result.
 */
export function computeScoringV2(
  data: BilanDiagnosticMathsData,
  policy: ScoringPolicy = DEFAULT_POLICY
): ScoringV2Result {
  const { domainScores, masteryIndex, coverageIndex, dataQuality } =
    calculateDomainScores(data.competencies, policy.domainWeights);

  const examReadinessIndex = calculateExamReadiness(data.examPrep);

  // Derived ReadinessScore: weighted combination
  const readinessScore = Math.round(
    0.50 * masteryIndex +
    0.15 * coverageIndex +
    0.35 * examReadinessIndex
  );

  // RiskIndex: inverse of exam readiness
  const riskIndex = Math.round(100 - examReadinessIndex);

  // Decision based on thresholds
  let recommendation: ScoringV2Result['recommendation'];
  let recommendationMessage: string;

  if (readinessScore >= policy.thresholds.confirmed.readiness && riskIndex <= policy.thresholds.confirmed.risk) {
    recommendation = 'Pallier2_confirmed';
    recommendationMessage = 'Profil compatible avec le Pallier 2 Excellence';
  } else if (readinessScore >= policy.thresholds.conditional.readiness && riskIndex <= policy.thresholds.conditional.risk) {
    recommendation = 'Pallier2_conditional';
    recommendationMessage = 'Pallier 2 possible avec accompagnement renforcé';
  } else {
    recommendation = 'Pallier1_recommended';
    recommendationMessage = 'Le Pallier 1 Fondamentaux est recommandé pour consolider les bases';
  }

  const alerts = detectAlerts(data, dataQuality);

  const { justification, upgradeConditions } = buildJustification(
    masteryIndex, coverageIndex, examReadinessIndex,
    readinessScore, riskIndex, recommendation, policy.thresholds
  );

  return {
    masteryIndex,
    coverageIndex,
    examReadinessIndex,
    readinessScore,
    riskIndex,
    recommendation,
    recommendationMessage,
    justification,
    upgradeConditions,
    domainScores,
    alerts,
    dataQuality,
  };
}
