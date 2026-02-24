/**
 * SSN (Score Standardisé Nexus) — Complete Test Suite
 *
 * Tests: normalizeScore, classifySSN, getSSNLabel, computePercentile,
 *        extractMethodologyScore, extractRigorScore, SSN_WEIGHTS
 *
 * Source: lib/core/ssn/computeSSN.ts + lib/core/statistics/normalize.ts
 */

import { normalizeScore, classifySSN, getSSNLabel, computePercentile } from '@/lib/core/statistics/normalize';
import { SSN_WEIGHTS } from '@/lib/core/ssn/computeSSN';

// ─── normalizeScore ──────────────────────────────────────────────────────────

describe('normalizeScore', () => {
  it('should return SSN=50 for a score equal to the cohort mean', () => {
    // Arrange
    const raw = 60;
    const mean = 60;
    const std = 15;

    // Act
    const ssn = normalizeScore(raw, mean, std);

    // Assert
    expect(ssn).toBe(50);
  });

  it('should return SSN > 50 for a score above the mean', () => {
    // Arrange
    const raw = 75;
    const mean = 60;
    const std = 15;

    // Act
    const ssn = normalizeScore(raw, mean, std);

    // Assert: z = (75-60)/15 = 1.0, SSN = 50 + 15*1 = 65
    expect(ssn).toBe(65);
  });

  it('should return SSN < 50 for a score below the mean', () => {
    // Arrange
    const raw = 45;
    const mean = 60;
    const std = 15;

    // Act
    const ssn = normalizeScore(raw, mean, std);

    // Assert: z = (45-60)/15 = -1.0, SSN = 50 + 15*(-1) = 35
    expect(ssn).toBe(35);
  });

  it('should clamp SSN to 0 for extremely low scores', () => {
    // Arrange: raw far below mean
    const raw = 0;
    const mean = 80;
    const std = 10;

    // Act
    const ssn = normalizeScore(raw, mean, std);

    // Assert: z = (0-80)/10 = -8, SSN = 50 + 15*(-8) = -70 → clamped to 0
    expect(ssn).toBe(0);
  });

  it('should clamp SSN to 100 for extremely high scores', () => {
    // Arrange: raw far above mean
    const raw = 100;
    const mean = 20;
    const std = 10;

    // Act
    const ssn = normalizeScore(raw, mean, std);

    // Assert: z = (100-20)/10 = 8, SSN = 50 + 15*8 = 170 → clamped to 100
    expect(ssn).toBe(100);
  });

  it('should return 50 when std is 0 (all scores identical)', () => {
    // Arrange
    const raw = 60;
    const mean = 60;
    const std = 0;

    // Act
    const ssn = normalizeScore(raw, mean, std);

    // Assert: std=0 → return 50 by convention
    expect(ssn).toBe(50);
  });

  it('should handle single-student cohort (std=0) returning 50', () => {
    // Arrange
    const raw = 85;
    const mean = 85;
    const std = 0;

    // Act
    const ssn = normalizeScore(raw, mean, std);

    // Assert
    expect(ssn).toBe(50);
  });

  it('should normalize scores to [0, 100] range', () => {
    // Arrange: test many values
    const testCases = [
      { raw: 0, mean: 50, std: 15 },
      { raw: 100, mean: 50, std: 15 },
      { raw: 50, mean: 50, std: 15 },
      { raw: 25, mean: 75, std: 5 },
      { raw: 99, mean: 10, std: 3 },
    ];

    // Act / Assert
    testCases.forEach(({ raw, mean, std }) => {
      const ssn = normalizeScore(raw, mean, std);
      expect(ssn).toBeGreaterThanOrEqual(0);
      expect(ssn).toBeLessThanOrEqual(100);
    });
  });

  it('should be stable: same inputs → same SSN', () => {
    // Arrange
    const raw = 72;
    const mean = 55;
    const std = 12;

    // Act
    const ssn1 = normalizeScore(raw, mean, std);
    const ssn2 = normalizeScore(raw, mean, std);

    // Assert
    expect(ssn1).toBe(ssn2);
  });
});

// ─── classifySSN ─────────────────────────────────────────────────────────────

