/**
 * T2 CLOSEOUT — CANDIDAT INDIVIDUEL HEADCOUNT & GROUP STATE SAFETY
 * (direction decision registry, commit 4ffaac8ed §2 "Seuil DUO/SOLO/
 * GROUPE" + "Comportement groupe en constitution"; corrected per the
 * T2-closeout review after 294a885d6).
 *
 * Two model corrections from the T2-closeout review:
 *
 * 1. GROUP_STATE_SEMANTICS: GROUP_CONFIRMED means "the group actually
 *    materialized" — confirmedHeadcount=1/2 resolve to SOLO/DUO, a
 *    different product entirely, not "a confirmed group". Those cases are
 *    NOT_APPLICABLE (the group question no longer applies once it's
 *    resolved to a non-group product), reusing the existing state rather
 *    than inventing a new one. Only confirmedHeadcount>=group_min_open
 *    (GROUPE, unchanged catalogue rate) is GROUP_CONFIRMED.
 *
 * 2. HEADCOUNT_CARDINALITY = PER_GROUP_HEADCOUNT_REQUIRED: independent
 *    subjects (Maths, LVA, LVB...) are independent cohorts in the real
 *    product — a single global headcount was a domain modeling error.
 *    confirmedHeadcountBySubject is keyed by RecommendedLine.subject —
 *    the stable identity that already exists (verified: catalogue.modules
 *    maps 1:1 to distinct subjectIds, so `subject` is unique per scenario
 *    line — no new identity invented). A GROUPE line is only ever
 *    resolved using its OWN subject's entry — never another subject's.
 *
 * Proves resolveScenarioEffectiveGroupPricing (lib/quotes/pricing-engine.ts)
 * — the single function this lot introduces. Reuses resolveGroupModality
 * (already correct, previously unwired) and computeCandidatLibreSchedule
 * (the same D4 schedule pipeline.ts itself uses) — no second engine.
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

  test('an all-INDIVIDUEL scenario (e.g. P11-shaped) is NOT_APPLICABLE regardless of confirmedHeadcountBySubject being supplied', () => {
    const scenario = scenarioWith([
      { subject: 'second-groupe', label: 'Rattrapage', modality: 'INDIVIDUEL', hoursPerMonth: 10, unitPriceMonthly: 1800, priorityScore: 100, priorityLabel: 'haute', reason: 'test' },
    ]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, { 'second-groupe': 5 });
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

  test('T2-closeout item 1: confirmedHeadcount=1 (SOLO) is NOT_APPLICABLE, never GROUP_CONFIRMED — the group question no longer applies once resolved to a non-group product', () => {
    const scenario = scenarioWith([groupeLine({ hoursPerMonth: 8, unitPriceMonthly: 470 })]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, { eds1: 1 });
    expect(result.state).toBe('NOT_APPLICABLE');
    expect(result.lines[0].modality).toBe('INDIVIDUEL');
    expect(result.lines[0].unitPriceMonthly).toBe(180 * 8);
    expect(result.groupLineResolutions).toEqual([
      { subject: 'eds1', requestedModality: 'GROUPE', confirmedHeadcount: 1, effectiveModality: 'SOLO', groupConfirmed: false },
    ]);
  });

  test('T2-closeout item 1: confirmedHeadcount=2 (DUO) is NOT_APPLICABLE, never GROUP_CONFIRMED', () => {
    const scenario = scenarioWith([groupeLine({ hoursPerMonth: 8, unitPriceMonthly: 470 })]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, { eds1: 2 });
    expect(result.state).toBe('NOT_APPLICABLE');
    expect(result.lines[0].modality).toBe('DUO');
    expect(result.lines[0].unitPriceMonthly).toBe(90 * 8);
    expect(result.groupLineResolutions).toEqual([
      { subject: 'eds1', requestedModality: 'GROUPE', confirmedHeadcount: 2, effectiveModality: 'DUO', groupConfirmed: false },
    ]);
  });
});

describe('resolveScenarioEffectiveGroupPricing — GROUP_PENDING (a GROUPE line exists, its subject has no confirmed headcount)', () => {
  test('a scenario with a GROUPE line and no confirmedHeadcountBySubject at all is GROUP_PENDING — never silently priced as if effectif=3', () => {
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

  test('a map that does not contain THIS line\'s subject is GROUP_PENDING for it — a headcount for a different subject is never silently applied', () => {
    const scenario = scenarioWith([groupeLine({ subject: 'eds1' })]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, { lva: 3 }); // wrong subject
    expect(result.state).toBe('GROUP_PENDING');
    expect(result.lines).toEqual(scenario.lines);
  });

  test('§2 safety: if ANY GROUPE subject in a multi-line scenario lacks a confirmed headcount, the WHOLE scenario is GROUP_PENDING — no partial creation, no cross-subject bleed', () => {
    const scenario = scenarioWith([
      groupeLine({ subject: 'eds1', hoursPerMonth: 8, unitPriceMonthly: 470 }),
      groupeLine({ subject: 'lva', hoursPerMonth: 4, unitPriceMonthly: 250 }),
    ]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, { eds1: 3 }); // lva missing
    expect(result.state).toBe('GROUP_PENDING');
    expect(result.lines).toEqual(scenario.lines); // eds1 NOT repriced either — all-or-nothing
    expect(result.groupLineResolutions).toEqual([]);
  });
});

describe('resolveScenarioEffectiveGroupPricing — GROUP_CONFIRMED truth table (§11.A, corrected)', () => {
  test('confirmedHeadcount=3 -> stays GROUPE at the catalogue tier rate, state=GROUP_CONFIRMED, price unchanged', () => {
    const scenario = scenarioWith([groupeLine({ hoursPerMonth: 8, unitPriceMonthly: 470 })]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, { eds1: 3 });
    expect(result.state).toBe('GROUP_CONFIRMED');
    expect(result.groupLineResolutions).toEqual([
      { subject: 'eds1', requestedModality: 'GROUPE', confirmedHeadcount: 3, effectiveModality: 'GROUPE', groupConfirmed: true },
    ]);
    expect(result.lines[0].modality).toBe('GROUPE');
    expect(result.lines[0].unitPriceMonthly).toBe(470); // unchanged catalogue rate
  });

  test('confirmedHeadcount=4 -> stays GROUPE, same as 3 (conservative floor unaffected)', () => {
    const scenario = scenarioWith([groupeLine({ hoursPerMonth: 8, unitPriceMonthly: 470 })]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, { eds1: 4 });
    expect(result.state).toBe('GROUP_CONFIRMED');
    expect(result.groupLineResolutions[0].effectiveModality).toBe('GROUPE');
    expect(result.lines[0].unitPriceMonthly).toBe(470);
  });

  test('invariant: every groupConfirmed=true resolution has effectiveModality===GROUPE and confirmedHeadcount>=group_min_open (3) — checked across the whole truth table', () => {
    const scenario = scenarioWith([groupeLine({ hoursPerMonth: 8, unitPriceMonthly: 470 })]);
    for (const headcount of [1, 2, 3, 4, 5, 6]) {
      const result = resolveScenarioEffectiveGroupPricing(scenario, { eds1: headcount });
      for (const resolution of result.groupLineResolutions) {
        if (resolution.groupConfirmed) {
          expect(resolution.effectiveModality).toBe('GROUPE');
          expect(resolution.confirmedHeadcount).toBeGreaterThanOrEqual(3);
        } else {
          expect(resolution.effectiveModality).not.toBe('GROUPE');
        }
      }
      // Scenario-level state must agree with the per-line invariant too.
      if (headcount >= 3) expect(result.state).toBe('GROUP_CONFIRMED');
      else expect(result.state).toBe('NOT_APPLICABLE');
    }
  });

  test('scenario totals (monthlyTotal/grandTotal/deposit/lastInstallmentAmount) are recomputed via the same D4 schedule pipeline.ts uses, once a bascule actually reprices a line', () => {
    const scenario = scenarioWith([pilotageLine(), groupeLine({ hoursPerMonth: 8, unitPriceMonthly: 470 })]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, { eds1: 1 }); // SOLO: 150 + 180*8 = 1590/mois
    expect(result.monthlyTotal + 0).toBeGreaterThan(0);
    const rawMonthly = 150 + 180 * 8;
    expect(result.grandTotal).toBe(rawMonthly * 10);
    expect(result.deposit + 9 * result.monthlyTotal + result.lastInstallmentAmount).toBeCloseTo(result.grandTotal, -1);
  });

  test('when nothing actually changes (headcount=3, GROUPE stays GROUPE), totals are returned unchanged, not recomputed from scratch', () => {
    const scenario = scenarioWith([pilotageLine(), groupeLine({ hoursPerMonth: 8, unitPriceMonthly: 470 })]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, { eds1: 3 });
    expect(result.monthlyTotal).toBe(scenario.monthlyTotal);
    expect(result.grandTotal).toBe(scenario.grandTotal);
    expect(result.deposit).toBe(scenario.deposit);
    expect(result.lastInstallmentAmount).toBe(scenario.lastInstallmentAmount);
  });
});

describe('resolveScenarioEffectiveGroupPricing — HEADCOUNT_CARDINALITY = PER_GROUP_HEADCOUNT_REQUIRED (§2): independent subjects get independently resolved headcounts', () => {
  test('Maths(eds1)=3, LVA=2, LVB=4 — each line resolved with ITS OWN headcount, never a shared/global one', () => {
    const scenario = scenarioWith([
      groupeLine({ subject: 'eds1', label: 'Mathématiques', hoursPerMonth: 8, unitPriceMonthly: 470 }),
      groupeLine({ subject: 'lva', label: 'LVA', hoursPerMonth: 4, unitPriceMonthly: 250 }),
      groupeLine({ subject: 'lvb', label: 'LVB', hoursPerMonth: 4, unitPriceMonthly: 250 }),
    ]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, { eds1: 3, lva: 2, lvb: 4 });

    expect(result.state).toBe('GROUP_CONFIRMED'); // at least one (eds1, lvb) truly confirmed as a group
    expect(result.groupLineResolutions).toEqual([
      { subject: 'eds1', requestedModality: 'GROUPE', confirmedHeadcount: 3, effectiveModality: 'GROUPE', groupConfirmed: true },
      { subject: 'lva', requestedModality: 'GROUPE', confirmedHeadcount: 2, effectiveModality: 'DUO', groupConfirmed: false },
      { subject: 'lvb', requestedModality: 'GROUPE', confirmedHeadcount: 4, effectiveModality: 'GROUPE', groupConfirmed: true },
    ]);

    const bySubject = Object.fromEntries(result.lines.map((l) => [l.subject, l]));
    expect(bySubject.eds1.modality).toBe('GROUPE');
    expect(bySubject.eds1.unitPriceMonthly).toBe(470); // unchanged
    expect(bySubject.lva.modality).toBe('DUO');
    expect(bySubject.lva.unitPriceMonthly).toBe(90 * 4); // repriced, DUO
    expect(bySubject.lvb.modality).toBe('GROUPE');
    expect(bySubject.lvb.unitPriceMonthly).toBe(250); // unchanged
  });

  test('all-SOLO/DUO multi-line scenario (no line reaches GROUPE) is NOT_APPLICABLE at the scenario level — matches the single-line correction', () => {
    const scenario = scenarioWith([
      groupeLine({ subject: 'eds1', hoursPerMonth: 8, unitPriceMonthly: 470 }),
      groupeLine({ subject: 'lva', hoursPerMonth: 4, unitPriceMonthly: 250 }),
    ]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, { eds1: 1, lva: 2 });
    expect(result.state).toBe('NOT_APPLICABLE');
    expect(result.groupLineResolutions.every((r) => !r.groupConfirmed)).toBe(true);
  });

  test('a headcount entry for a subject not present in the scenario is silently ignored — never misapplied to another line', () => {
    const scenario = scenarioWith([groupeLine({ subject: 'eds1', hoursPerMonth: 8, unitPriceMonthly: 470 })]);
    const result = resolveScenarioEffectiveGroupPricing(scenario, { eds1: 3, 'this-subject-does-not-exist': 999 } as Record<string, number>);
    expect(result.state).toBe('GROUP_CONFIRMED');
    expect(result.groupLineResolutions).toHaveLength(1);
    expect(result.groupLineResolutions[0].subject).toBe('eds1');
  });
});

describe('resolveScenarioEffectiveGroupPricing — invalid confirmedHeadcount never silently coerced (§11.B, no silent fallback to 3)', () => {
  const scenario = scenarioWith([groupeLine()]);

  test('0 is rejected', () => {
    expect(() => resolveScenarioEffectiveGroupPricing(scenario, { eds1: 0 })).toThrow(InvalidConfirmedHeadcountError);
  });

  test('a negative number is rejected', () => {
    expect(() => resolveScenarioEffectiveGroupPricing(scenario, { eds1: -3 })).toThrow(InvalidConfirmedHeadcountError);
  });

  test('a fractional number is rejected', () => {
    expect(() => resolveScenarioEffectiveGroupPricing(scenario, { eds1: 2.5 })).toThrow(InvalidConfirmedHeadcountError);
  });

  test('NaN is rejected', () => {
    expect(() => resolveScenarioEffectiveGroupPricing(scenario, { eds1: NaN })).toThrow(InvalidConfirmedHeadcountError);
  });

  test('none of the invalid cases ever silently resolve to GROUPE/3 — the function throws, it never returns a fabricated GROUP_CONFIRMED', () => {
    for (const invalid of [0, -1, -3, 1.5, NaN]) {
      let threw = false;
      try {
        resolveScenarioEffectiveGroupPricing(scenario, { eds1: invalid });
      } catch (e) {
        threw = true;
        expect(e).toBeInstanceOf(InvalidConfirmedHeadcountError);
      }
      expect(threw).toBe(true);
    }
  });
});

describe('resolveScenarioEffectiveGroupPricing — genericity across currently direction-gated modules (T2 §10: does NOT activate MOD_LVA/MOD_LVB/MOD_SPECIALITE_ABANDONNEE; proves the mechanism, once they are approved, would respect SOLO/DUO/GROUPE identically to an already-approved module — directionApprovalStatus is never touched by this test)', () => {
  test.each(['lva', 'lvb', 'specialite-abandonnee'] as const)(
    'a %s-subject GROUPE line resolves identically to an approved module: headcount=1 -> SOLO at 180 TND/h, NOT_APPLICABLE (not GROUP_CONFIRMED)',
    (subject) => {
      const scenario = scenarioWith([groupeLine({ subject, hoursPerMonth: 8, unitPriceMonthly: 470 })]);
      const result = resolveScenarioEffectiveGroupPricing(scenario, { [subject]: 1 });
      expect(result.state).toBe('NOT_APPLICABLE');
      expect(result.groupLineResolutions).toEqual([
        { subject, requestedModality: 'GROUPE', confirmedHeadcount: 1, effectiveModality: 'SOLO', groupConfirmed: false },
      ]);
      expect(result.lines[0].modality).toBe('INDIVIDUEL');
      expect(result.lines[0].unitPriceMonthly).toBe(180 * 8);
    },
  );

  test.each(['lva', 'lvb', 'specialite-abandonnee'] as const)(
    'a %s-subject GROUPE line with no confirmed headcount is GROUP_PENDING, exactly like an approved module — never silently emitted at the catalogue GROUPE rate',
    (subject) => {
      const scenario = scenarioWith([groupeLine({ subject, hoursPerMonth: 8, unitPriceMonthly: 470 })]);
      const result = resolveScenarioEffectiveGroupPricing(scenario, undefined);
      expect(result.state).toBe('GROUP_PENDING');
    },
  );
});
