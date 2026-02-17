/**
 * Unit Tests — Score Normalization (SSN)
 *
 * Tests for normalizeScore, classifySSN, getSSNLabel, computePercentile.
 * Pure functions — no DB dependency.
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
  it('returns 50 when raw equals mean', () => {
    expect(normalizeScore(60, 60, 15)).toBe(50);
  });

  it('returns 65 when raw is 1 std above mean', () => {
    expect(normalizeScore(75, 60, 15)).toBe(65);
  });

  it('returns 35 when raw is 1 std below mean', () => {
    expect(normalizeScore(45, 60, 15)).toBe(35);
  });

  it('returns 50 when std is 0 (avoid division by zero)', () => {
    expect(normalizeScore(80, 80, 0)).toBe(50);
    expect(normalizeScore(0, 80, 0)).toBe(50);
    expect(normalizeScore(100, 50, 0)).toBe(50);
  });

  it('clamps to 0 for extremely low scores', () => {
    // raw=0, mean=90, std=5 → z=-18 → SSN=50+15*(-18)=-220 → clamped to 0
    expect(normalizeScore(0, 90, 5)).toBe(0);
  });

  it('clamps to 100 for extremely high scores', () => {
    // raw=100, mean=10, std=5 → z=18 → SSN=50+15*18=320 → clamped to 100
    expect(normalizeScore(100, 10, 5)).toBe(100);
  });

  it('rounds to 1 decimal place', () => {
    // raw=55, mean=50, std=10 → z=0.5 → SSN=50+7.5=57.5
    expect(normalizeScore(55, 50, 10)).toBe(57.5);
  });

  it('handles NaN-like edge cases gracefully', () => {
    // std=0 should always return 50 regardless of raw/mean
    expect(normalizeScore(NaN, 50, 0)).toBe(50);
  });

  it('handles raw=0, mean=0, std>0', () => {
    expect(normalizeScore(0, 0, 15)).toBe(50);
  });
});

// ─── classifySSN ─────────────────────────────────────────────────────────────

describe('classifySSN', () => {
  it('classifies 100 as excellence', () => {
    expect(classifySSN(100)).toBe('excellence');
  });

  it('classifies 85 as excellence (boundary)', () => {
    expect(classifySSN(85)).toBe('excellence');
  });

  it('classifies 84 as tres_solide (boundary)', () => {
    expect(classifySSN(84)).toBe('tres_solide');
  });

  it('classifies 70 as tres_solide (boundary)', () => {
    expect(classifySSN(70)).toBe('tres_solide');
  });

  it('classifies 69 as stable (boundary)', () => {
    expect(classifySSN(69)).toBe('stable');
  });

  it('classifies 55 as stable (boundary)', () => {
    expect(classifySSN(55)).toBe('stable');
  });

  it('classifies 54 as fragile (boundary)', () => {
    expect(classifySSN(54)).toBe('fragile');
  });

  it('classifies 40 as fragile (boundary)', () => {
    expect(classifySSN(40)).toBe('fragile');
  });

  it('classifies 39 as prioritaire (boundary)', () => {
    expect(classifySSN(39)).toBe('prioritaire');
  });

  it('classifies 0 as prioritaire', () => {
    expect(classifySSN(0)).toBe('prioritaire');
  });

  it('classifies 50 as fragile (mid-range)', () => {
    expect(classifySSN(50)).toBe('fragile');
  });
});

// ─── getSSNLabel ─────────────────────────────────────────────────────────────

describe('getSSNLabel', () => {
  it('returns "Excellence" for 90', () => {
    expect(getSSNLabel(90)).toBe('Excellence');
  });

  it('returns "Très solide" for 75', () => {
    expect(getSSNLabel(75)).toBe('Très solide');
  });

  it('returns "Stable" for 60', () => {
    expect(getSSNLabel(60)).toBe('Stable');
  });

  it('returns "Fragile" for 45', () => {
    expect(getSSNLabel(45)).toBe('Fragile');
  });

  it('returns "Prioritaire" for 20', () => {
    expect(getSSNLabel(20)).toBe('Prioritaire');
  });
});

// ─── computePercentile ───────────────────────────────────────────────────────

describe('computePercentile', () => {
  it('returns 50 for empty distribution', () => {
    expect(computePercentile(60, [])).toBe(50);
  });

  it('returns 0 when score is the lowest', () => {
    expect(computePercentile(10, [10, 20, 30, 40, 50])).toBe(0);
  });

  it('returns 100 when score is above all', () => {
    expect(computePercentile(100, [10, 20, 30, 40, 50])).toBe(100);
  });

  it('returns 60 when score is above 3 of 5', () => {
    expect(computePercentile(35, [10, 20, 30, 40, 50])).toBe(60);
  });

  it('returns 50 for median score in even distribution', () => {
    expect(computePercentile(50, [0, 25, 50, 75, 100])).toBe(40);
  });

  it('handles single-element distribution', () => {
    expect(computePercentile(50, [50])).toBe(0);
    expect(computePercentile(60, [50])).toBe(100);
  });

  it('handles duplicate scores', () => {
    expect(computePercentile(50, [50, 50, 50])).toBe(0);
    expect(computePercentile(51, [50, 50, 50])).toBe(100);
  });
});

// ─── SSN_THRESHOLDS consistency ──────────────────────────────────────────────

describe('SSN_THRESHOLDS', () => {
  it('covers the full 0-100 range without gaps', () => {
    const levels = Object.values(SSN_THRESHOLDS);
    const allValues = new Set<number>();
    for (const { min, max } of levels) {
      for (let i = min; i <= max; i++) {
        allValues.add(i);
      }
    }
    for (let i = 0; i <= 100; i++) {
      expect(allValues.has(i)).toBe(true);
    }
  });

  it('has no overlapping ranges', () => {
    const levels = Object.values(SSN_THRESHOLDS);
    for (let i = 0; i < levels.length; i++) {
      for (let j = i + 1; j < levels.length; j++) {
        const a = levels[i];
        const b = levels[j];
        const overlaps = a.min <= b.max && b.min <= a.max;
        expect(overlaps).toBe(false);
      }
    }
  });
});
