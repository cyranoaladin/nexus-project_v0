import { optimizeForBudget, BEST_BALANCE_OVERFLOW_TOLERANCE_PCT } from '@/lib/quotes/optimizer';
import { ALWAYS_INCLUDED_PRIORITY_SCORE } from '@/lib/quotes/schemas';
import type { RecommendedLine } from '@/lib/quotes/schemas';

const pilotage: RecommendedLine = {
  subject: 'pilotage',
  label: 'Nexus Libre — Pilotage',
  modality: 'PILOTAGE',
  hoursPerMonth: 0,
  unitPriceMonthly: 150,
  priorityScore: ALWAYS_INCLUDED_PRIORITY_SCORE,
  priorityLabel: 'haute',
  reason: 'Socle',
};

// Mirrors the mission's worked example (CDC §20): idéal = Français 8h + NSI 8h + Maths 4h + Pilotage = 1340
const francais8h: RecommendedLine = {
  subject: 'francais',
  label: 'Français',
  modality: 'GROUPE',
  hoursPerMonth: 8,
  unitPriceMonthly: 470,
  priorityScore: 100,
  priorityLabel: 'haute',
  reason: 'Priorité haute',
};
const nsi8h: RecommendedLine = {
  subject: 'eds1',
  label: 'NSI',
  modality: 'GROUPE',
  hoursPerMonth: 8,
  unitPriceMonthly: 470,
  priorityScore: 90,
  priorityLabel: 'haute',
  reason: 'Priorité haute',
};
const maths4h: RecommendedLine = {
  subject: 'maths-anticipees',
  label: 'Mathématiques',
  modality: 'GROUPE',
  hoursPerMonth: 4,
  unitPriceMonthly: 250,
  priorityScore: 50,
  priorityLabel: 'moyenne',
  reason: 'Priorité moyenne',
};

const ideal = [pilotage, francais8h, nsi8h, maths4h];

describe('optimizeForBudget — never invents a price, always keeps Pilotage', () => {
  test('MOST_COMPLETE returns the ideal recommendation unchanged, uncapped', () => {
    const result = optimizeForBudget(ideal, 100, 'MOST_COMPLETE');
    expect(result.lines).toHaveLength(4);
    expect(result.monthlyTotal).toBe(150 + 470 + 470 + 250);
    expect(result.droppedForBudget).toHaveLength(0);
  });

  test('RESPECT_BUDGET with a comfortable budget keeps everything', () => {
    const result = optimizeForBudget(ideal, 2000, 'RESPECT_BUDGET');
    expect(result.monthlyTotal).toBe(1340);
    expect(result.droppedForBudget).toHaveLength(0);
  });

  test('RESPECT_BUDGET with budget=1000 downgrades NSI to 4h and drops Maths (mission worked example)', () => {
    const result = optimizeForBudget(ideal, 1000, 'RESPECT_BUDGET');
    expect(result.monthlyTotal).toBeLessThanOrEqual(1000);
    const nsi = result.lines.find((l) => l.subject === 'eds1');
    expect(nsi?.hoursPerMonth).toBe(4);
    expect(result.lines.find((l) => l.subject === 'maths-anticipees')).toBeUndefined();
    expect(result.droppedForBudget.some((d) => d.subject === 'maths-anticipees')).toBe(true);
  });

  test('Pilotage is never dropped even on an insufficient budget', () => {
    const result = optimizeForBudget(ideal, 100, 'RESPECT_BUDGET');
    expect(result.lines.find((l) => l.modality === 'PILOTAGE')).toBeDefined();
    expect(result.monthlyTotal).toBeGreaterThanOrEqual(150);
  });

  test('an insufficient budget (less than Pilotage) still returns Pilotage and drops the rest', () => {
    const result = optimizeForBudget(ideal, 50, 'RESPECT_BUDGET');
    expect(result.lines).toHaveLength(1);
    expect(result.droppedForBudget.length).toBeGreaterThan(0);
  });

  test('BEST_BALANCE tolerates exceeding the stated budget by up to the documented percentage', () => {
    const budget = 1300; // just under the 1340 ideal total
    const respectBudget = optimizeForBudget(ideal, budget, 'RESPECT_BUDGET');
    const bestBalance = optimizeForBudget(ideal, budget, 'BEST_BALANCE');
    expect(bestBalance.monthlyTotal).toBeGreaterThanOrEqual(respectBudget.monthlyTotal);
    expect(bestBalance.monthlyTotal).toBeLessThanOrEqual(Math.round(budget * (1 + BEST_BALANCE_OVERFLOW_TOLERANCE_PCT / 100)));
  });

  test('a subject with no useful lower tier is dropped, not silently priced at 0', () => {
    const result = optimizeForBudget(ideal, 160, 'RESPECT_BUDGET');
    for (const line of result.lines) {
      expect(line.unitPriceMonthly).toBeGreaterThan(0);
    }
  });
});
