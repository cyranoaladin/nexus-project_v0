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
  PriorityItem,
  InconsistencyFlag,
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

  // Dynamic: iterate over all domain keys present in competencies (not hardcoded)
  const domains = Object.keys(competencies).filter(
    (k) => Array.isArray(competencies[k as keyof typeof competencies])
  );

  for (const domain of domains) {
    const items = competencies[domain as keyof typeof competencies] || [];
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
      coherenceIssues: 0, // filled later by detectInconsistencies
      miniTestFilled: true, // filled later
      criticalFieldsMissing: 0, // filled later
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

  // Dynamic: flatten all competency domains
  const allCompetencies = Object.values(data.competencies)
    .filter(Array.isArray)
    .flat();

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
 * Detect data inconsistencies for audit transparency.
 */
function detectInconsistencies(
  data: BilanDiagnosticMathsData
): InconsistencyFlag[] {
  const flags: InconsistencyFlag[] = [];

  // High mini-test + panic feeling
  if (data.examPrep.miniTest.score >= 5 && data.examPrep.signals.feeling === 'panic') {
    flags.push({
      code: 'INCONSISTENT_SIGNAL',
      message: 'Mini-test excellent (≥5/6) mais ressenti "panic" — incohérence à vérifier en séance',
      fields: ['examPrep.miniTest.score', 'examPrep.signals.feeling'],
      severity: 'warning',
    });
  }

  // Fast completion + low score
  if (data.examPrep.miniTest.completedInTime && data.examPrep.miniTest.score <= 2 && data.examPrep.miniTest.timeUsedMinutes <= 8) {
    flags.push({
      code: 'RUSHED_TEST',
      message: 'Mini-test terminé très vite (≤8min) avec score faible (≤2/6) — possible réponses aléatoires',
      fields: ['examPrep.miniTest.timeUsedMinutes', 'examPrep.miniTest.score'],
      severity: 'warning',
    });
  }

  // studied status but null mastery
  const allComp = Object.values(data.competencies)
    .filter(Array.isArray)
    .flat();
  const studiedNullMastery = allComp.filter((c) => c.status === 'studied' && c.mastery === null);
  if (studiedNullMastery.length >= 2) {
    flags.push({
      code: 'STUDIED_NO_MASTERY',
      message: `${studiedNullMastery.length} compétences marquées "studied" sans mastery — données incomplètes`,
      fields: studiedNullMastery.map((c) => c.skillLabel),
      severity: 'error',
    });
  }

  // High average declared but low mastery
  const avg = parseFloat(data.performance.mathAverage || '');
  if (!isNaN(avg) && avg >= 14) {
    const activeDomainKeys = Object.keys(data.competencies).filter(
      (k) => Array.isArray(data.competencies[k as keyof typeof data.competencies])
    );
    let totalMastery = 0;
    let totalEval = 0;
    for (const d of activeDomainKeys) {
      const items = data.competencies[d as keyof typeof data.competencies] || [];
      const evaluated = items.filter((c) => c.status !== 'not_studied' && c.status !== 'unknown' && c.mastery !== null);
      totalMastery += evaluated.reduce((s, c) => s + (c.mastery ?? 0), 0);
      totalEval += evaluated.length;
    }
    if (totalEval > 0 && (totalMastery / totalEval / 4) * 100 < 40) {
      flags.push({
        code: 'HIGH_AVERAGE_LOW_MASTERY',
        message: `Moyenne déclarée élevée (${avg}) mais mastery globale faible (<40%) — possible surévaluation ou programme non couvert`,
        fields: ['performance.mathAverage', 'competencies'],
        severity: 'warning',
      });
    }
  }

  return flags;
}

/**
 * Calculate TrustScore (0-100) — how reliable is this bilan.
 */
function calculateTrustScore(
  dataQuality: DataQualityV2,
  inconsistencies: InconsistencyFlag[],
  examPrep: BilanDiagnosticMathsData['examPrep']
): { trustScore: number; trustLevel: 'green' | 'orange' | 'red' } {
  let score = 100;

  // Penalize for low active domains (-15 per missing domain below 4)
  score -= Math.max(0, 4 - dataQuality.activeDomains) * 15;

  // Penalize for unknown competencies (-5 each, max -20)
  score -= Math.min(20, dataQuality.unknownCompetencies * 5);

  // Penalize for coherence issues (-10 each)
  score -= inconsistencies.filter((f) => f.severity === 'error').length * 10;
  score -= inconsistencies.filter((f) => f.severity === 'warning').length * 5;

  // Penalize if mini-test not completed in time (-10)
  if (!examPrep.miniTest.completedInTime) score -= 10;

  // Penalize for low evaluated competencies (<8 out of typical 15)
  if (dataQuality.evaluatedCompetencies < 8) score -= 15;

  // Penalize for critical fields missing
  score -= dataQuality.criticalFieldsMissing * 8;

  score = Math.max(0, Math.min(100, score));

  const trustLevel: 'green' | 'orange' | 'red' =
    score >= 70 ? 'green' :
    score >= 40 ? 'orange' : 'red';

  return { trustScore: Math.round(score), trustLevel };
}

/**
 * Compute pedagogical priorities from domain scores and competency data.
 */
function computePriorities(
  data: BilanDiagnosticMathsData,
  domainScores: DomainScoreV2[]
): { topPriorities: PriorityItem[]; quickWins: PriorityItem[]; highRisk: PriorityItem[] } {
  const topPriorities: PriorityItem[] = [];
  const quickWins: PriorityItem[] = [];
  const highRisk: PriorityItem[] = [];

  // TopPriorities: weakest skills from highest-weight domains
  for (const ds of domainScores.filter((d) => d.priority === 'critical' || d.priority === 'high')) {
    const items = data.competencies[ds.domain as keyof typeof data.competencies] || [];
    const weakSkills = items
      .filter((c) => c.mastery !== null && c.mastery <= 1 && c.status === 'studied')
      .slice(0, 2);
    for (const skill of weakSkills) {
      topPriorities.push({
        skillLabel: skill.skillLabel,
        domain: ds.domain,
        reason: `Mastery ${skill.mastery}/4 dans un domaine prioritaire (${ds.domain}: ${ds.score}%)`,
        impact: `Impact direct sur le score global — domaine poids ${ds.domain}`,
        exerciseType: skill.errorTypes?.[0] ? `Exercices ciblés erreur "${skill.errorTypes[0]}"` : 'Exercices de base',
      });
    }
  }

  // QuickWins: skills with mastery 2-3 and low friction (easy to upgrade)
  const allComp = Object.entries(data.competencies)
    .filter(([, v]) => Array.isArray(v))
    .flatMap(([domain, items]) => (items as typeof data.competencies.algebra).map((c) => ({ ...c, domain })));

  const upgradeable = allComp
    .filter((c) => c.mastery !== null && c.mastery >= 2 && c.mastery <= 3 && (c.friction === null || c.friction <= 1))
    .slice(0, 3);
  for (const skill of upgradeable) {
    quickWins.push({
      skillLabel: skill.skillLabel,
      domain: skill.domain,
      reason: `Mastery ${skill.mastery}/4 avec friction faible — gain rapide possible`,
      impact: 'Consolidation rapide avec 2-3 exercices ciblés',
      exerciseType: 'Exercices de consolidation',
    });
  }

  // HighRisk: blocking points (mastery 0, high friction, recurring errors)
  const blocking = allComp
    .filter((c) => (c.mastery !== null && c.mastery === 0) || (c.friction !== null && c.friction >= 4))
    .slice(0, 3);
  for (const skill of blocking) {
    highRisk.push({
      skillLabel: skill.skillLabel,
      domain: skill.domain,
      reason: skill.mastery === 0
        ? 'Mastery 0/4 — compétence non acquise'
        : `Friction ${skill.friction}/4 — blocage sévère`,
      impact: 'Point bloquant pour la progression — traitement prioritaire en séance',
      exerciseType: 'Reprise fondamentaux + accompagnement individuel',
    });
  }

  // Automatisms quick win if mini-test is mediocre but not terrible
  if (data.examPrep.miniTest.score >= 3 && data.examPrep.miniTest.score <= 4) {
    quickWins.push({
      skillLabel: 'Automatismes (sans calculatrice)',
      domain: 'examPrep',
      reason: `Mini-test ${data.examPrep.miniTest.score}/6 — marge de progression rapide`,
      impact: 'Gain direct sur la partie automatismes de l\'épreuve anticipée',
      exerciseType: 'Entraînement quotidien 10min sans calculatrice',
    });
  }

  return {
    topPriorities: topPriorities.slice(0, 5),
    quickWins: quickWins.slice(0, 4),
    highRisk: highRisk.slice(0, 3),
  };
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

  // Rebalanced RiskIndex: 60% proof-based + 40% declarative
  const proofRisk = 100 - (
    0.50 * ((data.examPrep.miniTest.score / 6) * 100) +
    0.25 * (data.examPrep.miniTest.completedInTime ? 100 : 40) +
    0.25 * ((data.examPrep.signals.verifiedAnswers ? 100 : 50))
  );
  const declarativeRisk = 100 - (
    0.50 * (((4 - data.examPrep.selfRatings.stress) / 4) * 100) +
    0.50 * (data.examPrep.signals.feeling === 'panic' ? 0 : data.examPrep.signals.feeling === 'ok' ? 80 : 50)
  );
  const riskIndex = Math.round(Math.max(0, Math.min(100,
    0.60 * proofRisk + 0.40 * declarativeRisk
  )));

  // Derived ReadinessScore: weighted combination
  const readinessScore = Math.round(
    0.50 * masteryIndex +
    0.15 * coverageIndex +
    0.35 * examReadinessIndex
  );

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

  // Detect inconsistencies
  const inconsistencies = detectInconsistencies(data);

  // Enrich dataQuality with coherence info
  dataQuality.coherenceIssues = inconsistencies.length;
  dataQuality.miniTestFilled = data.examPrep.miniTest.score > 0;
  const criticalMissing = [
    !data.performance.mathAverage,
    !data.schoolContext.establishment,
    dataQuality.evaluatedCompetencies < 5,
  ].filter(Boolean).length;
  dataQuality.criticalFieldsMissing = criticalMissing;

  const alerts = detectAlerts(data, dataQuality);

  // Add inconsistency alerts
  for (const inc of inconsistencies) {
    alerts.push({
      type: inc.severity === 'error' ? 'danger' : 'warning',
      code: inc.code,
      message: inc.message,
      impact: `Champs concernés : ${inc.fields.join(', ')}`,
    });
  }

  // TrustScore
  const { trustScore, trustLevel } = calculateTrustScore(dataQuality, inconsistencies, data.examPrep);

  // Computed priorities
  const { topPriorities, quickWins, highRisk } = computePriorities(data, domainScores);

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
    trustScore,
    trustLevel,
    topPriorities,
    quickWins,
    highRisk,
    inconsistencies,
  };
}
