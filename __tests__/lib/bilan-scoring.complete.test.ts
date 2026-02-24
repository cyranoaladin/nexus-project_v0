/**
 * Bilan Scoring — Complete Test Suite
 *
 * Tests: computeScoring (ReadinessScore, RiskIndex, Recommendation, Alerts)
 *
 * Source: lib/bilan-scoring.ts
 */

import { computeScoring } from '@/lib/bilan-scoring';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCompetency(mastery: number | null, status = 'studied', friction: number | null = null, errorTypes: string[] = []) {
  return {
    skillId: 'sk-1',
    skillLabel: 'Test Skill',
    status,
    mastery,
    friction,
    errorTypes,
    notes: '',
  };
}

function makeMinimalData(overrides: Record<string, any> = {}): any {
  return {
    student: { firstName: 'Ahmed', lastName: 'Ben Ali', email: 'ahmed@test.com', grade: 'terminale', school: 'Lycée Test' },
    competencies: {
      algebra: [makeCompetency(3), makeCompetency(2), makeCompetency(4)],
      analysis: [makeCompetency(3), makeCompetency(3), makeCompetency(2)],
      geometry: [makeCompetency(2), makeCompetency(2)],
      probabilities: [makeCompetency(3), makeCompetency(3)],
      python: [makeCompetency(1), makeCompetency(2)],
    },
    examPrep: {
      miniTest: { score: 4, completedInTime: true },
      selfRatings: { redaction: 3, justifications: 3, stress: 2 },
      signals: { feeling: 'confident' },
    },
    methodology: {
      weeklyWork: '4',
      maxConcentration: '1h',
      tools: ['calculator', 'notebook'],
    },
    ...overrides,
  };
}

// ─── computeScoring — Basic ──────────────────────────────────────────────────

describe('computeScoring — basic', () => {
  it('should return a complete ScoringResult', () => {
    const data = makeMinimalData();
    const result = computeScoring(data);

    expect(result).toHaveProperty('readinessScore');
    expect(result).toHaveProperty('riskIndex');
    expect(result).toHaveProperty('recommendation');
    expect(result).toHaveProperty('recommendationMessage');
    expect(result).toHaveProperty('domainScores');
    expect(result).toHaveProperty('alerts');
    expect(result).toHaveProperty('dataQuality');
  });

  it('should have readinessScore between 0 and 100', () => {
    const result = computeScoring(makeMinimalData());
    expect(result.readinessScore).toBeGreaterThanOrEqual(0);
    expect(result.readinessScore).toBeLessThanOrEqual(100);
  });

  it('should have riskIndex between 0 and 100', () => {
    const result = computeScoring(makeMinimalData());
    expect(result.riskIndex).toBeGreaterThanOrEqual(0);
    expect(result.riskIndex).toBeLessThanOrEqual(100);
  });

  it('should have 5 domain scores', () => {
    const result = computeScoring(makeMinimalData());
    expect(result.domainScores).toHaveLength(5);
  });

  it('should include data quality metrics', () => {
    const result = computeScoring(makeMinimalData());
    expect(result.dataQuality.activeDomains).toBeGreaterThan(0);
    expect(result.dataQuality.evaluatedCompetencies).toBeGreaterThan(0);
    expect(typeof result.dataQuality.lowConfidence).toBe('boolean');
  });
});

// ─── computeScoring — Recommendations ────────────────────────────────────────

describe('computeScoring — recommendations', () => {
  it('should recommend Pallier2_confirmed for high readiness + low risk', () => {
    const data = makeMinimalData({
      competencies: {
        algebra: [makeCompetency(4), makeCompetency(4), makeCompetency(3)],
        analysis: [makeCompetency(4), makeCompetency(3), makeCompetency(4)],
        geometry: [makeCompetency(3), makeCompetency(4)],
        probabilities: [makeCompetency(4), makeCompetency(3)],
        python: [makeCompetency(3), makeCompetency(3)],
      },
      examPrep: {
        miniTest: { score: 5, completedInTime: true },
        selfRatings: { redaction: 3, justifications: 3, stress: 1 },
        signals: { feeling: 'confident' },
      },
    });

    const result = computeScoring(data);
    expect(result.recommendation).toBe('Pallier2_confirmed');
  });

  it('should recommend Pallier1_recommended for low readiness + high risk', () => {
    const data = makeMinimalData({
      competencies: {
        algebra: [makeCompetency(1), makeCompetency(0), makeCompetency(1)],
        analysis: [makeCompetency(0), makeCompetency(1), makeCompetency(0)],
        geometry: [makeCompetency(1), makeCompetency(0)],
        probabilities: [makeCompetency(0), makeCompetency(1)],
        python: [makeCompetency(0), makeCompetency(0)],
      },
      examPrep: {
        miniTest: { score: 1, completedInTime: false },
        selfRatings: { redaction: 1, justifications: 1, stress: 4 },
        signals: { feeling: 'panic' },
      },
    });

    const result = computeScoring(data);
    expect(result.recommendation).toBe('Pallier1_recommended');
  });
});

