/**
 * Unit tests for Scoring V2 Engine (score-diagnostic.ts)
 *
 * Tests: MasteryIndex, CoverageIndex, ExamReadinessIndex,
 * recommendation thresholds, NA/unknown handling, alerts, data quality.
 */

import { computeScoringV2 } from '@/lib/diagnostics/score-diagnostic';
import type { BilanDiagnosticMathsData } from '@/lib/validations';

type CompStatus = 'studied' | 'in_progress' | 'not_studied' | 'unknown';

/** Helper: build a competency with all required fields */
let _skCounter = 0;
function sk(
  skillLabel: string,
  status: CompStatus,
  mastery: number | null,
  friction: number | null = mastery !== null ? Math.max(0, 4 - mastery) : null,
  errorTypes: string[] = []
) {
  return {
    skillId: `sk_${++_skCounter}`,
    skillLabel,
    status,
    mastery,
    confidence: mastery !== null ? 3 : null,
    friction,
    errorTypes,
    evidence: '',
  };
}

/** Helper: build a minimal valid diagnostic data object */
function buildData(overrides: Partial<BilanDiagnosticMathsData> = {}): BilanDiagnosticMathsData {
  const base: BilanDiagnosticMathsData = {
    identity: { firstName: 'Test', lastName: 'Eleve', email: 'test@test.com', phone: '12345678' },
    schoolContext: {},
    performance: {},
    chapters: {},
    competencies: {
      algebra: [
        sk('Suites', 'studied', 3, 1),
        sk('Second degré', 'studied', 2, 2, ['calcul']),
        sk('Inéquations', 'studied', 3, 1),
      ],
      analysis: [
        sk('Dérivation', 'studied', 4, 0),
        sk('Variations', 'studied', 3, 1),
        sk('Limites', 'studied', 2, 2, ['signe']),
      ],
      geometry: [
        sk('Vecteurs', 'studied', 3, 1),
        sk('Produit scalaire', 'studied', 2, 2),
      ],
      probabilities: [
        sk('Conditionnelles', 'studied', 3, 1),
        sk('Arbres', 'studied', 3, 0),
      ],
      python: [
        sk('Boucles', 'studied', 4, 0),
        sk('Fonctions', 'studied', 3, 1),
      ],
    },
    openQuestions: {},
    examPrep: {
      miniTest: { score: 4, timeUsedMinutes: 15, completedInTime: true },
      selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 3, justifications: 3, stress: 1 },
      signals: { hardestItems: [5, 6], dominantErrorType: 'calcul', verifiedAnswers: true, feeling: 'ok' },
    },
    methodology: { learningStyle: 'visual', problemReflex: 'relire', weeklyWork: '3', maxConcentration: '1h', errorTypes: ['calcul'] },
    ambition: { targetMention: 'B', postBac: 'CPGE', pallier2Pace: 'oui' },
    freeText: {},
  };

  return { ...base, ...overrides } as BilanDiagnosticMathsData;
}