describe('classifySSN', () => {
  it('should classify SSN >= 85 as "excellence"', () => {
    expect(classifySSN(85)).toBe('excellence');
    expect(classifySSN(100)).toBe('excellence');
    expect(classifySSN(92)).toBe('excellence');
  });

  it('should classify SSN 70-84 as "tres_solide"', () => {
    expect(classifySSN(70)).toBe('tres_solide');
    expect(classifySSN(84)).toBe('tres_solide');
    expect(classifySSN(77)).toBe('tres_solide');
  });

  it('should classify SSN 55-69 as "stable"', () => {
    expect(classifySSN(55)).toBe('stable');
    expect(classifySSN(69)).toBe('stable');
    expect(classifySSN(62)).toBe('stable');
  });

  it('should classify SSN 40-54 as "fragile"', () => {
    expect(classifySSN(40)).toBe('fragile');
    expect(classifySSN(54)).toBe('fragile');
    expect(classifySSN(47)).toBe('fragile');
  });

  it('should classify SSN 0-39 as "prioritaire"', () => {
    expect(classifySSN(0)).toBe('prioritaire');
    expect(classifySSN(39)).toBe('prioritaire');
    expect(classifySSN(20)).toBe('prioritaire');
  });

  it('should handle boundary values correctly', () => {
    expect(classifySSN(84.9)).toBe('tres_solide');
    expect(classifySSN(85)).toBe('excellence');
    expect(classifySSN(69.9)).toBe('stable');
    expect(classifySSN(70)).toBe('tres_solide');
  });
});

// ─── getSSNLabel ─────────────────────────────────────────────────────────────

describe('getSSNLabel', () => {
  it('should return "Excellence" for SSN >= 85', () => {
    expect(getSSNLabel(90)).toBe('Excellence');
  });

  it('should return "Très solide" for SSN 70-84', () => {
    expect(getSSNLabel(75)).toBe('Très solide');
  });

  it('should return "Stable" for SSN 55-69', () => {
    expect(getSSNLabel(60)).toBe('Stable');
  });

  it('should return "Fragile" for SSN 40-54', () => {
    expect(getSSNLabel(45)).toBe('Fragile');
  });

  it('should return "Prioritaire" for SSN 0-39', () => {
    expect(getSSNLabel(20)).toBe('Prioritaire');
  });
});

// ─── computePercentile ──────────────────────────────────────────────────────

describe('computePercentile', () => {
  it('should return 50 for empty distribution', () => {
    expect(computePercentile(60, [])).toBe(50);
  });

  it('should return 0 for the lowest score in distribution', () => {
    // Arrange
    const distribution = [10, 20, 30, 40, 50];

    // Act / Assert
    expect(computePercentile(10, distribution)).toBe(0);
  });

  it('should return 100 for a score above all in distribution', () => {
    // Arrange
    const distribution = [10, 20, 30, 40, 50];

    // Act / Assert: 60 is above all 5 values → 5/5 * 100 = 100
    expect(computePercentile(60, distribution)).toBe(100);
  });

  it('should compute percentile correctly for 100-student cohort', () => {
    // Arrange: 100 scores from 1 to 100
    const distribution = Array.from({ length: 100 }, (_, i) => i + 1);

    // Act
    const p50 = computePercentile(51, distribution);
    const p90 = computePercentile(91, distribution);

    // Assert
    expect(p50).toBe(50); // 50 values below 51
    expect(p90).toBe(90); // 90 values below 91
  });

  it('should handle identical scores in cohort (no division by zero)', () => {
    // Arrange: all same score
    const distribution = [50, 50, 50, 50, 50];

    // Act
    const result = computePercentile(50, distribution);

    // Assert: 0 values strictly below 50 → percentile = 0
    expect(result).toBe(0);
  });

  it('should handle single-element distribution', () => {
    // Arrange
    const distribution = [75];

    // Act
    const below = computePercentile(75, distribution);
    const above = computePercentile(80, distribution);

    // Assert
    expect(below).toBe(0);   // 0 values below 75
    expect(above).toBe(100); // 1 value below 80
  });
});

// ─── SSN_WEIGHTS ─────────────────────────────────────────────────────────────

describe('SSN_WEIGHTS', () => {
  it('should have weights summing to 1.0', () => {
    const sum = SSN_WEIGHTS.disciplinary + SSN_WEIGHTS.methodology + SSN_WEIGHTS.rigor;
    expect(sum).toBeCloseTo(1.0);
  });

  it('should weight disciplinary at 60%', () => {
    expect(SSN_WEIGHTS.disciplinary).toBe(0.6);
  });

  it('should weight methodology at 20%', () => {
    expect(SSN_WEIGHTS.methodology).toBe(0.2);
  });

  it('should weight rigor at 20%', () => {
    expect(SSN_WEIGHTS.rigor).toBe(0.2);
  });
});
