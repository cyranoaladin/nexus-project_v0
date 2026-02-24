/**
 * UAI Computation — Complete Test Suite
 *
 * Tests: computeUAI, computeAndPersistUAI, DEFAULT_UAI_WEIGHTS
 *
 * Source: lib/core/uai/computeUAI.ts
 */

import {
  computeUAI,
  computeAndPersistUAI,
  DEFAULT_UAI_WEIGHTS,
} from '@/lib/core/uai/computeUAI';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

// ─── DEFAULT_UAI_WEIGHTS ─────────────────────────────────────────────────────

describe('DEFAULT_UAI_WEIGHTS', () => {
  it('should have MATHS weight of 0.60', () => {
    expect(DEFAULT_UAI_WEIGHTS.MATHS).toBe(0.60);
  });

  it('should have NSI weight of 0.40', () => {
    expect(DEFAULT_UAI_WEIGHTS.NSI).toBe(0.40);
  });

  it('should sum to 1.0', () => {
    const sum = Object.values(DEFAULT_UAI_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0);
  });
});

// ─── computeUAI ──────────────────────────────────────────────────────────────

describe('computeUAI', () => {
  it('should return null for empty SSN map', () => {
    expect(computeUAI({})).toBeNull();
  });

  it('should compute UAI for two subjects with default weights', () => {
    const result = computeUAI({ MATHS: 70, NSI: 60 });

    expect(result).not.toBeNull();
    // UAI = 0.6*70 + 0.4*60 = 42 + 24 = 66
    expect(result!.uai).toBe(66);
    expect(result!.subjectCount).toBe(2);
  });

  it('should compute UAI for single subject', () => {
    const result = computeUAI({ MATHS: 80 });

    expect(result).not.toBeNull();
    // Single subject: weight normalized to 1.0
    expect(result!.uai).toBe(80);
    expect(result!.subjectCount).toBe(1);
  });

  it('should normalize weights when only one subject available', () => {
    const result = computeUAI({ NSI: 75 });

    expect(result).not.toBeNull();
    expect(result!.weights.NSI).toBeCloseTo(1.0);
    expect(result!.uai).toBe(75);
  });

  it('should use custom weights when provided', () => {
    const result = computeUAI({ MATHS: 80, NSI: 60 }, { MATHS: 0.5, NSI: 0.5 });

    expect(result).not.toBeNull();
    // UAI = 0.5*80 + 0.5*60 = 40 + 30 = 70
    expect(result!.uai).toBe(70);
  });

  it('should clamp UAI to [0, 100]', () => {
    const result = computeUAI({ MATHS: 100, NSI: 100 });
    expect(result!.uai).toBeLessThanOrEqual(100);

    const result2 = computeUAI({ MATHS: 0, NSI: 0 });
    expect(result2!.uai).toBeGreaterThanOrEqual(0);
  });

  it('should include component breakdown', () => {
    const result = computeUAI({ MATHS: 70, NSI: 60 });

    expect(result!.components).toHaveLength(2);
    const mathsComponent = result!.components.find((c) => c.subject === 'MATHS');
    expect(mathsComponent).toBeDefined();
    expect(mathsComponent!.ssn).toBe(70);
    expect(mathsComponent!.weight).toBeCloseTo(0.6, 2);
  });

  it('should handle unknown subjects with equal weights', () => {
    const result = computeUAI({ PHYSICS: 80, CHEMISTRY: 70 });

    expect(result).not.toBeNull();
    // Equal weights: 0.5 each
    expect(result!.uai).toBe(75);
  });

  it('should filter out NaN values', () => {
    const result = computeUAI({ MATHS: 70, NSI: NaN });

    expect(result).not.toBeNull();
    expect(result!.subjectCount).toBe(1);
    expect(result!.uai).toBe(70);
  });

  it('should be deterministic', () => {
    const results = Array.from({ length: 50 }, () =>
      computeUAI({ MATHS: 72, NSI: 65 })
    );
    const uais = results.map((r) => r!.uai);
    expect(new Set(uais).size).toBe(1);
  });
});

// ─── computeAndPersistUAI ────────────────────────────────────────────────────

describe('computeAndPersistUAI', () => {
  it('should return null when fewer than 2 subjects', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { subject: 'MATHS', ssn: 70, id: 'a1' },
    ]);

    const result = await computeAndPersistUAI('student@example.com');
    expect(result).toBeNull();
  });

  it('should return null when no assessments found', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    const result = await computeAndPersistUAI('student@example.com');
    expect(result).toBeNull();
  });

  it('should compute and persist UAI for 2+ subjects', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { subject: 'MATHS', ssn: 70, id: 'a1' },
      { subject: 'NSI', ssn: 60, id: 'a2' },
    ]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    const result = await computeAndPersistUAI('student@example.com');

    expect(result).not.toBeNull();
    expect(result!.uai).toBe(66);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it('should persist UAI on each assessment', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { subject: 'MATHS', ssn: 80, id: 'a1' },
      { subject: 'NSI', ssn: 70, id: 'a2' },
    ]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    await computeAndPersistUAI('student@example.com');

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE'),
      expect.any(Number),
      'a1'
    );
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE'),
      expect.any(Number),
      'a2'
    );
  });

  it('should use custom weights when provided', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([
      { subject: 'MATHS', ssn: 80, id: 'a1' },
      { subject: 'NSI', ssn: 60, id: 'a2' },
    ]);
    prisma.$executeRawUnsafe.mockResolvedValue(1);

    const result = await computeAndPersistUAI('student@example.com', { MATHS: 0.5, NSI: 0.5 });

    expect(result!.uai).toBe(70);
  });

  it('should query with correct student email', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    await computeAndPersistUAI('test@example.com');

    expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('studentEmail'),
      'test@example.com'
    );
  });
});
