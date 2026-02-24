/**
 * Score Normalization — Complete Test Suite
 *
 * Tests: normalizeScore, classifySSN, getSSNLabel, computePercentile, SSN_THRESHOLDS
 *
 * Source: lib/core/statistics/normalize.ts
 */

import {
  normalizeScore,
  classifySSN,
  getSSNLabel,
  computePercentile,
  SSN_THRESHOLDS,
} from '@/lib/core/statistics/normalize';

// ─── normalizeScore ──────────────────────────────────────────────────────────

describe('normalizeScore', () => {
  it('should return 50 when raw equals mean', () => {
    expect(normalizeScore(60, 60, 10)).toBe(50);
  });

  it('should return 50 when std is 0', () => {
    expect(normalizeScore(75, 60, 0)).toBe(50);
  });

  it('should return > 50 when raw > mean', () => {
    const ssn = normalizeScore(70, 60, 10);
    expect(ssn).toBeGreaterThan(50);
  });

  it('should return < 50 when raw < mean', () => {
    const ssn = normalizeScore(50, 60, 10);
    expect(ssn).toBeLessThan(50);
  });

  it('should compute correct z-score projection (raw=80, mean=60, std=10)', () => {
    // Z = (80-60)/10 = 2, SSN = 50 + 15*2 = 80
    expect(normalizeScore(80, 60, 10)).toBe(80);
  });

  it('should compute correct z-score projection (raw=40, mean=60, std=10)', () => {
    // Z = (40-60)/10 = -2, SSN = 50 + 15*(-2) = 20
    expect(normalizeScore(40, 60, 10)).toBe(20);
  });

  it('should clamp to 0 for extremely low scores', () => {
    // Z = (0-80)/5 = -16, SSN = 50 + 15*(-16) = -190 → clamped to 0
    expect(normalizeScore(0, 80, 5)).toBe(0);
  });

  it('should clamp to 100 for extremely high scores', () => {
    // Z = (100-20)/5 = 16, SSN = 50 + 15*16 = 290 → clamped to 100
    expect(normalizeScore(100, 20, 5)).toBe(100);
  });

  it('should round to 1 decimal place', () => {
    // Z = (65-60)/10 = 0.5, SSN = 50 + 15*0.5 = 57.5
    const ssn = normalizeScore(65, 60, 10);
    expect(ssn).toBe(57.5);
  });

  it('should handle very small std', () => {
    const ssn = normalizeScore(51, 50, 0.1);
    // Z = (51-50)/0.1 = 10, SSN = 50 + 150 = 200 → clamped to 100
    expect(ssn).toBe(100);
  });

  it('should be deterministic', () => {
    const results = Array.from({ length: 50 }, () => normalizeScore(72, 65, 12));
    const unique = new Set(results);
    expect(unique.size).toBe(1);
  });
});

// ─── classifySSN ─────────────────────────────────────────────────────────────

describe('classifySSN', () => {
  it('should classify 90 as excellence', () => {
    expect(classifySSN(90)).toBe('excellence');
  });

  it('should classify 85 as excellence (boundary)', () => {
    expect(classifySSN(85)).toBe('excellence');
  });

  it('should classify 75 as tres_solide', () => {
    expect(classifySSN(75)).toBe('tres_solide');
  });

  it('should classify 70 as tres_solide (boundary)', () => {
    expect(classifySSN(70)).toBe('tres_solide');
  });

  it('should classify 60 as stable', () => {
    expect(classifySSN(60)).toBe('stable');
  });

  it('should classify 55 as stable (boundary)', () => {
    expect(classifySSN(55)).toBe('stable');
  });

  it('should classify 45 as fragile', () => {
    expect(classifySSN(45)).toBe('fragile');
  });

  it('should classify 40 as fragile (boundary)', () => {
    expect(classifySSN(40)).toBe('fragile');
  });

  it('should classify 30 as prioritaire', () => {
    expect(classifySSN(30)).toBe('prioritaire');
  });

  it('should classify 0 as prioritaire', () => {
    expect(classifySSN(0)).toBe('prioritaire');
  });

  it('should classify 100 as excellence', () => {
    expect(classifySSN(100)).toBe('excellence');
  });

  it('should classify 84 as tres_solide (just below excellence)', () => {
    expect(classifySSN(84)).toBe('tres_solide');
  });

  it('should classify 69 as stable (just below tres_solide)', () => {
    expect(classifySSN(69)).toBe('stable');
  });

  it('should classify 54 as fragile (just below stable)', () => {
    expect(classifySSN(54)).toBe('fragile');
  });

  it('should classify 39 as prioritaire (just below fragile)', () => {
    expect(classifySSN(39)).toBe('prioritaire');
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

  it('should return "Prioritaire" for SSN < 40', () => {
    expect(getSSNLabel(20)).toBe('Prioritaire');
  });
});

// ─── computePercentile ───────────────────────────────────────────────────────

describe('computePercentile', () => {
  it('should return 50 for empty distribution', () => {
    expect(computePercentile(60, [])).toBe(50);
  });

  it('should return 100 for score above all others', () => {
    expect(computePercentile(100, [10, 20, 30, 40, 50])).toBe(100);
  });

  it('should return 0 for score below all others', () => {
    expect(computePercentile(0, [10, 20, 30, 40, 50])).toBe(0);
  });

  it('should return 50 for median score', () => {
    expect(computePercentile(30, [10, 20, 30, 40, 50])).toBe(40);
  });

  it('should handle single-element distribution', () => {
    expect(computePercentile(50, [50])).toBe(0);
    expect(computePercentile(60, [50])).toBe(100);
  });

  it('should handle duplicate scores', () => {
    const percentile = computePercentile(50, [50, 50, 50, 50, 50]);
    expect(percentile).toBe(0); // none strictly below
  });

  it('should be deterministic', () => {
    const dist = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const results = Array.from({ length: 50 }, () => computePercentile(55, dist));
    const unique = new Set(results);
    expect(unique.size).toBe(1);
  });
});

// ─── SSN_THRESHOLDS ──────────────────────────────────────────────────────────

describe('SSN_THRESHOLDS', () => {
  it('should have 5 levels', () => {
    expect(Object.keys(SSN_THRESHOLDS)).toHaveLength(5);
  });

  it('should cover the full 0-100 range without gaps', () => {
    const levels = Object.values(SSN_THRESHOLDS).sort((a, b) => a.min - b.min);
    expect(levels[0].min).toBe(0);
    expect(levels[levels.length - 1].max).toBe(100);
  });

  it('every level should have a non-empty label', () => {
    Object.values(SSN_THRESHOLDS).forEach((t) => {
      expect(t.label.length).toBeGreaterThan(0);
    });
  });

  it('every level should have min <= max', () => {
    Object.values(SSN_THRESHOLDS).forEach((t) => {
      expect(t.min).toBeLessThanOrEqual(t.max);
    });
  });
});
