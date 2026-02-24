/**
 * Cohort Statistics — Complete Test Suite
 *
 * Tests: computeCohortStats, computeCohortStatsWithAudit, getCachedCohortStats,
 *        LOW_SAMPLE_THRESHOLD, caching behavior
 *
 * Source: lib/core/statistics/cohort.ts
 */

import {
  computeCohortStats,
  computeCohortStatsWithAudit,
  getCachedCohortStats,
  LOW_SAMPLE_THRESHOLD,
} from '@/lib/core/statistics/cohort';

// Access mocked prisma
let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

// ─── LOW_SAMPLE_THRESHOLD ────────────────────────────────────────────────────

describe('LOW_SAMPLE_THRESHOLD', () => {
  it('should be 30', () => {
    expect(LOW_SAMPLE_THRESHOLD).toBe(30);
  });
});

// ─── computeCohortStats ──────────────────────────────────────────────────────

describe('computeCohortStats', () => {
  it('should return default stats (mean=50, std=15) when no assessments exist', async () => {
    // Arrange
    prisma.assessment.findMany.mockResolvedValue([]);

    // Act
    const stats = await computeCohortStats('MATHS');

    // Assert
    expect(stats.mean).toBe(50);
    expect(stats.std).toBe(15);
    expect(stats.n).toBe(0);
    expect(stats.sampleSize).toBe(0);
    expect(stats.isLowSample).toBe(true);
    expect(stats.type).toBe('MATHS');
  });

  it('should compute correct mean and std for a cohort', async () => {
    // Arrange: scores [40, 60, 80] → mean=60, std≈16.33
    prisma.assessment.findMany.mockResolvedValue([
      { globalScore: 40 },
      { globalScore: 60 },
      { globalScore: 80 },
    ]);

    // Act
    const stats = await computeCohortStats('MATHS');

    // Assert
    expect(stats.mean).toBeCloseTo(60, 1);
    expect(stats.std).toBeCloseTo(16.33, 0);
    expect(stats.n).toBe(3);
    expect(stats.isLowSample).toBe(true); // 3 < 30
  });

  it('should flag isLowSample=true when n < 30', async () => {
    // Arrange: 10 assessments
    prisma.assessment.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ globalScore: 50 + i }))
    );

    // Act
    const stats = await computeCohortStats('MATHS');

    // Assert
    expect(stats.isLowSample).toBe(true);
    expect(stats.n).toBe(10);
  });

  it('should flag isLowSample=false when n >= 30', async () => {
    // Arrange: 30 assessments
    prisma.assessment.findMany.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => ({ globalScore: 50 + i }))
    );

    // Act
    const stats = await computeCohortStats('MATHS');

    // Assert
    expect(stats.isLowSample).toBe(false);
    expect(stats.n).toBe(30);
  });

  it('should use std=15 fallback when all scores are identical (std=0)', async () => {
    // Arrange: all same score
    prisma.assessment.findMany.mockResolvedValue([
      { globalScore: 75 },
      { globalScore: 75 },
      { globalScore: 75 },
    ]);

    // Act
    const stats = await computeCohortStats('MATHS');

    // Assert: std=0 → fallback to 15
    expect(stats.std).toBe(15);
    expect(stats.mean).toBe(75);
  });

  it('should filter null globalScore values', async () => {
    // Arrange: mix of valid and null scores
    prisma.assessment.findMany.mockResolvedValue([
      { globalScore: 60 },
      { globalScore: null },
      { globalScore: 80 },
    ]);

    // Act
    const stats = await computeCohortStats('MATHS');

    // Assert: only 2 valid scores
    expect(stats.n).toBe(2);
    expect(stats.mean).toBeCloseTo(70, 1);
  });

  it('should accept string filter (backward-compatible)', async () => {
    // Arrange
    prisma.assessment.findMany.mockResolvedValue([{ globalScore: 50 }]);

    // Act
    const stats = await computeCohortStats('NSI');

    // Assert
    expect(stats.type).toBe('NSI');
    expect(prisma.assessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ subject: 'NSI' }),
      })
    );
  });

  it('should accept CohortFilter object with assessmentVersion', async () => {
    // Arrange
    prisma.assessment.findMany.mockResolvedValue([{ globalScore: 65 }]);

    // Act
    const stats = await computeCohortStats({ type: 'MATHS', assessmentVersion: 'v1.0' });

    // Assert
    expect(stats.type).toBe('MATHS');
    expect(stats.assessmentVersion).toBe('v1.0');
    expect(prisma.assessment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subject: 'MATHS',
          assessmentVersion: 'v1.0',
        }),
      })
    );
  });

  it('should include computedAt ISO timestamp', async () => {
    // Arrange
    prisma.assessment.findMany.mockResolvedValue([]);

    // Act
    const stats = await computeCohortStats('MATHS');

    // Assert
    expect(stats.computedAt).toBeTruthy();
    expect(new Date(stats.computedAt).getTime()).toBeGreaterThan(0);
  });

  it('should cache results for subsequent getCachedCohortStats calls', async () => {
    // Arrange
    prisma.assessment.findMany.mockResolvedValue([{ globalScore: 70 }]);

    // Act
    await computeCohortStats('MATHS');
    const cached = getCachedCohortStats('MATHS');

    // Assert
    expect(cached).not.toBeNull();
    expect(cached!.mean).toBe(70);
    expect(cached!.type).toBe('MATHS');
  });
});