// ─── computeScoring — Alerts ─────────────────────────────────────────────────

describe('computeScoring — alerts', () => {
  it('should detect HIGH_STRESS when stress >= 3', () => {
    const data = makeMinimalData({
      examPrep: {
        miniTest: { score: 4, completedInTime: true },
        selfRatings: { redaction: 3, justifications: 3, stress: 3 },
        signals: { feeling: 'confident' },
      },
    });

    const result = computeScoring(data);
    expect(result.alerts.some((a) => a.code === 'HIGH_STRESS')).toBe(true);
  });

  it('should detect WEAK_AUTOMATISMS when miniTest score <= 2', () => {
    const data = makeMinimalData({
      examPrep: {
        miniTest: { score: 2, completedInTime: true },
        selfRatings: { redaction: 3, justifications: 3, stress: 1 },
        signals: { feeling: 'confident' },
      },
    });

    const result = computeScoring(data);
    expect(result.alerts.some((a) => a.code === 'WEAK_AUTOMATISMS')).toBe(true);
  });

  it('should detect PANIC_SIGNAL when feeling is panic', () => {
    const data = makeMinimalData({
      examPrep: {
        miniTest: { score: 4, completedInTime: true },
        selfRatings: { redaction: 3, justifications: 3, stress: 1 },
        signals: { feeling: 'panic' },
      },
    });

    const result = computeScoring(data);
    expect(result.alerts.some((a) => a.code === 'PANIC_SIGNAL')).toBe(true);
  });

  it('should detect MULTIPLE_BLOCKAGES when 2+ competencies have friction >= 3', () => {
    const data = makeMinimalData({
      competencies: {
        algebra: [makeCompetency(2, 'studied', 3), makeCompetency(2, 'studied', 4), makeCompetency(3)],
        analysis: [makeCompetency(3), makeCompetency(3), makeCompetency(2)],
        geometry: [makeCompetency(2), makeCompetency(2)],
        probabilities: [makeCompetency(3), makeCompetency(3)],
        python: [makeCompetency(1), makeCompetency(2)],
      },
    });

    const result = computeScoring(data);
    expect(result.alerts.some((a) => a.code === 'MULTIPLE_BLOCKAGES')).toBe(true);
  });

  it('should detect LOW_WORK_VOLUME when weeklyWork < 2h', () => {
    const data = makeMinimalData({
      methodology: { weeklyWork: '1', maxConcentration: '1h', tools: [] },
    });

    const result = computeScoring(data);
    expect(result.alerts.some((a) => a.code === 'LOW_WORK_VOLUME')).toBe(true);
  });

  it('should detect LOW_ENDURANCE when maxConcentration is 30min', () => {
    const data = makeMinimalData({
      methodology: { weeklyWork: '4', maxConcentration: '30min', tools: [] },
    });

    const result = computeScoring(data);
    expect(result.alerts.some((a) => a.code === 'LOW_ENDURANCE')).toBe(true);
  });

  it('should detect LOW_DATA_QUALITY when fewer than 3 active domains', () => {
    const data = makeMinimalData({
      competencies: {
        algebra: [makeCompetency(3), makeCompetency(2)],
        analysis: [makeCompetency(3), makeCompetency(3)],
        geometry: [makeCompetency(null, 'not_studied')],
        probabilities: [makeCompetency(null, 'not_studied')],
        python: [makeCompetency(null, 'not_studied')],
      },
    });

    const result = computeScoring(data);
    expect(result.alerts.some((a) => a.code === 'LOW_DATA_QUALITY')).toBe(true);
    expect(result.dataQuality.lowConfidence).toBe(true);
  });

  it('should not have LOW_DATA_QUALITY when 3+ active domains', () => {
    const result = computeScoring(makeMinimalData());
    expect(result.alerts.some((a) => a.code === 'LOW_DATA_QUALITY')).toBe(false);
    expect(result.dataQuality.lowConfidence).toBe(false);
  });
});

// ─── computeScoring — Domain Scores ──────────────────────────────────────────

