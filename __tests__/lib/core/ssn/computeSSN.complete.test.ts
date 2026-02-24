/**
 * SSN Orchestrator — Complete Test Suite
 *
 * Tests: computeSSNForAssessment, computeAndPersistSSN, recomputeSSNBatch, SSN_WEIGHTS
 *
 * Source: lib/core/ssn/computeSSN.ts
 */

import {
  computeSSNForAssessment,
  computeAndPersistSSN,
  recomputeSSNBatch,
  SSN_WEIGHTS,
} from '@/lib/core/ssn/computeSSN';

jest.mock('@/lib/core/statistics/cohort', () => ({
  computeCohortStats: jest.fn().mockResolvedValue({ mean: 50, std: 15, sampleSize: 100 }),
}));

jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn().mockReturnValue('mock-cuid-id'),
}));

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

// ─── SSN_WEIGHTS ─────────────────────────────────────────────────────────────

describe('SSN_WEIGHTS', () => {
  it('should have disciplinary weight of 0.6', () => {
    expect(SSN_WEIGHTS.disciplinary).toBe(0.6);
  });

  it('should have methodology weight of 0.2', () => {
    expect(SSN_WEIGHTS.methodology).toBe(0.2);
  });

  it('should have rigor weight of 0.2', () => {
    expect(SSN_WEIGHTS.rigor).toBe(0.2);
  });

  it('should sum to 1.0', () => {
    const sum = SSN_WEIGHTS.disciplinary + SSN_WEIGHTS.methodology + SSN_WEIGHTS.rigor;
    expect(sum).toBeCloseTo(1.0);
  });
});

// ─── computeSSNForAssessment ─────────────────────────────────────────────────

describe('computeSSNForAssessment', () => {
  it('should return null when assessment not found', async () => {
    prisma.assessment.findUnique.mockResolvedValue(null);

    const result = await computeSSNForAssessment('nonexistent');
    expect(result).toBeNull();
  });

  it('should return null when globalScore is null', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      subject: 'MATHS',
      globalScore: null,
      confidenceIndex: 80,
      scoringResult: null,
    });

    const result = await computeSSNForAssessment('assess-1');
    expect(result).toBeNull();
  });

  it('should compute SSN for valid assessment', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      subject: 'MATHS',
      globalScore: 70,
      confidenceIndex: 80,
      scoringResult: null,
    });

    const result = await computeSSNForAssessment('assess-1');

    expect(result).not.toBeNull();
    expect(result!.ssn).toBeGreaterThanOrEqual(0);
    expect(result!.ssn).toBeLessThanOrEqual(100);
    expect(result!.components.disciplinary).toBe(70);
    expect(result!.level).toBeDefined();
  });

  it('should use confidenceIndex as methodology fallback', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      subject: 'MATHS',
      globalScore: 60,
      confidenceIndex: 75,
      scoringResult: null,
    });

    const result = await computeSSNForAssessment('assess-1');

    expect(result!.components.methodology).toBe(75);
  });

  it('should use 50 as default when no confidenceIndex', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      subject: 'MATHS',
      globalScore: 60,
      confidenceIndex: null,
      scoringResult: null,
    });

    const result = await computeSSNForAssessment('assess-1');

    expect(result!.components.methodology).toBe(50);
    expect(result!.components.rigor).toBe(50);
  });

  it('should extract rigor from precisionIndex in scoringResult', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      subject: 'MATHS',
      globalScore: 60,
      confidenceIndex: 80,
      scoringResult: { precisionIndex: 85 },
    });

    const result = await computeSSNForAssessment('assess-1');

    expect(result!.components.rigor).toBe(85);
  });

  it('should include cohort stats in result', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      subject: 'MATHS',
      globalScore: 60,
      confidenceIndex: 80,
      scoringResult: null,
    });

    const result = await computeSSNForAssessment('assess-1');

    expect(result!.cohort.mean).toBe(50);
    expect(result!.cohort.std).toBe(15);
    expect(result!.cohort.sampleSize).toBe(100);
  });

  it('should compute rawComposite correctly', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      subject: 'MATHS',
      globalScore: 80,
      confidenceIndex: 70,
      scoringResult: { precisionIndex: 90 },
    });

    const result = await computeSSNForAssessment('assess-1');

    // rawComposite = 0.6*80 + 0.2*70 + 0.2*90 = 48 + 14 + 18 = 80
    expect(result!.rawComposite).toBe(80);
  });

  it('should extract methodology from categoryScores if available', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      subject: 'GENERAL',
      globalScore: 60,
      confidenceIndex: 70,
      scoringResult: {
        metrics: {
          categoryScores: {
            'Méthodologie': 85,
            'Algèbre': 60,
          },
        },
      },
    });

    const result = await computeSSNForAssessment('assess-1');

    expect(result!.components.methodology).toBe(85);
  });
});