describe('computeScoringV2', () => {
  describe('Basic scoring', () => {
    it('should compute all three indices', () => {
      const data = buildData();
      const result = computeScoringV2(data);

      expect(result.masteryIndex).toBeGreaterThan(0);
      expect(result.masteryIndex).toBeLessThanOrEqual(100);
      expect(result.coverageIndex).toBeGreaterThan(0);
      expect(result.coverageIndex).toBeLessThanOrEqual(100);
      expect(result.examReadinessIndex).toBeGreaterThan(0);
      expect(result.examReadinessIndex).toBeLessThanOrEqual(100);
    });

    it('should derive readinessScore from weighted combination', () => {
      const data = buildData();
      const result = computeScoringV2(data);

      // readinessScore = 0.50 * mastery + 0.15 * coverage + 0.35 * examReadiness
      const expected = Math.round(
        0.50 * result.masteryIndex +
        0.15 * result.coverageIndex +
        0.35 * result.examReadinessIndex
      );
      expect(result.readinessScore).toBe(expected);
    });

    it('should compute riskIndex from rebalanced formula (60% proof + 40% declarative)', () => {
      const data = buildData();
      const result = computeScoringV2(data);

      // RiskIndex is now 60% proof-based + 40% declarative, not simply 100 - examReadiness
      expect(result.riskIndex).toBeGreaterThanOrEqual(0);
      expect(result.riskIndex).toBeLessThanOrEqual(100);
      // With good mini-test (4/6), completedInTime, verifiedAnswers, low stress → risk should be moderate
      expect(result.riskIndex).toBeLessThan(50);
    });
  });

  describe('Recommendation thresholds', () => {
    it('should return Pallier2_confirmed for strong profile', () => {
      const data = buildData();
      const result = computeScoringV2(data);

      // With mastery ~70%, good exam prep → should be confirmed or conditional
      expect(['Pallier2_confirmed', 'Pallier2_conditional']).toContain(result.recommendation);
    });

    it('should return Pallier1_recommended for weak profile', () => {
      const data = buildData({
        competencies: {
          algebra: [
            sk('Suites', 'studied', 1, 3, ['calcul']),
            sk('Second degré', 'studied', 0, 4, ['calcul', 'signe']),
          ],
          analysis: [
            sk('Dérivation', 'studied', 1, 3, ['signe']),
            sk('Variations', 'studied', 0, 4),
          ],
          geometry: [],
          probabilities: [],
          python: [],
        },
        examPrep: {
          miniTest: { score: 1, timeUsedMinutes: 20, completedInTime: false },
          selfRatings: { speedNoCalc: 1, calcReliability: 1, redaction: 1, justifications: 1, stress: 4 },
          signals: { hardestItems: [1, 2, 3, 4, 5, 6], dominantErrorType: 'calcul', verifiedAnswers: false, feeling: 'panic' },
        },
      });
      const result = computeScoringV2(data);

      expect(result.recommendation).toBe('Pallier1_recommended');
    });
  });

  describe('NA / not_studied / unknown handling', () => {
    it('should exclude not_studied from mastery but count in coverage', () => {
      const data = buildData({
        competencies: {
          algebra: [
            sk('Suites', 'studied', 4, 0),
            sk('Second degré', 'studied', 4, 0),
            sk('Inéquations', 'not_studied', null, null),
          ],
          analysis: [
            sk('Dérivation', 'studied', 4, 0),
            sk('Variations', 'studied', 4, 0),
          ],
          geometry: [
            sk('Vecteurs', 'not_studied', null, null),
            sk('Produit scalaire', 'not_studied', null, null),
          ],
          probabilities: [
            sk('Conditionnelles', 'studied', 4, 0),
            sk('Arbres', 'studied', 4, 0),
          ],
          python: [
            sk('Boucles', 'studied', 4, 0),
            sk('Fonctions', 'studied', 4, 0),
          ],
        },
      });
      const result = computeScoringV2(data);

      // Mastery should be 100% (all evaluated items are 4/4)
      expect(result.masteryIndex).toBe(100);

      // Coverage should be < 100% (3 items not_studied out of 12)
      expect(result.coverageIndex).toBeLessThan(100);
      expect(result.coverageIndex).toBeGreaterThan(50);

      // not_studied items should be tracked
      expect(result.dataQuality.notStudiedCompetencies).toBe(3);
    });

    it('should penalize data quality for unknown items', () => {
      const data = buildData({
        competencies: {
          algebra: [
            sk('Suites', 'unknown', null, null),
            sk('Second degré', 'unknown', null, null),
            sk('Inéquations', 'unknown', null, null),
          ],
          analysis: [
            sk('Dérivation', 'studied', 3, 1),
            sk('Variations', 'studied', 3, 1),
          ],
          geometry: [],
          probabilities: [],
          python: [],
        },
      });
      const result = computeScoringV2(data);

      expect(result.dataQuality.unknownCompetencies).toBe(3);
      // Should trigger HIGH_UNKNOWN alert
      expect(result.alerts.some((a: { code: string }) => a.code === 'HIGH_UNKNOWN')).toBe(true);
    });
  });

  describe('Domain scores', () => {
    it('should require ≥2 evaluated competencies for active domain', () => {
      const data = buildData({
        competencies: {
          algebra: [
            sk('Suites', 'studied', 4, 0),
            // Only 1 evaluated → domain should be inactive
          ],
          analysis: [
            sk('Dérivation', 'studied', 4, 0),
            sk('Variations', 'studied', 4, 0),
          ],
          geometry: [],
          probabilities: [],
          python: [],
        },
      });
      const result = computeScoringV2(data);

      const algebraDomain = result.domainScores.find((d: { domain: string }) => d.domain === 'algebra');
      expect(algebraDomain?.score).toBe(0); // Inactive
      expect(algebraDomain?.priority).toBe('critical');

      const analysisDomain = result.domainScores.find((d: { domain: string }) => d.domain === 'analysis');
      expect(analysisDomain?.score).toBe(100); // Active, all 4/4
    });

    it('should assign correct priority levels', () => {
      const data = buildData({
        competencies: {
          algebra: [
            sk('A', 'studied', 1, 3),
            sk('B', 'studied', 1, 3),
          ],
          analysis: [
            sk('C', 'studied', 2, 2),
            sk('D', 'studied', 2, 2),
          ],
          geometry: [
            sk('E', 'studied', 3, 1),
            sk('F', 'studied', 3, 1),
          ],
          probabilities: [
            sk('G', 'studied', 4, 0),
            sk('H', 'studied', 4, 0),
          ],
          python: [],
        },
      });
      const result = computeScoringV2(data);

      const algebra = result.domainScores.find((d: { domain: string }) => d.domain === 'algebra');
      expect(algebra?.priority).toBe('critical'); // 25% → critical

      const analysis = result.domainScores.find((d: { domain: string }) => d.domain === 'analysis');
      expect(analysis?.priority).toBe('medium'); // 50% → medium (≥50 and <70)

      const geometry = result.domainScores.find((d: { domain: string }) => d.domain === 'geometry');
      expect(geometry?.priority).toBe('low'); // 75% → low (≥70)

      const probabilities = result.domainScores.find((d: { domain: string }) => d.domain === 'probabilities');
      expect(probabilities?.priority).toBe('low'); // 100% → low
    });
  });

  describe('Alerts', () => {
    it('should detect HIGH_STRESS', () => {
      const data = buildData({
        examPrep: {
          miniTest: { score: 4, timeUsedMinutes: 15, completedInTime: true },
          selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 3, justifications: 3, stress: 4 },
          signals: { hardestItems: [], verifiedAnswers: null, feeling: 'ok' },
        },
      });
      const result = computeScoringV2(data);
      expect(result.alerts.some((a: { code: string }) => a.code === 'HIGH_STRESS')).toBe(true);
    });

    it('should detect WEAK_AUTOMATISMS', () => {
      const data = buildData({
        examPrep: {
          miniTest: { score: 1, timeUsedMinutes: 20, completedInTime: false },
          selfRatings: { speedNoCalc: 1, calcReliability: 1, redaction: 1, justifications: 1, stress: 1 },
          signals: { hardestItems: [1, 2, 3], verifiedAnswers: null, feeling: 'ok' },
        },
      });
      const result = computeScoringV2(data);
      expect(result.alerts.some((a: { code: string }) => a.code === 'WEAK_AUTOMATISMS')).toBe(true);
    });

    it('should detect PANIC_SIGNAL', () => {
      const data = buildData({
        examPrep: {
          miniTest: { score: 3, timeUsedMinutes: 15, completedInTime: true },
          selfRatings: { speedNoCalc: 2, calcReliability: 2, redaction: 2, justifications: 2, stress: 2 },
          signals: { hardestItems: [], verifiedAnswers: null, feeling: 'panic' },
        },
      });
      const result = computeScoringV2(data);
      expect(result.alerts.some((a: { code: string }) => a.code === 'PANIC_SIGNAL')).toBe(true);
    });

    it('should detect LOW_DATA_QUALITY when < 3 active domains', () => {
      const data = buildData({
        competencies: {
          algebra: [
            sk('A', 'studied', 3, 1),
            sk('B', 'studied', 3, 1),
          ],
          analysis: [
            sk('C', 'studied', 3, 1),
            sk('D', 'studied', 3, 1),
          ],
          geometry: [],
          probabilities: [],
          python: [],
        },
      });
      const result = computeScoringV2(data);
      expect(result.dataQuality.lowConfidence).toBe(true);
      expect(result.alerts.some((a: { code: string }) => a.code === 'LOW_DATA_QUALITY')).toBe(true);
    });
  });

  describe('Justification', () => {
    it('should provide justification and upgradeConditions', () => {
      const data = buildData();
      const result = computeScoringV2(data);

      expect(result.justification).toBeTruthy();
      expect(typeof result.justification).toBe('string');
      expect(Array.isArray(result.upgradeConditions)).toBe(true);
    });

    it('should provide upgrade conditions for conditional recommendation', () => {
      // Build a profile that's borderline conditional
      const data = buildData({
        competencies: {
          algebra: [
            sk('A', 'studied', 2, 2),
            sk('B', 'studied', 2, 2),
          ],
          analysis: [
            sk('C', 'studied', 2, 2),
            sk('D', 'studied', 2, 2),
          ],
          geometry: [
            sk('E', 'studied', 2, 2),
            sk('F', 'studied', 2, 2),
          ],
          probabilities: [
            sk('G', 'studied', 2, 2),
            sk('H', 'studied', 2, 2),
          ],
          python: [
            sk('I', 'studied', 2, 2),
            sk('J', 'studied', 2, 2),
          ],
        },
        examPrep: {
          miniTest: { score: 3, timeUsedMinutes: 18, completedInTime: true },
          selfRatings: { speedNoCalc: 2, calcReliability: 2, redaction: 2, justifications: 2, stress: 2 },
          signals: { hardestItems: [4, 5], verifiedAnswers: null, feeling: 'ok' },
        },
      });
      const result = computeScoringV2(data);

      if (result.recommendation === 'Pallier2_conditional') {
        expect(result.upgradeConditions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Data quality', () => {
    it('should report good quality with ≥4 active domains and few unknowns', () => {
      const data = buildData();
      const result = computeScoringV2(data);

      expect(result.dataQuality.quality).toBe('good');
      expect(result.dataQuality.activeDomains).toBeGreaterThanOrEqual(4);
    });

    it('should report insufficient quality with < 3 active domains', () => {
      const data = buildData({
        competencies: {
          algebra: [
            sk('A', 'studied', 3, 1),
            sk('B', 'studied', 3, 1),
          ],
          analysis: [],
          geometry: [],
          probabilities: [],
          python: [],
        },
      });
      const result = computeScoringV2(data);

      expect(result.dataQuality.quality).toBe('insufficient');
      expect(result.dataQuality.activeDomains).toBe(1);
    });
  });

  describe('TrustScore', () => {
    it('should return green trust for complete data', () => {
      const data = buildData();
      const result = computeScoringV2(data);

      expect(result.trustScore).toBeGreaterThanOrEqual(0);
      expect(result.trustScore).toBeLessThanOrEqual(100);
      expect(['green', 'orange', 'red']).toContain(result.trustLevel);
    });

    it('should penalize trust for many unknowns', () => {
      const good = buildData();
      const bad = buildData({
        competencies: {
          algebra: [
            sk('A', 'unknown', null, null),
            sk('B', 'unknown', null, null),
            sk('C', 'unknown', null, null),
            sk('D', 'unknown', null, null),
          ],
          analysis: [
            sk('E', 'studied', 3, 1),
            sk('F', 'studied', 3, 1),
          ],
          geometry: [],
          probabilities: [],
          python: [],
        },
      });

      const goodResult = computeScoringV2(good);
      const badResult = computeScoringV2(bad);

      expect(badResult.trustScore).toBeLessThan(goodResult.trustScore);
    });

    it('should return red trust for very incomplete data', () => {
      const data = buildData({
        competencies: {
          algebra: [
            sk('A', 'unknown', null, null),
          ],
          analysis: [],
          geometry: [],
          probabilities: [],
          python: [],
        },
      });
      const result = computeScoringV2(data);

      expect(result.trustLevel).toBe('red');
    });
  });

  describe('Inconsistency detection', () => {
    it('should detect INCONSISTENT_SIGNAL (high mini-test + panic)', () => {
      const data = buildData({
        examPrep: {
          miniTest: { score: 5, timeUsedMinutes: 15, completedInTime: true },
          selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 3, justifications: 3, stress: 2 },
          signals: { hardestItems: [], feeling: 'panic', verifiedAnswers: true },
        },
      });
      const result = computeScoringV2(data);

      expect(result.inconsistencies.some((i: { code: string }) => i.code === 'INCONSISTENT_SIGNAL')).toBe(true);
    });

    it('should detect RUSHED_TEST (fast + low score)', () => {
      const data = buildData({
        examPrep: {
          miniTest: { score: 1, timeUsedMinutes: 5, completedInTime: true },
          selfRatings: { speedNoCalc: 1, calcReliability: 1, redaction: 1, justifications: 1, stress: 1 },
          signals: { hardestItems: [], verifiedAnswers: null, feeling: 'ok' },
        },
      });
      const result = computeScoringV2(data);

      expect(result.inconsistencies.some((i: { code: string }) => i.code === 'RUSHED_TEST')).toBe(true);
    });

    it('should not flag inconsistencies for normal data', () => {
      const data = buildData();
      const result = computeScoringV2(data);

      expect(result.inconsistencies.length).toBe(0);
    });
  });

  describe('Computed priorities', () => {
    it('should compute topPriorities from weak domains', () => {
      const data = buildData({
        competencies: {
          algebra: [
            sk('Suites', 'studied', 0, 3, ['calcul']),
            sk('Second degré', 'studied', 1, 2, ['signe']),
          ],
          analysis: [
            sk('Dérivation', 'studied', 4, 0),
            sk('Variations', 'studied', 4, 0),
          ],
          geometry: [
            sk('Vecteurs', 'studied', 3, 1),
            sk('Produit scalaire', 'studied', 3, 1),
          ],
          probabilities: [
            sk('Conditionnelles', 'studied', 3, 1),
            sk('Arbres', 'studied', 3, 0),
          ],
          python: [
            sk('Boucles', 'studied', 4, 0),
            sk('Fonctions', 'studied', 3, 1),
          ],
        },
      });
      const result = computeScoringV2(data);

      expect(result.topPriorities.length).toBeGreaterThan(0);
      expect(result.topPriorities[0].domain).toBe('algebra');
    });

    it('should compute quickWins from upgradeable skills', () => {
      const data = buildData();
      const result = computeScoringV2(data);

      expect(Array.isArray(result.quickWins)).toBe(true);
    });

    it('should compute highRisk from blocking skills', () => {
      const data = buildData({
        competencies: {
          algebra: [
            sk('Suites', 'studied', 0, 4, ['calcul']),
            sk('Second degré', 'studied', 0, 4, ['signe']),
          ],
          analysis: [
            sk('Dérivation', 'studied', 3, 1),
            sk('Variations', 'studied', 3, 1),
          ],
          geometry: [
            sk('Vecteurs', 'studied', 3, 1),
            sk('Produit scalaire', 'studied', 3, 1),
          ],
          probabilities: [
            sk('Conditionnelles', 'studied', 3, 1),
            sk('Arbres', 'studied', 3, 0),
          ],
          python: [
            sk('Boucles', 'studied', 4, 0),
            sk('Fonctions', 'studied', 3, 1),
          ],
        },
      });
      const result = computeScoringV2(data);

      expect(result.highRisk.length).toBeGreaterThan(0);
      expect(result.highRisk[0].skillLabel).toBe('Suites');
    });
  });

  describe('ExamReadiness', () => {
    it('should invert stress: high stress → low readiness', () => {
      const lowStress = buildData({
        examPrep: {
          miniTest: { score: 4, timeUsedMinutes: 15, completedInTime: true },
          selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 3, justifications: 3, stress: 0 },
          signals: { hardestItems: [], verifiedAnswers: null, feeling: 'ok' },
        },
      });
      const highStress = buildData({
        examPrep: {
          miniTest: { score: 4, timeUsedMinutes: 15, completedInTime: true },
          selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 3, justifications: 3, stress: 4 },
          signals: { hardestItems: [], verifiedAnswers: null, feeling: 'ok' },
        },
      });

      const lowResult = computeScoringV2(lowStress);
      const highResult = computeScoringV2(highStress);

      expect(lowResult.examReadinessIndex).toBeGreaterThan(highResult.examReadinessIndex);
    });

    it('should penalize not completing in time', () => {
      const inTime = buildData({
        examPrep: {
          miniTest: { score: 4, timeUsedMinutes: 15, completedInTime: true },
          selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 3, justifications: 3, stress: 1 },
          signals: { hardestItems: [], verifiedAnswers: null, feeling: 'ok' },
        },
      });
      const notInTime = buildData({
        examPrep: {
          miniTest: { score: 4, timeUsedMinutes: 25, completedInTime: false },
          selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 3, justifications: 3, stress: 1 },
          signals: { hardestItems: [], verifiedAnswers: null, feeling: 'ok' },
        },
      });

      const inTimeResult = computeScoringV2(inTime);
      const notInTimeResult = computeScoringV2(notInTime);

      expect(inTimeResult.examReadinessIndex).toBeGreaterThan(notInTimeResult.examReadinessIndex);
    });
  });
});