describe('computeScoring — domain scores', () => {
  it('should assign high priority to domains with score < 50', () => {
    const data = makeMinimalData({
      competencies: {
        algebra: [makeCompetency(1), makeCompetency(1), makeCompetency(0)],
        analysis: [makeCompetency(3), makeCompetency(3)],
        geometry: [makeCompetency(3), makeCompetency(3)],
        probabilities: [makeCompetency(3), makeCompetency(3)],
        python: [makeCompetency(3), makeCompetency(3)],
      },
    });

    const result = computeScoring(data);
    const algebra = result.domainScores.find((d) => d.domain === 'algebra');
    expect(algebra!.priority).toBe('high');
  });

  it('should assign low priority to domains with score >= 70', () => {
    const data = makeMinimalData({
      competencies: {
        algebra: [makeCompetency(4), makeCompetency(4), makeCompetency(3)],
        analysis: [makeCompetency(3), makeCompetency(3)],
        geometry: [makeCompetency(3), makeCompetency(3)],
        probabilities: [makeCompetency(3), makeCompetency(3)],
        python: [makeCompetency(3), makeCompetency(3)],
      },
    });

    const result = computeScoring(data);
    const algebra = result.domainScores.find((d) => d.domain === 'algebra');
    expect(algebra!.score).toBeGreaterThanOrEqual(70);
    expect(algebra!.priority).toBe('low');
  });

  it('should set score to 0 for domains with < 2 evaluated competencies', () => {
    const data = makeMinimalData({
      competencies: {
        algebra: [makeCompetency(3)], // only 1 evaluated
        analysis: [makeCompetency(3), makeCompetency(3)],
        geometry: [makeCompetency(3), makeCompetency(3)],
        probabilities: [makeCompetency(3), makeCompetency(3)],
        python: [makeCompetency(3), makeCompetency(3)],
      },
    });

    const result = computeScoring(data);
    const algebra = result.domainScores.find((d) => d.domain === 'algebra');
    expect(algebra!.score).toBe(0);
    expect(algebra!.priority).toBe('high');
  });

  it('should identify gaps (mastery <= 1)', () => {
    const data = makeMinimalData({
      competencies: {
        algebra: [makeCompetency(0), makeCompetency(1), makeCompetency(3)],
        analysis: [makeCompetency(3), makeCompetency(3)],
        geometry: [makeCompetency(3), makeCompetency(3)],
        probabilities: [makeCompetency(3), makeCompetency(3)],
        python: [makeCompetency(3), makeCompetency(3)],
      },
    });

    const result = computeScoring(data);
    const algebra = result.domainScores.find((d) => d.domain === 'algebra');
    expect(algebra!.gaps.length).toBeGreaterThan(0);
  });

  it('should identify dominant error types', () => {
    const data = makeMinimalData({
      competencies: {
        algebra: [
          makeCompetency(2, 'studied', null, ['calcul', 'signe']),
          makeCompetency(2, 'studied', null, ['calcul', 'factorisation']),
          makeCompetency(3, 'studied', null, ['calcul']),
        ],
        analysis: [makeCompetency(3), makeCompetency(3)],
        geometry: [makeCompetency(3), makeCompetency(3)],
        probabilities: [makeCompetency(3), makeCompetency(3)],
        python: [makeCompetency(3), makeCompetency(3)],
      },
    });

    const result = computeScoring(data);
    const algebra = result.domainScores.find((d) => d.domain === 'algebra');
    expect(algebra!.dominantErrors).toContain('calcul');
  });
});

// ─── computeScoring — RiskIndex ──────────────────────────────────────────────

describe('computeScoring — riskIndex', () => {
  it('should have lower risk for high miniTest score + completed in time', () => {
    const lowRisk = computeScoring(makeMinimalData({
      examPrep: {
        miniTest: { score: 6, completedInTime: true },
        selfRatings: { redaction: 4, justifications: 4, stress: 1 },
        signals: { feeling: 'confident' },
      },
    }));

    const highRisk = computeScoring(makeMinimalData({
      examPrep: {
        miniTest: { score: 1, completedInTime: false },
        selfRatings: { redaction: 1, justifications: 1, stress: 4 },
        signals: { feeling: 'panic' },
      },
    }));

    expect(lowRisk.riskIndex).toBeLessThan(highRisk.riskIndex);
  });

  it('should increase risk when not completed in time', () => {
    const inTime = computeScoring(makeMinimalData({
      examPrep: {
        miniTest: { score: 4, completedInTime: true },
        selfRatings: { redaction: 3, justifications: 3, stress: 2 },
        signals: { feeling: 'confident' },
      },
    }));

    const notInTime = computeScoring(makeMinimalData({
      examPrep: {
        miniTest: { score: 4, completedInTime: false },
        selfRatings: { redaction: 3, justifications: 3, stress: 2 },
        signals: { feeling: 'confident' },
      },
    }));

    expect(notInTime.riskIndex).toBeGreaterThan(inTime.riskIndex);
  });
});

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('computeScoring — determinism', () => {
  it('should produce identical results for same input', () => {
    const data = makeMinimalData();
    const results = Array.from({ length: 20 }, () => computeScoring(data));
    const scores = results.map((r) => r.readinessScore);
    const risks = results.map((r) => r.riskIndex);
    expect(new Set(scores).size).toBe(1);
    expect(new Set(risks).size).toBe(1);
  });
});
