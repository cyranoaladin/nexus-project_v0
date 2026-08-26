/**
 * T2 — CANDIDAT INDIVIDUEL HEADCOUNT & GROUP STATE SAFETY (direction
 * decision registry, commit 4ffaac8ed §2 "Seuil DUO/SOLO/GROUPE" +
 * "Comportement groupe en constitution").
 *
 * Proves resolveScenarioEffectiveGroupPricing (lib/quotes/pricing-engine.ts)
 * — the single new function this lot introduces to eliminate the implicit
 * effectif=3 assumption for a scenario actually being turned into a real
 * Quote. Reuses resolveGroupModality (already correct, previously
 * unwired) and computeCandidatLibreSchedule (the same D4 schedule
 * pipeline.ts itself uses) — no second pricing engine.
 */
import {
  resolveScenarioEffectiveGroupPricing,
  InvalidConfirmedHeadcountError,
} from '@/lib/quotes/pricing-engine';
import type { QuoteScenario, RecommendedLine } from '@/lib/quotes/schemas';

function groupeLine(overrides: Partial<RecommendedLine> = {}): RecommendedLine {
  return {
    subject: 'eds1',
    label: 'Mathématiques',
    modality: 'GROUPE',
    hoursPerMonth: 8,
    unitPriceMonthly: 470,
    priorityScore: 100,
    priorityLabel: 'haute',
    reason: 'Spécialité principale',
    ...overrides,
  };
}

function pilotageLine(): RecommendedLine {
  return {
    subject: 'pilotage',
    label: 'Pilotage Nexus',
    modality: 'PILOTAGE',
    hoursPerMonth: 0,
    unitPriceMonthly: 150,
    priorityScore: Number.MAX_SAFE_INTEGER,
    priorityLabel: 'haute',
    reason: 'Socle',
  };
}

function scenarioWith(lines: RecommendedLine[]): QuoteScenario {
  const monthlyTotal = lines.reduce((s, l) => s + l.unitPriceMonthly, 0);
  return {
    tier: 'RECOMMANDE',
    lines,
    notRecommended: [],
    monthlyTotal,
    grandTotal: monthlyTotal * 10,
    months: 10,
    matchedOfferId: null,
    paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
    deposit: Math.round(monthlyTotal * 10 * 0.25),
    lastInstallmentAmount: monthlyTotal,
  };
}

describe('resolveScenarioEffectiveGroupPricing — NOT_APPLICABLE (no GROUPE line at all)', () => {
  test('a Pilotage-only scenario is NOT_APPLICABLE — headcount concept never applies, lines/totals pass through unchanged', () => {
    const scenario = scenarioWith([pilotageLine()]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, undefined);
    expect(result.state).toBe('NOT_APPLICABLE');
    expect(result.lines).toEqual(scenario.lines);
    expect(result.monthlyTotal).toBe(scenario.monthlyTotal);
    expect(result.grandTotal).toBe(scenario.grandTotal);
    expect(result.deposit).toBe(scenario.deposit);
    expect(result.groupLineResolutions).toEqual([]);
  });

  test('an all-INDIVIDUEL scenario (e.g. P11-shaped) is NOT_APPLICABLE regardless of confirmedHeadcount being supplied', () => {
    const scenario = scenarioWith([
      { subject: 'second-groupe', label: 'Rattrapage', modality: 'INDIVIDUEL', hoursPerMonth: 10, unitPriceMonthly: 1800, priorityScore: 100, priorityLabel: 'haute', reason: 'test' },
    ]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, 5);
    expect(result.state).toBe('NOT_APPLICABLE');
    expect(result.lines).toEqual(scenario.lines);
  });

  test('a PACK-matched scenario (single PACK-modality line) is NOT_APPLICABLE — packs are never per-headcount priced', () => {
    const scenario = scenarioWith([
      { subject: 'pack', label: 'Pack annuel', modality: 'PACK', hoursPerMonth: null, unitPriceMonthly: 620, priorityScore: 100, priorityLabel: 'haute', reason: 'pack' },
    ]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, undefined);
    expect(result.state).toBe('NOT_APPLICABLE');
  });
});

describe('resolveScenarioEffectiveGroupPricing — GROUP_PENDING (a GROUPE line exists, no confirmedHeadcount supplied)', () => {
  test('a scenario with a GROUPE line and no confirmedHeadcount is GROUP_PENDING — never silently priced as if effectif=3', () => {
    const scenario = scenarioWith([pilotageLine(), groupeLine()]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, undefined);
    expect(result.state).toBe('GROUP_PENDING');
    expect(result.lines).toEqual(scenario.lines);
    expect(result.groupLineResolutions).toEqual([]);
  });

  test('null is treated identically to undefined — GROUP_PENDING, never coerced to a number', () => {
    const scenario = scenarioWith([groupeLine()]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, null);
    expect(result.state).toBe('GROUP_PENDING');
  });
});