// ─── computeAndPersistSSN ────────────────────────────────────────────────────

describe('computeAndPersistSSN', () => {
  it('should return null when assessment not found', async () => {
    prisma.assessment.findUnique.mockResolvedValue(null);

    const result = await computeAndPersistSSN('nonexistent');
    expect(result).toBeNull();
  });

  it('should persist SSN via raw SQL', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      subject: 'MATHS',
      globalScore: 70,
      confidenceIndex: 80,
      scoringResult: null,
    });
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.$queryRawUnsafe.mockResolvedValue([{ studentId: null }]);

    const result = await computeAndPersistSSN('assess-1');

    expect(result).not.toBeNull();
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE'),
      expect.any(Number),
      'assess-1'
    );
  });

  it('should create progression history when studentId exists', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      subject: 'MATHS',
      globalScore: 70,
      confidenceIndex: 80,
      scoringResult: null,
    });
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.$queryRawUnsafe.mockResolvedValue([{ studentId: 'stu-1' }]);

    await computeAndPersistSSN('assess-1');

    // Should have 2 $executeRawUnsafe calls: UPDATE + INSERT
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "progression_history"'),
      expect.any(String),
      'stu-1',
      expect.any(Number),
      expect.any(Date)
    );
  });

  it('should not create progression history when no studentId', async () => {
    prisma.assessment.findUnique.mockResolvedValue({
      subject: 'MATHS',
      globalScore: 70,
      confidenceIndex: 80,
      scoringResult: null,
    });
    prisma.$executeRawUnsafe.mockResolvedValue(1);
    prisma.$queryRawUnsafe.mockResolvedValue([{ studentId: null }]);

    await computeAndPersistSSN('assess-1');

    // Only 1 $executeRawUnsafe call: UPDATE (no INSERT)
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
  });
});

// ─── recomputeSSNBatch ───────────────────────────────────────────────────────

describe('recomputeSSNBatch', () => {
  it('should return 0 updated when no assessments found', async () => {
    prisma.assessment.findMany.mockResolvedValue([]);

    const result = await recomputeSSNBatch('MATHS');

    expect(result.updated).toBe(0);
    expect(result.cohort.mean).toBe(50);
    expect(result.cohort.std).toBe(15);
  });

  it('should update all assessments with new SSN', async () => {
    prisma.assessment.findMany.mockResolvedValue([
      { id: 'a1', globalScore: 60, confidenceIndex: 70, scoringResult: null },
      { id: 'a2', globalScore: 80, confidenceIndex: 90, scoringResult: null },
    ]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    const result = await recomputeSSNBatch('MATHS');

    expect(result.updated).toBe(2);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it('should include cohort stats in result', async () => {
    prisma.assessment.findMany.mockResolvedValue([]);

    const result = await recomputeSSNBatch('NSI');

    expect(result.cohort).toEqual({
      mean: 50,
      std: 15,
      sampleSize: 100,
    });
  });

  it('should query assessments with non-null globalScore', async () => {
    prisma.assessment.findMany.mockResolvedValue([]);

    await recomputeSSNBatch('MATHS');

    expect(prisma.assessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subject: 'MATHS',
          globalScore: { not: null },
        }),
      })
    );
  });
});
