import { computeMargin, type CommercialCostPolicy } from '@/lib/quotes/margin.server';
import { buildRecommendation } from '@/lib/quotes/recommendation';
import type { RecommendedLine } from '@/lib/quotes/schemas';
import type { SituationInput } from '@/lib/quotes/schemas';

/**
 * Mission "fair go-live" Phase F/I7 — the decomposed cost model
 * (teacherNominalCostPerHourTnd/structureCostPerHourTnd/oneOffDossierCostTnd),
 * formalizing the hypothesis already recorded in docs/candidat-individuel/
 * gouvernance-vs-hypotheses-couts-lot-fermeture-p11-p3.md.
 */
const fixturePolicy: CommercialCostPolicy = {
  source: 'BLENDED_FALLBACK', // fictional fixture, not the real confidential policy
  teacherNominalCostPerHourTnd: 100, // chosen to match the old fixture's arithmetic below, not the real default (50) — see the dedicated "governed default values" describe block for that.
  structureCostPerHourTnd: 0,
  oneOffDossierCostTnd: 0, // kept 0 in most tests so the pre-existing per-line arithmetic stays exact; the one-off is proven in its own describe block below.
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

describe('computeMargin — CDC §10 gates (T1 nomenclature: BLOCKED / HUMAN_REVIEW_REQUIRED / MARGIN_OK, seuils 30%/40% — direction decision, commit 4ffaac8ed)', () => {
  test('a healthy GROUPE-only quote lands in the MARGIN_OK gate', () => {
    const lines = [
      line({ subject: 'pilotage', modality: 'PILOTAGE', hoursPerMonth: 0, unitPriceMonthly: 150 }),
      line({ hoursPerMonth: 8, unitPriceMonthly: 470, modality: 'GROUPE' }),
    ];
    const result = computeMargin(lines, fixturePolicy);
    expect(result.gate).toBe('MARGIN_OK');
    expect(result.marginPct).toBeGreaterThanOrEqual(fixturePolicy.marginGates.greenPct);
  });

  test('mission Phase F allocation: GROUPE splits by confirmedHeadcount (never a fixed /3), DUO /2, INDIVIDUEL bears it alone', () => {
    const hours = 12;
    const groupeConfirmed5 = computeMargin(
      [line({ subject: 'eds1', hoursPerMonth: hours, unitPriceMonthly: 680, modality: 'GROUPE' })],
      fixturePolicy,
      { eds1: 5 },
    );
    const duo = computeMargin([line({ hoursPerMonth: hours, unitPriceMonthly: 90 * hours, modality: 'DUO' })], fixturePolicy);
    const individuel = computeMargin(
      [line({ hoursPerMonth: hours, unitPriceMonthly: 180 * hours, modality: 'INDIVIDUEL' })],
      fixturePolicy,
    );
    const fullAnnualCost = fixturePolicy.teacherNominalCostPerHourTnd * hours * 10;
    expect(groupeConfirmed5.annualTeachingDeliveryCostTnd).toBeCloseTo(fullAnnualCost / 5);
    expect(duo.annualTeachingDeliveryCostTnd).toBeCloseTo(fullAnnualCost / 2);
    expect(individuel.annualTeachingDeliveryCostTnd).toBeCloseTo(fullAnnualCost);
  });

  test('a GROUPE line with no confirmedHeadcountBySubject falls back to the conservative catalogue-minimum projection (3), never an unconfirmed guess', () => {
    const hours = 12;
    const projected = computeMargin([line({ subject: 'eds1', hoursPerMonth: hours, unitPriceMonthly: 680, modality: 'GROUPE' })], fixturePolicy);
    const fullAnnualCost = fixturePolicy.teacherNominalCostPerHourTnd * hours * 10;
    expect(projected.annualTeachingDeliveryCostTnd).toBeCloseTo(fullAnnualCost / 3);
    expect(projected.lineCosts[0].headcount).toBe(3);
  });

  test('a headcount confirmed for a different subject is never applied to this line (per-subject, never global)', () => {
    const result = computeMargin(
      [line({ subject: 'eds1', hoursPerMonth: 8, unitPriceMonthly: 470, modality: 'GROUPE' })],
      fixturePolicy,
      { lva: 6 }, // a different subject's headcount — must not leak onto eds1.
    );
    expect(result.lineCosts[0].headcount).toBe(3); // still the conservative projection, not 6.
  });

  test('gate thresholds are exactly the configured policy values (30/40), not hardcoded elsewhere', () => {
    const cheapLines = [line({ hoursPerMonth: 12, unitPriceMonthly: 300, modality: 'INDIVIDUEL' })];
    const result = computeMargin(cheapLines, fixturePolicy);
    expect(result.gate).toBe('BLOCKED');
    expect(result.marginPct).toBeLessThan(fixturePolicy.marginGates.warningPct);
  });

  test('PILOTAGE/PACK lines carry no delivery-hour cost at all', () => {
    const pilotageOnly = [line({ subject: 'pilotage', modality: 'PILOTAGE', hoursPerMonth: 0, unitPriceMonthly: 150 })];
    const result = computeMargin(pilotageOnly, fixturePolicy);
    expect(result.annualTeachingDeliveryCostTnd).toBe(0);
    expect(result.lineCosts).toHaveLength(0);
  });

  // §4 of the T1 mandate — exact boundary proof at 29.99%/30%/39.99%/40%.
  // Each test picks teacherNominalCostPerHourTnd so the single INDIVIDUEL
  // line's annual margin lands exactly on the target boundary, then asserts
  // the resulting gate — never guessed, solved directly from the same
  // annual formula computeMargin itself uses (annualRevenue=10000,
  // oneOffDossierCost=0, hours=1/month).
  describe('boundary proof — 29.99% / 30% / 39.99% / 40%', () => {
    function policyForBoundary(targetMarginPct: number): { policy: CommercialCostPolicy; annualRevenue: number } {
      const annualRevenue = 10000; // 1000/month x 10 months
      const teacherCost = 1000 - (targetMarginPct / 100) * 1000; // per-month, then x10 cancels out on both sides of the ratio.
      return {
        policy: { ...fixturePolicy, teacherNominalCostPerHourTnd: teacherCost },
        annualRevenue,
      };
    }

    test('29.99% -> BLOCKED', () => {
      const { policy } = policyForBoundary(29.99);
      const result = computeMargin([line({ modality: 'INDIVIDUEL', hoursPerMonth: 1, unitPriceMonthly: 1000 })], policy);
      expect(result.marginPct).toBeCloseTo(29.99, 5);
      expect(result.gate).toBe('BLOCKED');
    });

    test('30% exactly -> HUMAN_REVIEW_REQUIRED (boundary is inclusive on the review side, per direction decision "30% <= margin < 40%")', () => {
      const { policy } = policyForBoundary(30);
      const result = computeMargin([line({ modality: 'INDIVIDUEL', hoursPerMonth: 1, unitPriceMonthly: 1000 })], policy);
      expect(result.marginPct).toBeCloseTo(30, 5);
      expect(result.gate).toBe('HUMAN_REVIEW_REQUIRED');
    });

    test('39.99% -> HUMAN_REVIEW_REQUIRED', () => {
      const { policy } = policyForBoundary(39.99);
      const result = computeMargin([line({ modality: 'INDIVIDUEL', hoursPerMonth: 1, unitPriceMonthly: 1000 })], policy);
      expect(result.marginPct).toBeCloseTo(39.99, 5);
      expect(result.gate).toBe('HUMAN_REVIEW_REQUIRED');
    });

    test('40% exactly -> MARGIN_OK (boundary is inclusive on the OK side, per direction decision "margin >= 40%")', () => {
      const { policy } = policyForBoundary(40);
      const result = computeMargin([line({ modality: 'INDIVIDUEL', hoursPerMonth: 1, unitPriceMonthly: 1000 })], policy);
      expect(result.marginPct).toBeCloseTo(40, 5);
      expect(result.gate).toBe('MARGIN_OK');
    });
  });
});

describe('computeMargin — ANNUAL cost model (mission Phase F: marginPct = (annualRevenue - annualTeachingDeliveryCost - oneOffDossierCost) / annualRevenue)', () => {
  test('the one-off dossier cost is subtracted exactly once, never multiplied by months or by line count', () => {
    const lines = [
      line({ subject: 'pilotage', modality: 'PILOTAGE', hoursPerMonth: 0, unitPriceMonthly: 150 }),
      line({ subject: 'eds1', hoursPerMonth: 8, unitPriceMonthly: 470, modality: 'GROUPE' }),
      line({ subject: 'eds2', hoursPerMonth: 8, unitPriceMonthly: 470, modality: 'GROUPE' }),
    ];
    const withoutDossier = computeMargin(lines, { ...fixturePolicy, oneOffDossierCostTnd: 0 }, { eds1: 4, eds2: 4 });
    const withDossier = computeMargin(lines, { ...fixturePolicy, oneOffDossierCostTnd: 120 }, { eds1: 4, eds2: 4 });
    expect(withDossier.oneOffDossierCostTnd).toBe(120);
    // Subtracted exactly once from the annual contribution — not x10, not x(number of lines).
    expect(withoutDossier.annualContributionTnd - withDossier.annualContributionTnd).toBe(120);
  });

  test('delivery cost per hour is teacherCost + structureCost, both contributing to the annual delivery cost', () => {
    const lines = [line({ subject: 'eds1', hoursPerMonth: 10, unitPriceMonthly: 1000, modality: 'INDIVIDUEL' })];
    const teacherOnly = computeMargin(lines, { ...fixturePolicy, teacherNominalCostPerHourTnd: 50, structureCostPerHourTnd: 0 });
    const teacherPlusStructure = computeMargin(lines, { ...fixturePolicy, teacherNominalCostPerHourTnd: 50, structureCostPerHourTnd: 15 });
    // +15 TND/h x 10h/month x 10 months = +1500 TND/an of extra delivery cost.
    expect(teacherPlusStructure.annualTeachingDeliveryCostTnd - teacherOnly.annualTeachingDeliveryCostTnd).toBeCloseTo(1500);
  });

  test('the resolved teacher cost and its source are recorded on the result (audit trail)', () => {
    const lines = [line({ hoursPerMonth: 4, unitPriceMonthly: 250, modality: 'GROUPE' })];
    const result = computeMargin(lines, { ...fixturePolicy, teacherNominalCostPerHourTnd: 50 });
    expect(result.teacherCostPerHourTndUsed).toBe(50);
    expect(result.teacherCostSource).toBe('NOMINAL');
  });

  test('an invalid nominal teacher rate (0, negative, non-finite) falls back to the 100 TND/h defensive rate, never silently used as-is', () => {
    for (const invalid of [0, -5, NaN, Infinity]) {
      const lines = [line({ hoursPerMonth: 4, unitPriceMonthly: 250, modality: 'INDIVIDUEL' })];
      const result = computeMargin(lines, { ...fixturePolicy, teacherNominalCostPerHourTnd: invalid });
      expect(result.teacherCostPerHourTndUsed).toBe(100);
      expect(result.teacherCostSource).toBe('FALLBACK');
    }
  });
});

describe('CommercialCostPolicy governed default values (mission Phase F: 50/15/120, formalizing docs/candidat-individuel/gouvernance-vs-hypotheses-couts-lot-fermeture-p11-p3.md)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('no BusinessConfig row -> the governed default: teacher 50 TND/h, structure 15 TND/h, dossier 120 TND one-off', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.businessConfig.findUnique as jest.Mock).mockResolvedValueOnce(null);
    const { getCommercialCostPolicy } = await import('@/lib/quotes/margin.server');
    const policy = await getCommercialCostPolicy();
    expect(policy.source).toBe('BLENDED_FALLBACK');
    expect(policy.teacherNominalCostPerHourTnd).toBe(50);
    expect(policy.structureCostPerHourTnd).toBe(15);
    expect(policy.oneOffDossierCostTnd).toBe(120);
    expect(policy.marginGates).toEqual({ greenPct: 40, warningPct: 30 });
  });

  test('a real, valid BusinessConfig row -> source=BUSINESS_CONFIG, never BLENDED_FALLBACK — the exact defect the T1 closeout targeted', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.businessConfig.findUnique as jest.Mock).mockResolvedValueOnce({
      value: { teacherNominalCostPerHourTnd: 65, structureCostPerHourTnd: 12, oneOffDossierCostTnd: 100, marginGates: { greenPct: 40, warningPct: 30 } },
    });
    const { getCommercialCostPolicy } = await import('@/lib/quotes/margin.server');
    const policy = await getCommercialCostPolicy();
    expect(policy.source).toBe('BUSINESS_CONFIG');
    expect(policy.teacherNominalCostPerHourTnd).toBe(65);
  });

  test('a malformed BusinessConfig row (fails schema validation) fails closed to the governed default, never a half-trusted BUSINESS_CONFIG value', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.businessConfig.findUnique as jest.Mock).mockResolvedValueOnce({
      value: { teacherNominalCostPerHourTnd: -5, structureCostPerHourTnd: 15, oneOffDossierCostTnd: 120, marginGates: { greenPct: 40, warningPct: 30 } },
    });
    const { getCommercialCostPolicy } = await import('@/lib/quotes/margin.server');
    const policy = await getCommercialCostPolicy();
    expect(policy.source).toBe('BLENDED_FALLBACK');
    expect(policy.teacherNominalCostPerHourTnd).toBe(50);
  });

  test('a row written with a "source" field in its stored value (an admin attempt to declare provenance) is rejected by the stored-shape schema — provenance is only ever derived, still falls back closed', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.businessConfig.findUnique as jest.Mock).mockResolvedValueOnce({
      value: { source: 'BUSINESS_CONFIG', teacherNominalCostPerHourTnd: 65, structureCostPerHourTnd: 15, oneOffDossierCostTnd: 120, marginGates: { greenPct: 40, warningPct: 30 } },
    });
    const { getCommercialCostPolicy } = await import('@/lib/quotes/margin.server');
    const policy = await getCommercialCostPolicy();
    // .strict() on the stored-shape schema rejects the unknown `source`
    // key entirely -> falls back, exactly like any other malformed row.
    expect(policy.source).toBe('BLENDED_FALLBACK');
    expect(policy.teacherNominalCostPerHourTnd).toBe(50);
  });

  test('the old blended-model field names (teacherCostPerHourTnd/variableCostPerStudentMonthTnd) are rejected as unknown keys (.strict()) — never silently accepted as a stale shape', async () => {
    const { prisma } = await import('@/lib/prisma');
    (prisma.businessConfig.findUnique as jest.Mock).mockResolvedValueOnce({
      value: { teacherCostPerHourTnd: 65, variableCostPerStudentMonthTnd: 10, marginGates: { greenPct: 40, warningPct: 30 } },
    });
    const { getCommercialCostPolicy } = await import('@/lib/quotes/margin.server');
    const policy = await getCommercialCostPolicy();
    expect(policy.source).toBe('BLENDED_FALLBACK');
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
