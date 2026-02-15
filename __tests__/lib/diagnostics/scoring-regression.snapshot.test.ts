/**
 * Scoring Regression Snapshots — Frozen fixtures with exact expected values.
 *
 * Purpose: Detect unintended scoring regressions when:
 * - A skill is added/removed in YAML definitions
 * - Domain weights are changed
 * - Prerequisites are modified
 * - Scoring formula is altered
 *
 * If a test fails, it means the scoring output changed.
 * Either update the fixture (intentional change) or fix the regression.
 */

import { computeScoringV2 } from '@/lib/diagnostics/score-diagnostic';
import type { ScoringPolicy, ChaptersSelection, ChapterDefinition } from '@/lib/diagnostics/types';
import type { BilanDiagnosticMathsData } from '@/lib/validations';

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

type CompStatus = 'studied' | 'in_progress' | 'not_studied' | 'unknown';

function sk(
  id: string,
  mastery: number | null,
  status: CompStatus = 'studied',
  friction: number | null = mastery !== null ? 1 : null,
  errorTypes: string[] = []
) {
  return {
    skillId: id, skillLabel: id, mastery, status,
    confidence: mastery !== null ? 3 : null, friction, errorTypes, evidence: '',
  };
}

/** Frozen exam prep data — identical across all 4 fixtures */
const FROZEN_EXAM = {
  miniTest: { score: 4, timeUsedMinutes: 12, completedInTime: true },
  selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 3, justifications: 2, stress: 2 },
  signals: { hardestItems: [3, 5], dominantErrorType: 'calcul', verifiedAnswers: true, feeling: 'ok' as const },
};

function makeBase(competencies: BilanDiagnosticMathsData['competencies']): BilanDiagnosticMathsData {
  return {
    identity: { firstName: 'Regression', lastName: 'Test', email: 'reg@test.com', phone: '000' },
    schoolContext: { establishment: 'Lycée Test' },
    performance: { mathAverage: '12' },
    chapters: {},
    competencies,
    openQuestions: {},
    examPrep: FROZEN_EXAM,
    methodology: { learningStyle: 'visuel', errorTypes: ['calcul'] },
    ambition: { targetMention: 'Bien' },
    freeText: {},
  } as BilanDiagnosticMathsData;
}

/* ═══════════════════════════════════════════════════════════════════════════
   FROZEN POLICIES (from DiagnosticDefinition scoringPolicy)
   ═══════════════════════════════════════════════════════════════════════════ */

const MATHS_1ERE_POLICY: ScoringPolicy = {
  domainWeights: { algebra: 0.22, analysis: 0.22, geometry: 0.18, prob_stats: 0.18, algo_prog: 0.10, logic_sets: 0.10 },
  thresholds: { confirmed: { readiness: 60, risk: 55 }, conditional: { readiness: 48, risk: 70 } },
};

const MATHS_TLE_POLICY: ScoringPolicy = {
  domainWeights: { analysis: 0.28, algebra: 0.22, geometry: 0.15, prob_stats: 0.20, algorithmic: 0.15 },
  thresholds: { confirmed: { readiness: 60, risk: 55 }, conditional: { readiness: 48, risk: 70 } },
};

const NSI_1ERE_POLICY: ScoringPolicy = {
  domainWeights: { data_representation: 0.20, data_processing: 0.20, algorithms: 0.20, python_programming: 0.25, systems_architecture: 0.15 },
  thresholds: { confirmed: { readiness: 60, risk: 55 }, conditional: { readiness: 48, risk: 70 } },
};

const NSI_TLE_POLICY: ScoringPolicy = {
  domainWeights: { data_structures: 0.25, algorithmic_advanced: 0.25, databases: 0.15, networks: 0.15, systems_os: 0.10, python_advanced: 0.10 },
  thresholds: { confirmed: { readiness: 60, risk: 55 }, conditional: { readiness: 48, risk: 70 } },
};