describe('resolveScenarioEffectiveGroupPricing — GROUP_CONFIRMED truth table (§11.A)', () => {
  test('confirmedHeadcount=1 -> SOLO pricing (180 TND/h INDIVIDUEL rate), state=GROUP_CONFIRMED', () => {
    const scenario = scenarioWith([groupeLine({ hoursPerMonth: 8, unitPriceMonthly: 470 })]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, 1);
    expect(result.state).toBe('GROUP_CONFIRMED');
    expect(result.groupLineResolutions).toEqual([{ subject: 'eds1', requestedModality: 'GROUPE', effectiveModality: 'SOLO' }]);
    expect(result.lines[0].modality).toBe('INDIVIDUEL');
    expect(result.lines[0].unitPriceMonthly).toBe(180 * 8); // INDIVIDUEL_HOUR_MIN
  });

  test('confirmedHeadcount=2 -> DUO pricing (90 TND/h/student rate), state=GROUP_CONFIRMED', () => {
    const scenario = scenarioWith([groupeLine({ hoursPerMonth: 8, unitPriceMonthly: 470 })]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, 2);
    expect(result.state).toBe('GROUP_CONFIRMED');
    expect(result.groupLineResolutions).toEqual([{ subject: 'eds1', requestedModality: 'GROUPE', effectiveModality: 'DUO' }]);
    expect(result.lines[0].modality).toBe('DUO');
    expect(result.lines[0].unitPriceMonthly).toBe(90 * 8); // DUO_HOUR
  });

  test('confirmedHeadcount=3 -> stays GROUPE at the catalogue tier rate, state=GROUP_CONFIRMED, price unchanged', () => {
    const scenario = scenarioWith([groupeLine({ hoursPerMonth: 8, unitPriceMonthly: 470 })]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, 3);
    expect(result.state).toBe('GROUP_CONFIRMED');
    expect(result.groupLineResolutions).toEqual([{ subject: 'eds1', requestedModality: 'GROUPE', effectiveModality: 'GROUPE' }]);
    expect(result.lines[0].modality).toBe('GROUPE');
    expect(result.lines[0].unitPriceMonthly).toBe(470); // unchanged catalogue rate
  });

  test('confirmedHeadcount=4 -> stays GROUPE, same as 3 (conservative floor unaffected, direction did not ask to bill differently above the opening threshold)', () => {
    const scenario = scenarioWith([groupeLine({ hoursPerMonth: 8, unitPriceMonthly: 470 })]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, 4);
    expect(result.state).toBe('GROUP_CONFIRMED');
    expect(result.groupLineResolutions).toEqual([{ subject: 'eds1', requestedModality: 'GROUPE', effectiveModality: 'GROUPE' }]);
    expect(result.lines[0].unitPriceMonthly).toBe(470);
  });

  test('scenario totals (monthlyTotal/grandTotal/deposit/lastInstallmentAmount) are recomputed via the same D4 schedule pipeline.ts uses, once a bascule actually reprices a line', () => {
    const scenario = scenarioWith([pilotageLine(), groupeLine({ hoursPerMonth: 8, unitPriceMonthly: 470 })]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, 1); // SOLO: 150 + 180*8 = 1590/mois
    expect(result.monthlyTotal + 0).toBeGreaterThan(0);
    const rawMonthly = 150 + 180 * 8;
    expect(result.grandTotal).toBe(rawMonthly * 10);
    expect(result.deposit + 9 * result.monthlyTotal + result.lastInstallmentAmount).toBeCloseTo(result.grandTotal, -1);
  });

  test('when nothing actually changes (headcount=3, GROUPE stays GROUPE), totals are returned unchanged, not recomputed from scratch', () => {
    const scenario = scenarioWith([pilotageLine(), groupeLine({ hoursPerMonth: 8, unitPriceMonthly: 470 })]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, 3);
    expect(result.monthlyTotal).toBe(scenario.monthlyTotal);
    expect(result.grandTotal).toBe(scenario.grandTotal);
    expect(result.deposit).toBe(scenario.deposit);
    expect(result.lastInstallmentAmount).toBe(scenario.lastInstallmentAmount);
  });

  test('multiple GROUPE lines are each resolved independently against the same confirmedHeadcount', () => {
    const scenario = scenarioWith([
      groupeLine({ subject: 'eds1', hoursPerMonth: 8, unitPriceMonthly: 470 }),
      groupeLine({ subject: 'eds2', hoursPerMonth: 4, unitPriceMonthly: 250 }),
    ]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, 2);
    expect(result.groupLineResolutions).toEqual([
      { subject: 'eds1', requestedModality: 'GROUPE', effectiveModality: 'DUO' },
      { subject: 'eds2', requestedModality: 'GROUPE', effectiveModality: 'DUO' },
    ]);
    expect(result.lines[0].unitPriceMonthly).toBe(90 * 8);
    expect(result.lines[1].unitPriceMonthly).toBe(90 * 4);
  });
});

