/**
 * ML Predictive Module — SSN Projection Engine — Complete Test Suite
 *
 * Tests: predictSSNFromInput, computeStabiliteTrend, computePredictionConfidence,
 *        MODEL_VERSION, BETA coefficients behavior
 *
 * Source: lib/core/ml/predictSSN.ts
 */

import {
  predictSSNFromInput,
  computeStabiliteTrend,
  computePredictionConfidence,
  MODEL_VERSION,
  type PredictionInput,
} from '@/lib/core/ml/predictSSN';

// ─── predictSSNFromInput ─────────────────────────────────────────────────────

describe('predictSSNFromInput', () => {
  it('should predict upward for student with high SSN, hours, methodology, and positive trend', () => {
    // Arrange
    const input: PredictionInput = {
      ssn: 70,
      weeklyHours: 5,
      methodologyScore: 80,
      progressionTrend: 10,
    };

    // Act
    const predicted = predictSSNFromInput(input);

    // Assert: 5 + 0.6*70 + 1.2*5 + 0.3*80 + 0.8*10 = 5+42+6+24+8 = 85
    expect(predicted).toBeCloseTo(85, 0);
    expect(predicted).toBeGreaterThan(input.ssn);
  });

  it('should predict downward for student with declining trend', () => {
    // Arrange
    const input: PredictionInput = {
      ssn: 50,
      weeklyHours: 1,
      methodologyScore: 30,
      progressionTrend: -15,
    };

    // Act
    const predicted = predictSSNFromInput(input);

    // Assert: 5 + 0.6*50 + 1.2*1 + 0.3*30 + 0.8*(-15) = 5+30+1.2+9-12 = 33.2
    expect(predicted).toBeCloseTo(33.2, 0);
    expect(predicted).toBeLessThan(input.ssn);
  });

  it('should clamp prediction to [0, 100] range — lower bound', () => {
    // Arrange: extremely negative inputs
    const input: PredictionInput = {
      ssn: 0,
      weeklyHours: 0,
      methodologyScore: 0,
      progressionTrend: -20,
    };

    // Act
    const predicted = predictSSNFromInput(input);

    // Assert: 5 + 0 + 0 + 0 + 0.8*(-20) = 5 - 16 = -11 → clamped to 0
    expect(predicted).toBe(0);
  });

  it('should clamp prediction to [0, 100] range — upper bound', () => {
    // Arrange: extremely high inputs
    const input: PredictionInput = {
      ssn: 100,
      weeklyHours: 20,
      methodologyScore: 100,
      progressionTrend: 20,
    };

    // Act
    const predicted = predictSSNFromInput(input);

    // Assert: 5 + 60 + 24 + 30 + 16 = 135 → clamped to 100
    expect(predicted).toBe(100);
  });

  it('should handle zero inputs gracefully', () => {
    // Arrange
    const input: PredictionInput = {
      ssn: 0,
      weeklyHours: 0,
      methodologyScore: 0,
      progressionTrend: 0,
    };

    // Act
    const predicted = predictSSNFromInput(input);

    // Assert: 5 + 0 + 0 + 0 + 0 = 5
    expect(predicted).toBe(5);
  });

  it('should be deterministic for identical inputs', () => {
    // Arrange
    const input: PredictionInput = {
      ssn: 65,
      weeklyHours: 3,
      methodologyScore: 55,
      progressionTrend: 5,
    };

    // Act
    const p1 = predictSSNFromInput(input);
    const p2 = predictSSNFromInput(input);

    // Assert
    expect(p1).toBe(p2);
  });
});

// ─── computeStabiliteTrend ───────────────────────────────────────────────────

