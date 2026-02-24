/**
 * UAI (Unified Academic Index) — Complete Test Suite
 *
 * Tests: computeUAI, DEFAULT_UAI_WEIGHTS
 *
 * Source: lib/core/uai/computeUAI.ts
 */

import { computeUAI, DEFAULT_UAI_WEIGHTS, type UAIWeights } from '@/lib/core/uai/computeUAI';

// ─── computeUAI ──────────────────────────────────────────────────────────────

describe('computeUAI', () => {
  it('should compute UAI as weighted combination of SSN values', () => {
    // Arrange
    const ssnBySubject = { MATHS: 80, NSI: 60 };

    // Act
    const result = computeUAI(ssnBySubject);

    // Assert: UAI = 0.6*80 + 0.4*60 = 48 + 24 = 72
    expect(result).not.toBeNull();
    expect(result!.uai).toBeCloseTo(72, 0);
  });

  it('should return UAI in [0, 100] range', () => {
    // Arrange: extreme values
    const testCases = [
      { MATHS: 0, NSI: 0 },
      { MATHS: 100, NSI: 100 },
      { MATHS: 100, NSI: 0 },
      { MATHS: 0, NSI: 100 },
    ];

    // Act / Assert
    testCases.forEach((ssnBySubject) => {
      const result = computeUAI(ssnBySubject);
      expect(result).not.toBeNull();
      expect(result!.uai).toBeGreaterThanOrEqual(0);
      expect(result!.uai).toBeLessThanOrEqual(100);
    });
  });

  it('should return null when no valid SSN values provided', () => {
    // Arrange
    const ssnBySubject: Record<string, number> = {};

    // Act
    const result = computeUAI(ssnBySubject);

    // Assert
    expect(result).toBeNull();
  });

  it('should filter out NaN values from subjects', () => {
    // Arrange
    const ssnBySubject = { MATHS: 80, NSI: NaN };

    // Act
    const result = computeUAI(ssnBySubject);

    // Assert: only MATHS used, weight normalized to 1.0
    expect(result).not.toBeNull();
    expect(result!.subjectCount).toBe(1);
    expect(result!.uai).toBeCloseTo(80, 0);
  });

  it('should normalize weights when only one subject is available', () => {
    // Arrange: only MATHS
    const ssnBySubject = { MATHS: 75 };

    // Act
    const result = computeUAI(ssnBySubject);

    // Assert: weight normalized to 1.0, UAI = 75
    expect(result).not.toBeNull();
    expect(result!.uai).toBeCloseTo(75, 0);
    expect(result!.subjectCount).toBe(1);
  });

  it('should use equal weights for subjects not in default config', () => {
    // Arrange: unknown subject
    const ssnBySubject = { PHYSIQUE: 70, CHIMIE: 80 };

    // Act
    const result = computeUAI(ssnBySubject);

    // Assert: equal weights (0.5 each) → UAI = 0.5*70 + 0.5*80 = 75
    expect(result).not.toBeNull();
    expect(result!.uai).toBeCloseTo(75, 0);
  });

  it('should accept custom weights', () => {
    // Arrange
    const ssnBySubject = { MATHS: 80, NSI: 60 };
    const customWeights: UAIWeights = { MATHS: 0.5, NSI: 0.5 };

    // Act
    const result = computeUAI(ssnBySubject, customWeights);

    // Assert: UAI = 0.5*80 + 0.5*60 = 70
    expect(result).not.toBeNull();
    expect(result!.uai).toBeCloseTo(70, 0);
  });

  it('should include component breakdown in result', () => {
    // Arrange
    const ssnBySubject = { MATHS: 80, NSI: 60 };

    // Act
    const result = computeUAI(ssnBySubject);

    // Assert
    expect(result).not.toBeNull();
    expect(result!.components).toHaveLength(2);
    expect(result!.components.find((c) => c.subject === 'MATHS')).toBeDefined();
    expect(result!.components.find((c) => c.subject === 'NSI')).toBeDefined();
  });

  it('should give higher UAI when both subjects are high', () => {
    // Arrange
    const highSSN = { MATHS: 90, NSI: 85 };
    const lowSSN = { MATHS: 40, NSI: 35 };

    // Act
    const highResult = computeUAI(highSSN);
    const lowResult = computeUAI(lowSSN);

    // Assert
    expect(highResult!.uai).toBeGreaterThan(lowResult!.uai);
  });

  it('should handle three or more subjects correctly', () => {
    // Arrange
    const ssnBySubject = { MATHS: 80, NSI: 60, PHYSIQUE: 70 };
    const weights: UAIWeights = { MATHS: 0.4, NSI: 0.3, PHYSIQUE: 0.3 };

    // Act
    const result = computeUAI(ssnBySubject, weights);

    // Assert: UAI = 0.4*80 + 0.3*60 + 0.3*70 = 32 + 18 + 21 = 71
    expect(result).not.toBeNull();
    expect(result!.uai).toBeCloseTo(71, 0);
    expect(result!.subjectCount).toBe(3);
  });
});

// ─── DEFAULT_UAI_WEIGHTS ─────────────────────────────────────────────────────

describe('DEFAULT_UAI_WEIGHTS', () => {
  it('should weight MATHS at 60%', () => {
    expect(DEFAULT_UAI_WEIGHTS.MATHS).toBe(0.60);
  });

  it('should weight NSI at 40%', () => {
    expect(DEFAULT_UAI_WEIGHTS.NSI).toBe(0.40);
  });

  it('should have weights summing to 1.0', () => {
    const sum = Object.values(DEFAULT_UAI_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });
});