describe('resolveScenarioEffectiveGroupPricing — invalid confirmedHeadcount never silently coerced (§11.B, no silent fallback to 3)', () => {
  const scenario = scenarioWith([groupeLine()]);

  test('0 is rejected', () => {
    expect(() => resolveScenarioEffectiveGroupPricing(scenario, 0)).toThrow(InvalidConfirmedHeadcountError);
  });

  test('a negative number is rejected', () => {
    expect(() => resolveScenarioEffectiveGroupPricing(scenario, -3)).toThrow(InvalidConfirmedHeadcountError);
  });

  test('a fractional number is rejected', () => {
    expect(() => resolveScenarioEffectiveGroupPricing(scenario, 2.5)).toThrow(InvalidConfirmedHeadcountError);
  });

  test('NaN is rejected', () => {
    expect(() => resolveScenarioEffectiveGroupPricing(scenario, NaN)).toThrow(InvalidConfirmedHeadcountError);
  });

  test('none of the invalid cases ever silently resolve to GROUPE/3 — the function throws, it never returns a fabricated GROUP_CONFIRMED', () => {
    for (const invalid of [0, -1, -3, 1.5, NaN]) {
      let threw = false;
      try {
        resolveScenarioEffectiveGroupPricing(scenario, invalid);
      } catch (e) {
        threw = true;
        expect(e).toBeInstanceOf(InvalidConfirmedHeadcountError);
      }
      expect(threw).toBe(true);
    }
  });
});

describe('resolveScenarioEffectiveGroupPricing — genericity across currently direction-gated modules (T2 §10: does NOT activate MOD_LVA/MOD_LVB/MOD_SPECIALITE_ABANDONNEE; proves the mechanism, once they are approved, would respect SOLO/DUO/GROUPE identically to an already-approved module — directionApprovalStatus is never touched by this test)', () => {
  // resolveScenarioEffectiveGroupPricing only ever inspects `modality` and
  // `hoursPerMonth` — never `subject` — so it is subject-agnostic by
  // construction. This test makes that genericity explicit for the three
  // still-DIRECTION_A_VALIDER petit_groupe modules named in the direction
  // decision registry (commit 4ffaac8ed §3), without approving them, without
  // reading/writing data/pricing.canonical.json, and without running the
  // full pipeline — the exact same resolution function, same DUO/SOLO
  // rates, same GROUP_CONFIRMED truth table.
  test.each(['lva', 'lvb', 'specialite-abandonnee'] as const)(
    'a %s-subject GROUPE line resolves identically to an approved module: headcount=1 -> SOLO at 180 TND/h',
    (subject) => {
      const scenario = scenarioWith([groupeLine({ subject, hoursPerMonth: 8, unitPriceMonthly: 470 })]);
      const result = resolveScenarioEffectiveGroupPricing(scenario, 1);
      expect(result.state).toBe('GROUP_CONFIRMED');
      expect(result.groupLineResolutions).toEqual([{ subject, requestedModality: 'GROUPE', effectiveModality: 'SOLO' }]);
      expect(result.lines[0].modality).toBe('INDIVIDUEL');
      expect(result.lines[0].unitPriceMonthly).toBe(180 * 8);
    },
  );

  test.each(['lva', 'lvb', 'specialite-abandonnee'] as const)(
    'a %s-subject GROUPE line with no confirmedHeadcount is GROUP_PENDING, exactly like an approved module — never silently emitted at the catalogue GROUPE rate',
    (subject) => {
      const scenario = scenarioWith([groupeLine({ subject, hoursPerMonth: 8, unitPriceMonthly: 470 })]);
      const result = resolveScenarioEffectiveGroupPricing(scenario, undefined);
      expect(result.state).toBe('GROUP_PENDING');
    },
  );
});