describe('computeStabiliteTrend', () => {
  it('should return 50 (neutral) when fewer than 3 data points', () => {
    expect(computeStabiliteTrend([])).toBe(50);
    expect(computeStabiliteTrend([50])).toBe(50);
    expect(computeStabiliteTrend([50, 55])).toBe(50);
  });

  it('should return high stability for consistently improving scores', () => {
    // Arrange: monotonically increasing
    const history = [40, 50, 60, 70, 80];

    // Act
    const stability = computeStabiliteTrend(history);

    // Assert: all deltas positive and similar magnitude → high stability
    expect(stability).toBeGreaterThan(70);
  });

  it('should return high stability for consistently declining scores', () => {
    // Arrange: monotonically decreasing
    const history = [80, 70, 60, 50, 40];

    // Act
    const stability = computeStabiliteTrend(history);

    // Assert: all deltas negative and similar magnitude → high stability
    expect(stability).toBeGreaterThan(70);
  });

  it('should return low stability for oscillating scores', () => {
    // Arrange: zigzag pattern
    const history = [40, 80, 40, 80, 40];

    // Act
    const stability = computeStabiliteTrend(history);

    // Assert: alternating direction → low direction consistency
    expect(stability).toBeLessThan(50);
  });

  it('should handle all-identical scores (flat trend)', () => {
    // Arrange
    const history = [60, 60, 60, 60, 60];

    // Act
    const stability = computeStabiliteTrend(history);

    // Assert: all deltas = 0, sign(0) === sign(0) → consistent direction
    // amplitude: 0/0 → 1 (maxAB === 0 case)
    expect(stability).toBeGreaterThanOrEqual(50);
  });

  it('should return value in [0, 100] range', () => {
    // Arrange
    const testCases = [
      [10, 90, 10, 90, 10],
      [50, 51, 52, 53, 54],
      [100, 0, 100, 0, 100],
      [30, 30, 30, 30, 30],
    ];

    // Act / Assert
    testCases.forEach((history) => {
      const stability = computeStabiliteTrend(history);
      expect(stability).toBeGreaterThanOrEqual(0);
      expect(stability).toBeLessThanOrEqual(100);
    });
  });
});

// ─── computePredictionConfidence ─────────────────────────────────────────────

describe('computePredictionConfidence', () => {
  it('should return higher confidence with more assessments', () => {
    // Arrange
    const history = [50, 55, 60, 65, 70];

    // Act
    const { confidence: conf5 } = computePredictionConfidence(5, history);
    const { confidence: conf1 } = computePredictionConfidence(1, [50]);

    // Assert
    expect(conf5).toBeGreaterThan(conf1);
  });

  it('should return max bilansNorm (100) for 5+ assessments', () => {
    // Arrange
    const history = [50, 55, 60, 65, 70];

    // Act
    const { breakdown } = computePredictionConfidence(5, history);

    // Assert
    expect(breakdown.bilansNorm).toBe(100);
  });

  it('should return bilansNorm=20 for 1 assessment', () => {
    // Arrange / Act
    const { breakdown } = computePredictionConfidence(1, [50]);

    // Assert
    expect(breakdown.bilansNorm).toBe(20);
  });

  it('should return high dispersionInverse for low-variance scores', () => {
    // Arrange: very consistent scores
    const history = [60, 61, 60, 61, 60];

    // Act
    const { breakdown } = computePredictionConfidence(5, history);

    // Assert: std ≈ 0.5, dispersionInverse = 100 - 0.5*4 = 98
    expect(breakdown.dispersionInverse).toBeGreaterThan(90);
  });

  it('should return low dispersionInverse for high-variance scores', () => {
    // Arrange: wildly varying scores
    const history = [10, 90, 10, 90, 10];

    // Act
    const { breakdown } = computePredictionConfidence(5, history);

    // Assert: std ≈ 40, dispersionInverse = max(0, 100 - 40*4) = 0
    expect(breakdown.dispersionInverse).toBeLessThanOrEqual(10);
  });

  it('should clamp confidence to [0, 100]', () => {
    // Arrange
    const testCases = [
      { count: 0, history: [] as number[] },
      { count: 10, history: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50] },
      { count: 1, history: [10, 90, 10] },
    ];

    // Act / Assert
    testCases.forEach(({ count, history }) => {
      const { confidence } = computePredictionConfidence(count, history);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(100);
    });
  });

  it('should include all three breakdown components', () => {
    // Arrange / Act
    const { breakdown } = computePredictionConfidence(3, [50, 55, 60]);

    // Assert
    expect(breakdown).toHaveProperty('bilansNorm');
    expect(breakdown).toHaveProperty('stabiliteTrend');
    expect(breakdown).toHaveProperty('dispersionInverse');
  });
});

// ─── MODEL_VERSION ───────────────────────────────────────────────────────────

describe('MODEL_VERSION', () => {
  it('should be a non-empty string', () => {
    expect(typeof MODEL_VERSION).toBe('string');
    expect(MODEL_VERSION.length).toBeGreaterThan(0);
  });

  it('should be "ridge_v1"', () => {
    expect(MODEL_VERSION).toBe('ridge_v1');
  });
});
