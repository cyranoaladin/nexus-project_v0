import { computeMargin, type CommercialCostPolicy } from '@/lib/quotes/margin.server';
import { buildRecommendation } from '@/lib/quotes/recommendation';
import type { RecommendedLine } from '@/lib/quotes/schemas';
import type { SituationInput } from '@/lib/quotes/schemas';

const fixturePolicy: CommercialCostPolicy = {
  teacherCostPerHourTnd: 100, // fictional fixture, not the real confidential policy
  variableCostPerStudentMonthTnd: 10,
  marginGates: { greenPct: 40, warningPct: 30 },
};

function line(overrides: Partial<RecommendedLine>): RecommendedLine {
  return {
    subject: 'francais',
    label: 'Français',
    modality: 'GROUPE',
    hoursPerMonth: 8,
    unitPriceMonthly: 470,
    priorityScore: 100,
    priorityLabel: 'haute',
    reason: 'test',
    ...overrides,
  };
}

describe('computeMargin — CDC §10 gates', () => {
  test('a healthy GROUPE-only quote lands in the GREEN gate', () => {
    const lines = [
      line({ subject: 'pilotage', modality: 'PILOTAGE', hoursPerMonth: 0, unitPriceMonthly: 150 }),
      line({ hoursPerMonth: 8, unitPriceMonthly: 470, modality: 'GROUPE' }),
    ];
    const result = computeMargin(lines, fixturePolicy);
    expect(result.gate).toBe('GREEN');
    expect(result.marginPct).toBeGreaterThanOrEqual(fixturePolicy.marginGates.greenPct);
  });

  test('teacher cost is split by modality: GROUPE /3, DUO /2, INDIVIDUEL bears it alone', () => {
    const hours = 12;
    const groupe = computeMargin([line({ hoursPerMonth: hours, unitPriceMonthly: 680, modality: 'GROUPE' })], fixturePolicy);
    const duo = computeMargin([line({ hoursPerMonth: hours, unitPriceMonthly: 90 * hours, modality: 'DUO' })], fixturePolicy);
    const individuel = computeMargin(
      [line({ hoursPerMonth: hours, unitPriceMonthly: 180 * hours, modality: 'INDIVIDUEL' })],
      fixturePolicy,
    );
    const fullCost = fixturePolicy.teacherCostPerHourTnd * hours;
    expect(groupe.monthlyTeacherCostTnd).toBeCloseTo(fullCost / 3);
    expect(duo.monthlyTeacherCostTnd).toBeCloseTo(fullCost / 2);
    expect(individuel.monthlyTeacherCostTnd).toBeCloseTo(fullCost);
  });

  test('gate thresholds are exactly the configured policy values (30/40), not hardcoded elsewhere', () => {
    const cheapLines = [line({ hoursPerMonth: 12, unitPriceMonthly: 300, modality: 'INDIVIDUEL' })];
    const result = computeMargin(cheapLines, fixturePolicy);
    expect(result.gate).toBe('BLOCKED');
    expect(result.marginPct).toBeLessThan(fixturePolicy.marginGates.warningPct);
  });

  test('PILOTAGE/PACK lines carry no teacher-hour cost, only the flat variable cost', () => {
    const pilotageOnly = [line({ subject: 'pilotage', modality: 'PILOTAGE', hoursPerMonth: 0, unitPriceMonthly: 150 })];
    const result = computeMargin(pilotageOnly, fixturePolicy);
    expect(result.monthlyTeacherCostTnd).toBe(0);
    expect(result.monthlyVariableCostTnd).toBe(fixturePolicy.variableCostPerStudentMonthTnd);
  });
});

describe('T19 — Anti-leak: no cost/margin field ever appears in the public quote DTOs', () => {
  const forbiddenKeys = ['teacherCost', 'costPrice', 'cost', 'margin', 'marginPct', 'grossMargin', 'internalFloor', 'contribution'];

  const terminaleDeuxEds: SituationInput = {
    level: 'terminale',
    examSession: 2027,
    specialites: ['MATHEMATIQUES', 'NSI'],
  };

  // Regression guard: a hand-built literal object can't catch a real
  // consumer (e.g. buildRecommendation, or a future field added to
  // RecommendedLine/QuoteScenario) accidentally spreading cost/margin data
  // into the public shape. This exercises the actual pipeline that backs
  // /api/quotes/recommend, across every scenario tier and diagnostic state.
  test('buildRecommendation output (no bilan) never serializes a forbidden key', () => {
    const result = buildRecommendation({
      situation: terminaleDeuxEds,
      diagnosticDomainScores: null,
      budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
    });
    const json = JSON.stringify(result).toLowerCase();
    for (const key of forbiddenKeys) {
      expect(json).not.toContain(key.toLowerCase());
    }
  });

  test('buildRecommendation output (with bilan) never serializes a forbidden key', () => {
    const result = buildRecommendation({
      situation: terminaleDeuxEds,
      diagnosticDomainScores: {
        mathematiques: { points: 92, maxPoints: 100, percentage: 92 },
        nsi: { points: 20, maxPoints: 100, percentage: 20 },
      },
      budget: { monthlyBudgetTnd: 1200, strategy: 'BEST_BALANCE' },
    });
    const json = JSON.stringify(result).toLowerCase();
    for (const key of forbiddenKeys) {
      expect(json).not.toContain(key.toLowerCase());
    }
  });
});