/* ═══════════════════════════════════════════════════════════════════════════
   FROZEN FIXTURES — DO NOT MODIFY unless intentional scoring change
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Scoring Regression — Maths Première P2', () => {
  const data = makeBase({
    algebra: [sk('alg1', 3), sk('alg2', 2, 'studied', 2, ['calcul']), sk('alg3', 3)],
    analysis: [sk('ana1', 4, 'studied', 0), sk('ana2', 3), sk('ana3', 2, 'studied', 2, ['signe'])],
    geometry: [sk('geo1', 3), sk('geo2', 2, 'studied', 2)],
    prob_stats: [sk('prob1', 3), sk('prob2', 3, 'studied', 0)],
    algo_prog: [sk('algo1', 4, 'studied', 0), sk('algo2', 3)],
    logic_sets: [sk('logic1', 2), sk('logic2', 3)],
  });

  const result = computeScoringV2(data, MATHS_1ERE_POLICY);

  it('readinessScore = 75', () => expect(result.readinessScore).toBe(75));
  it('riskIndex = 24', () => expect(result.riskIndex).toBe(24));
  it('masteryIndex = 71', () => expect(result.masteryIndex).toBe(71));
  it('coverageIndex = 100', () => expect(result.coverageIndex).toBe(100));
  it('examReadinessIndex = 70', () => expect(result.examReadinessIndex).toBe(70));
  it('recommendation = Pallier2_confirmed', () => expect(result.recommendation).toBe('Pallier2_confirmed'));
  it('trustScore = 100', () => expect(result.trustScore).toBe(100));
  it('trustLevel = green', () => expect(result.trustLevel).toBe('green'));
  it('domainScores has 6 domains', () => expect(result.domainScores).toHaveLength(6));
});

describe('Scoring Regression — Maths Terminale P2', () => {
  const data = makeBase({
    analysis: [sk('ana1', 3), sk('ana2', 2, 'studied', 2), sk('ana3', 1, 'studied', 3, ['limite'])],
    algebra: [sk('alg1', 3), sk('alg2', 4, 'studied', 0)],
    geometry: [sk('geo1', 2, 'studied', 2), sk('geo2', 1, 'studied', 3)],
    prob_stats: [sk('prob1', 3), sk('prob2', 2, 'studied', 2)],
    algorithmic: [sk('algo1', 3), sk('algo2', 2)],
  });

  const result = computeScoringV2(data, MATHS_TLE_POLICY);

  it('readinessScore = 70', () => expect(result.readinessScore).toBe(70));
  it('riskIndex = 24', () => expect(result.riskIndex).toBe(24));
  it('masteryIndex = 61', () => expect(result.masteryIndex).toBe(61));
  it('coverageIndex = 100', () => expect(result.coverageIndex).toBe(100));
  it('examReadinessIndex = 70', () => expect(result.examReadinessIndex).toBe(70));
  it('recommendation = Pallier2_confirmed', () => expect(result.recommendation).toBe('Pallier2_confirmed'));
  it('trustScore = 100', () => expect(result.trustScore).toBe(100));
  it('domainScores has 5 domains', () => expect(result.domainScores).toHaveLength(5));
});

describe('Scoring Regression — NSI Première P2', () => {
  const data = makeBase({
    data_representation: [sk('dr1', 3), sk('dr2', 2, 'studied', 2)],
    data_processing: [sk('dp1', 4, 'studied', 0), sk('dp2', 3)],
    algorithms: [sk('alg1', 3), sk('alg2', 2, 'studied', 2, ['complexite'])],
    python_programming: [sk('py1', 4, 'studied', 0), sk('py2', 3), sk('py3', 3)],
    systems_architecture: [sk('sys1', 2, 'studied', 2), sk('sys2', 2)],
  });

  const result = computeScoringV2(data, NSI_1ERE_POLICY);

  it('readinessScore = 75', () => expect(result.readinessScore).toBe(75));
  it('riskIndex = 24', () => expect(result.riskIndex).toBe(24));
  it('masteryIndex = 71', () => expect(result.masteryIndex).toBe(71));
  it('coverageIndex = 100', () => expect(result.coverageIndex).toBe(100));
  it('examReadinessIndex = 70', () => expect(result.examReadinessIndex).toBe(70));
  it('recommendation = Pallier2_confirmed', () => expect(result.recommendation).toBe('Pallier2_confirmed'));
  it('trustScore = 100', () => expect(result.trustScore).toBe(100));
  it('domainScores has 5 domains', () => expect(result.domainScores).toHaveLength(5));
});

describe('Scoring Regression — NSI Terminale P2', () => {
  const data = makeBase({
    data_structures: [sk('ds1', 3), sk('ds2', 2, 'studied', 2), sk('ds3', 1, 'studied', 3, ['pointeur'])],
    algorithmic_advanced: [sk('aa1', 2, 'studied', 2), sk('aa2', 3)],
    databases: [sk('db1', 4, 'studied', 0), sk('db2', 3)],
    networks: [sk('net1', 2, 'studied', 2), sk('net2', null, 'not_studied', null)],
    systems_os: [sk('os1', 3), sk('os2', 2)],
    python_advanced: [sk('pa1', 3), sk('pa2', 2, 'studied', 2)],
  });

  const result = computeScoringV2(data, NSI_TLE_POLICY);

  it('readinessScore = 70', () => expect(result.readinessScore).toBe(70));
  it('riskIndex = 24', () => expect(result.riskIndex).toBe(24));
  it('masteryIndex = 63', () => expect(result.masteryIndex).toBe(63));
  it('coverageIndex = 92', () => expect(result.coverageIndex).toBe(92));
  it('examReadinessIndex = 70', () => expect(result.examReadinessIndex).toBe(70));
  it('recommendation = Pallier2_confirmed', () => expect(result.recommendation).toBe('Pallier2_confirmed'));
  it('trustScore = 100', () => expect(result.trustScore).toBe(100));
  it('domainScores has 6 domains', () => expect(result.domainScores).toHaveLength(6));
  it('networks has 1 not_studied', () => {
    const net = result.domainScores.find(d => d.domain === 'networks');
    expect(net).toBeDefined();
    expect(net!.notStudiedCount).toBe(1);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   REGRESSION GUARD — Prerequisite penalty stability
   ═══════════════════════════════════════════════════════════════════════════ */

