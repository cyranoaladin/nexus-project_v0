/**
 * ML Predictive Module — Complete Test Suite
 *
 * Tests: predictSSNFromInput, computeStabiliteTrend, computePredictionConfidence,
 *        predictSSNForStudent, MODEL_VERSION
 *
 * Source: lib/core/ml/predictSSN.ts
 */

import {
  predictSSNFromInput,
  computeStabiliteTrend,
  computePredictionConfidence,
  predictSSNForStudent,
  MODEL_VERSION,
} from '@/lib/core/ml/predictSSN';

jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn().mockReturnValue('mock-cuid-id'),
}));

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

// ─── MODEL_VERSION ───────────────────────────────────────────────────────────

describe('MODEL_VERSION', () => {
  it('should be ridge_v1', () => {
    expect(MODEL_VERSION).toBe('ridge_v1');
  });
});

// ─── predictSSNFromInput ─────────────────────────────────────────────────────

describe('predictSSNFromInput', () => {
  it('should compute prediction from input features', () => {
    const result = predictSSNFromInput({
      ssn: 50,
      weeklyHours: 3,
      methodologyScore: 60,
      progressionTrend: 2,
    });
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
  });

  it('should clamp to 0 for very low inputs', () => {
    const result = predictSSNFromInput({
      ssn: 0,
      weeklyHours: 0,
      methodologyScore: 0,
      progressionTrend: -20,
    });
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('should clamp to 100 for very high inputs', () => {
    const result = predictSSNFromInput({
      ssn: 100,
      weeklyHours: 20,
      methodologyScore: 100,
      progressionTrend: 20,
    });
    expect(result).toBeLessThanOrEqual(100);
  });

  it('should increase with higher SSN', () => {
    const low = predictSSNFromInput({ ssn: 30, weeklyHours: 3, methodologyScore: 50, progressionTrend: 0 });
    const high = predictSSNFromInput({ ssn: 80, weeklyHours: 3, methodologyScore: 50, progressionTrend: 0 });
    expect(high).toBeGreaterThan(low);
  });

  it('should increase with more study hours', () => {
    const low = predictSSNFromInput({ ssn: 50, weeklyHours: 1, methodologyScore: 50, progressionTrend: 0 });
    const high = predictSSNFromInput({ ssn: 50, weeklyHours: 10, methodologyScore: 50, progressionTrend: 0 });
    expect(high).toBeGreaterThan(low);
  });

  it('should increase with positive trend', () => {
    const neg = predictSSNFromInput({ ssn: 50, weeklyHours: 3, methodologyScore: 50, progressionTrend: -5 });
    const pos = predictSSNFromInput({ ssn: 50, weeklyHours: 3, methodologyScore: 50, progressionTrend: 5 });
    expect(pos).toBeGreaterThan(neg);
  });

  it('should be deterministic', () => {
    const input = { ssn: 60, weeklyHours: 4, methodologyScore: 70, progressionTrend: 3 };
    const results = Array.from({ length: 50 }, () => predictSSNFromInput(input));
    expect(new Set(results).size).toBe(1);
  });
});

// ─── computeStabiliteTrend ───────────────────────────────────────────────────

describe('computeStabiliteTrend', () => {
  it('should return 50 for fewer than 3 data points', () => {
    expect(computeStabiliteTrend([])).toBe(50);
    expect(computeStabiliteTrend([50])).toBe(50);
    expect(computeStabiliteTrend([50, 55])).toBe(50);
  });

  it('should return high score for consistently increasing values', () => {
    const score = computeStabiliteTrend([40, 45, 50, 55, 60]);
    expect(score).toBeGreaterThan(70);
  });

  it('should return high score for consistently decreasing values', () => {
    const score = computeStabiliteTrend([60, 55, 50, 45, 40]);
    expect(score).toBeGreaterThan(70);
  });

  it('should return lower score for oscillating values', () => {
    const score = computeStabiliteTrend([50, 60, 40, 70, 30]);
    expect(score).toBeLessThan(50);
  });

  it('should return high score for stable values', () => {
    const score = computeStabiliteTrend([50, 50, 50, 50]);
    // All deltas are 0, so sign consistency is high
    expect(score).toBeGreaterThanOrEqual(50);
  });

  it('should be between 0 and 100', () => {
    const histories = [
      [10, 20, 30, 40, 50],
      [50, 40, 30, 20, 10],
      [50, 60, 40, 70, 30],
      [50, 50, 50, 50, 50],
    ];
    histories.forEach((h) => {
      const score = computeStabiliteTrend(h);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});

// ─── computePredictionConfidence ─────────────────────────────────────────────

describe('computePredictionConfidence', () => {
  it('should return confidence between 0 and 100', () => {
    const { confidence } = computePredictionConfidence(3, [50, 55, 60]);
    expect(confidence).toBeGreaterThanOrEqual(0);
    expect(confidence).toBeLessThanOrEqual(100);
  });

  it('should increase confidence with more assessments', () => {
    const { confidence: low } = computePredictionConfidence(1, [50]);
    const { confidence: high } = computePredictionConfidence(5, [50, 52, 54, 56, 58]);
    expect(high).toBeGreaterThan(low);
  });

  it('should have higher confidence for stable history', () => {
    const { confidence: stable } = computePredictionConfidence(5, [50, 51, 50, 51, 50]);
    const { confidence: volatile } = computePredictionConfidence(5, [30, 70, 20, 80, 40]);
    expect(stable).toBeGreaterThan(volatile);
  });

  it('should return breakdown components', () => {
    const { breakdown } = computePredictionConfidence(3, [50, 55, 60]);
    expect(typeof breakdown.bilansNorm).toBe('number');
    expect(typeof breakdown.stabiliteTrend).toBe('number');
    expect(typeof breakdown.dispersionInverse).toBe('number');
  });

  it('should have bilansNorm=100 for 5+ assessments', () => {
    const { breakdown } = computePredictionConfidence(5, [50, 55, 60, 65, 70]);
    expect(breakdown.bilansNorm).toBe(100);
  });

  it('should have bilansNorm=20 for 1 assessment', () => {
    const { breakdown } = computePredictionConfidence(1, [50]);
    expect(breakdown.bilansNorm).toBe(20);
  });

  it('should have high dispersionInverse for low std', () => {
    const { breakdown } = computePredictionConfidence(5, [50, 50, 50, 50, 50]);
    expect(breakdown.dispersionInverse).toBe(100);
  });
});

// ─── predictSSNForStudent ────────────────────────────────────────────────────

describe('predictSSNForStudent', () => {
  it('should return null when no history exists', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    const result = await predictSSNForStudent('stu-1');
    expect(result).toBeNull();
  });

  it('should return prediction for student with history', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { ssn: 45, date: new Date('2026-01-01') },
      { ssn: 50, date: new Date('2026-02-01') },
      { ssn: 55, date: new Date('2026-03-01') },
    ]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    const result = await predictSSNForStudent('stu-1', 4, 70);

    expect(result).not.toBeNull();
    expect(result!.ssnProjected).toBeGreaterThanOrEqual(0);
    expect(result!.ssnProjected).toBeLessThanOrEqual(100);
    expect(result!.confidence).toBeGreaterThanOrEqual(0);
    expect(result!.confidence).toBeLessThanOrEqual(100);
    expect(result!.modelVersion).toBe('ridge_v1');
  });

  it('should persist projection to projection_history', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { ssn: 50, date: new Date('2026-01-01') },
    ]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    await predictSSNForStudent('stu-1');

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "projection_history"'),
      expect.any(String),
      'stu-1',
      expect.any(Number),
      expect.any(Number),
      'ridge_v1',
      expect.any(String),
      expect.any(Date)
    );
  });

  it('should use default weeklyHours=3 when not provided', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { ssn: 50, date: new Date('2026-01-01') },
    ]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    const result = await predictSSNForStudent('stu-1');

    expect(result!.inputSnapshot.weeklyHours).toBe(3);
  });

  it('should use default methodologyScore=50 when not provided', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { ssn: 50, date: new Date('2026-01-01') },
    ]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    const result = await predictSSNForStudent('stu-1');

    expect(result!.inputSnapshot.methodologyScore).toBe(50);
  });

  it('should include confidence breakdown', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { ssn: 45, date: new Date('2026-01-01') },
      { ssn: 50, date: new Date('2026-02-01') },
      { ssn: 55, date: new Date('2026-03-01') },
    ]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    const result = await predictSSNForStudent('stu-1');

    expect(result!.confidenceBreakdown).toBeDefined();
    expect(typeof result!.confidenceBreakdown.bilansNorm).toBe('number');
    expect(typeof result!.confidenceBreakdown.stabiliteTrend).toBe('number');
    expect(typeof result!.confidenceBreakdown.dispersionInverse).toBe('number');
  });
});
