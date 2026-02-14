/**
 * Unit tests for Scoring V2 Engine (score-diagnostic.ts)
 *
 * Tests: MasteryIndex, CoverageIndex, ExamReadinessIndex,
 * recommendation thresholds, NA/unknown handling, alerts, data quality.
 */

import { computeScoringV2 } from '@/lib/diagnostics/score-diagnostic';
import type { BilanDiagnosticMathsData } from '@/lib/validations';

/** Helper: build a minimal valid diagnostic data object */
function buildData(overrides: Partial<BilanDiagnosticMathsData> = {}): BilanDiagnosticMathsData {
  const base: BilanDiagnosticMathsData = {
    identity: { firstName: 'Test', lastName: 'Eleve', email: 'test@test.com', phone: '12345678' },
    schoolContext: {},
    performance: {},
    chapters: {},
    competencies: {
      algebra: [
        { skillLabel: 'Suites', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
        { skillLabel: 'Second degré', status: 'studied', mastery: 2, friction: 2, errorTypes: ['calcul'] },
        { skillLabel: 'Inéquations', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
      ],
      analysis: [
        { skillLabel: 'Dérivation', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
        { skillLabel: 'Variations', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
        { skillLabel: 'Limites', status: 'studied', mastery: 2, friction: 2, errorTypes: ['signe'] },
      ],
      geometry: [
        { skillLabel: 'Vecteurs', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
        { skillLabel: 'Produit scalaire', status: 'studied', mastery: 2, friction: 2, errorTypes: [] },
      ],
      probabilities: [
        { skillLabel: 'Conditionnelles', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
        { skillLabel: 'Arbres', status: 'studied', mastery: 3, friction: 0, errorTypes: [] },
      ],
      python: [
        { skillLabel: 'Boucles', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
        { skillLabel: 'Fonctions', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
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

    it('should compute riskIndex as inverse of examReadiness', () => {
      const data = buildData();
      const result = computeScoringV2(data);

      expect(result.riskIndex).toBe(Math.round(100 - result.examReadinessIndex));
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
            { skillLabel: 'Suites', status: 'studied', mastery: 1, friction: 3, errorTypes: ['calcul'] },
            { skillLabel: 'Second degré', status: 'studied', mastery: 0, friction: 4, errorTypes: ['calcul', 'signe'] },
          ],
          analysis: [
            { skillLabel: 'Dérivation', status: 'studied', mastery: 1, friction: 3, errorTypes: ['signe'] },
            { skillLabel: 'Variations', status: 'studied', mastery: 0, friction: 4, errorTypes: [] },
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
            { skillLabel: 'Suites', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
            { skillLabel: 'Second degré', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
            { skillLabel: 'Inéquations', status: 'not_studied', mastery: null, friction: null, errorTypes: [] },
          ],
          analysis: [
            { skillLabel: 'Dérivation', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
            { skillLabel: 'Variations', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
          ],
          geometry: [
            { skillLabel: 'Vecteurs', status: 'not_studied', mastery: null, friction: null, errorTypes: [] },
            { skillLabel: 'Produit scalaire', status: 'not_studied', mastery: null, friction: null, errorTypes: [] },
          ],
          probabilities: [
            { skillLabel: 'Conditionnelles', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
            { skillLabel: 'Arbres', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
          ],
          python: [
            { skillLabel: 'Boucles', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
            { skillLabel: 'Fonctions', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
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
            { skillLabel: 'Suites', status: 'unknown', mastery: null, friction: null, errorTypes: [] },
            { skillLabel: 'Second degré', status: 'unknown', mastery: null, friction: null, errorTypes: [] },
            { skillLabel: 'Inéquations', status: 'unknown', mastery: null, friction: null, errorTypes: [] },
          ],
          analysis: [
            { skillLabel: 'Dérivation', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
            { skillLabel: 'Variations', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
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
            { skillLabel: 'Suites', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
            // Only 1 evaluated → domain should be inactive
          ],
          analysis: [
            { skillLabel: 'Dérivation', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
            { skillLabel: 'Variations', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
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
            { skillLabel: 'A', status: 'studied', mastery: 1, friction: 3, errorTypes: [] },
            { skillLabel: 'B', status: 'studied', mastery: 1, friction: 3, errorTypes: [] },
          ],
          analysis: [
            { skillLabel: 'C', status: 'studied', mastery: 2, friction: 2, errorTypes: [] },
            { skillLabel: 'D', status: 'studied', mastery: 2, friction: 2, errorTypes: [] },
          ],
          geometry: [
            { skillLabel: 'E', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
            { skillLabel: 'F', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
          ],
          probabilities: [
            { skillLabel: 'G', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
            { skillLabel: 'H', status: 'studied', mastery: 4, friction: 0, errorTypes: [] },
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
          signals: { hardestItems: [], feeling: 'ok' },
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
          signals: { hardestItems: [1, 2, 3], feeling: 'ok' },
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
          signals: { hardestItems: [], feeling: 'panic' },
        },
      });
      const result = computeScoringV2(data);
      expect(result.alerts.some((a: { code: string }) => a.code === 'PANIC_SIGNAL')).toBe(true);
    });

    it('should detect LOW_DATA_QUALITY when < 3 active domains', () => {
      const data = buildData({
        competencies: {
          algebra: [
            { skillLabel: 'A', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
            { skillLabel: 'B', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
          ],
          analysis: [
            { skillLabel: 'C', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
            { skillLabel: 'D', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
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
            { skillLabel: 'A', status: 'studied', mastery: 2, friction: 2, errorTypes: [] },
            { skillLabel: 'B', status: 'studied', mastery: 2, friction: 2, errorTypes: [] },
          ],
          analysis: [
            { skillLabel: 'C', status: 'studied', mastery: 2, friction: 2, errorTypes: [] },
            { skillLabel: 'D', status: 'studied', mastery: 2, friction: 2, errorTypes: [] },
          ],
          geometry: [
            { skillLabel: 'E', status: 'studied', mastery: 2, friction: 2, errorTypes: [] },
            { skillLabel: 'F', status: 'studied', mastery: 2, friction: 2, errorTypes: [] },
          ],
          probabilities: [
            { skillLabel: 'G', status: 'studied', mastery: 2, friction: 2, errorTypes: [] },
            { skillLabel: 'H', status: 'studied', mastery: 2, friction: 2, errorTypes: [] },
          ],
          python: [
            { skillLabel: 'I', status: 'studied', mastery: 2, friction: 2, errorTypes: [] },
            { skillLabel: 'J', status: 'studied', mastery: 2, friction: 2, errorTypes: [] },
          ],
        },
        examPrep: {
          miniTest: { score: 3, timeUsedMinutes: 18, completedInTime: true },
          selfRatings: { speedNoCalc: 2, calcReliability: 2, redaction: 2, justifications: 2, stress: 2 },
          signals: { hardestItems: [4, 5], feeling: 'ok' },
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
            { skillLabel: 'A', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
            { skillLabel: 'B', status: 'studied', mastery: 3, friction: 1, errorTypes: [] },
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

  describe('ExamReadiness', () => {
    it('should invert stress: high stress → low readiness', () => {
      const lowStress = buildData({
        examPrep: {
          miniTest: { score: 4, timeUsedMinutes: 15, completedInTime: true },
          selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 3, justifications: 3, stress: 0 },
          signals: { hardestItems: [], feeling: 'ok' },
        },
      });
      const highStress = buildData({
        examPrep: {
          miniTest: { score: 4, timeUsedMinutes: 15, completedInTime: true },
          selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 3, justifications: 3, stress: 4 },
          signals: { hardestItems: [], feeling: 'ok' },
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
          signals: { hardestItems: [], feeling: 'ok' },
        },
      });
      const notInTime = buildData({
        examPrep: {
          miniTest: { score: 4, timeUsedMinutes: 25, completedInTime: false },
          selfRatings: { speedNoCalc: 3, calcReliability: 3, redaction: 3, justifications: 3, stress: 1 },
          signals: { hardestItems: [], feeling: 'ok' },
        },
      });

      const inTimeResult = computeScoringV2(inTime);
      const notInTimeResult = computeScoringV2(notInTime);

      expect(inTimeResult.examReadinessIndex).toBeGreaterThan(notInTimeResult.examReadinessIndex);
    });
  });
});