// ─── getCachedCohortStats ────────────────────────────────────────────────────

describe('getCachedCohortStats', () => {
  it('should return null for uncached type', () => {
    const cached = getCachedCohortStats('PHYSIQUE_NEVER_COMPUTED');
    expect(cached).toBeNull();
  });

  it('should return cached stats after computation', async () => {
    // Arrange
    prisma.assessment.findMany.mockResolvedValue([{ globalScore: 55 }]);

    // Act
    await computeCohortStats('NSI');
    const cached = getCachedCohortStats('NSI');

    // Assert
    expect(cached).not.toBeNull();
    expect(cached!.type).toBe('NSI');
  });

  it('should distinguish cache by assessmentVersion', async () => {
    // Arrange
    prisma.assessment.findMany.mockResolvedValue([{ globalScore: 60 }]);

    // Act
    await computeCohortStats({ type: 'MATHS', assessmentVersion: 'v1' });
    await computeCohortStats({ type: 'MATHS', assessmentVersion: 'v2' });

    // Assert
    const v1 = getCachedCohortStats('MATHS', 'v1');
    const v2 = getCachedCohortStats('MATHS', 'v2');
    expect(v1).not.toBeNull();
    expect(v2).not.toBeNull();
  });
});

// ─── computeCohortStatsWithAudit ─────────────────────────────────────────────

describe('computeCohortStatsWithAudit', () => {
  it('should return audit entry with current stats', async () => {
    // Arrange
    prisma.assessment.findMany.mockResolvedValue([
      { globalScore: 50 },
      { globalScore: 70 },
    ]);

    // Act
    const audit = await computeCohortStatsWithAudit('MATHS');

    // Assert
    expect(audit.type).toBe('MATHS');
    expect(audit.stats).toBeDefined();
    expect(audit.stats.mean).toBeCloseTo(60, 1);
  });

  it('should include delta from previous computation', async () => {
    // Arrange: first computation
    prisma.assessment.findMany.mockResolvedValue([{ globalScore: 50 }]);
    await computeCohortStats('MATHS_AUDIT_TEST');

    // Second computation with different data
    prisma.assessment.findMany.mockResolvedValue([
      { globalScore: 50 },
      { globalScore: 70 },
    ]);

    // Act
    const audit = await computeCohortStatsWithAudit('MATHS_AUDIT_TEST');

    // Assert
    expect(audit.previousStats).not.toBeNull();
    expect(audit.delta).toBeDefined();
    expect(audit.delta!.sampleDelta).toBe(1); // 2 - 1
  });

  it('should have null previousStats on first computation', async () => {
    // Arrange
    prisma.assessment.findMany.mockResolvedValue([{ globalScore: 60 }]);

    // Act: use unique type to avoid cache from other tests
    const audit = await computeCohortStatsWithAudit('FIRST_TIME_TYPE');

    // Assert
    expect(audit.previousStats).toBeNull();
    expect(audit.delta).toBeUndefined();
  });
});