describe('Scoring Regression — Prerequisite penalty is deterministic', () => {
  const chapters: ChapterDefinition[] = [
    { chapterId: 'ch1', chapterLabel: 'Ch1', description: '', domainId: 'algebra', skills: ['alg1', 'alg2'], ragTopics: [] },
    { chapterId: 'ch2', chapterLabel: 'Ch2', description: '', domainId: 'analysis', skills: ['ana1'], ragTopics: [] },
  ];
  const skillMeta = [
    { skillId: 'alg1', chapterId: 'ch1', prerequisite: true, prerequisiteLevel: 'core' },
    { skillId: 'alg2', chapterId: 'ch1', prerequisite: false },
    { skillId: 'ana1', chapterId: 'ch2', prerequisite: false },
  ];
  const sel: ChaptersSelection = { selected: ['ch2'], inProgress: [], notYet: ['ch1'] };

  const data = makeBase({
    algebra: [sk('alg1', 1), sk('alg2', 3)],
    analysis: [sk('ana1', 3), sk('ana2', 3)],
    geometry: [sk('geo1', 3), sk('geo2', 3)],
    prob_stats: [sk('prob1', 3), sk('prob2', 3)],
    algo_prog: [sk('algo1', 3), sk('algo2', 3)],
    logic_sets: [sk('logic1', 3), sk('logic2', 3)],
  });

  const r1 = computeScoringV2(data, MATHS_1ERE_POLICY, sel, chapters, skillMeta);
  const r2 = computeScoringV2(data, MATHS_1ERE_POLICY, sel, chapters, skillMeta);

  it('produces identical readinessScore on repeated calls', () => {
    expect(r1.readinessScore).toBe(r2.readinessScore);
  });

  it('produces identical riskIndex on repeated calls', () => {
    expect(r1.riskIndex).toBe(r2.riskIndex);
  });

  it('prerequisite penalty reduces readinessScore vs no-meta', () => {
    const rNoMeta = computeScoringV2(data, MATHS_1ERE_POLICY, sel, chapters, []);
    expect(r1.readinessScore).toBeLessThanOrEqual(rNoMeta.readinessScore);
  });
});
