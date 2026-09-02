/**
 * End-to-end tests for the quote domain engine orchestration (CDC §60).
 * Exercises the full pipeline: exam-profile -> diagnostic -> priority ->
 * pricing -> optimizer -> pack-matching, without React or a DB.
 */
import { buildRecommendation, matchCanonicalPack } from '@/lib/quotes/recommendation';
import { checkBacAccelereEligibility, buildExamProfile } from '@/lib/quotes/exam-profile';
import { projectDiagnostic } from '@/lib/quotes/diagnostic';
import { scoreSubjects } from '@/lib/quotes/priority';
import { buildIdealRecommendation, computeCandidatLibreSchedule } from '@/lib/quotes/pricing';
import type { SituationInput } from '@/lib/quotes/schemas';

const terminaleDeuxEds: SituationInput = {
  level: 'terminale',
  examSession: 2027,
  specialites: ['MATHEMATIQUES', 'NSI'],
};

const premiereMathsFrancais: SituationInput = {
  level: 'premiere',
  examSession: 2027,
  specialites: ['MATHEMATIQUES', 'FRANCAIS'],
};

const budgetsSansBilan = [100, 150, 250, 400, 600, 1200, 1290, 1690, 3000] as const;

type ScenarioExpectation = {
  monthlyTotal: number;
  lines: Array<[subject: string, hoursPerMonth: number | null, unitPriceMonthly: number]>;
  notRecommendedSubjects: string[];
};

const premiereSansBilanByBudget: Record<(typeof budgetsSansBilan)[number], [number, number, number]> = {
  100: [150, 150, 650],
  150: [150, 150, 650],
  250: [150, 150, 650],
  400: [400, 400, 650],
  600: [400, 650, 650],
  1200: [650, 650, 650],
  1290: [650, 650, 650],
  1690: [650, 650, 650],
  3000: [650, 650, 650],
};

const terminaleSansBilanByBudget: Record<(typeof budgetsSansBilan)[number], [number, number, number]> = {
  100: [150, 150, 1044],
  150: [150, 150, 1044],
  250: [150, 150, 1044],
  400: [400, 400, 1044],
  600: [544, 650, 1044],
  1200: [1044, 1044, 1044],
  1290: [1044, 1044, 1044],
  1690: [1044, 1044, 1044],
  3000: [1044, 1044, 1044],
};

const premiereScenarioByMonthlyTotal: Record<number, ScenarioExpectation> = {
  150: {
    monthlyTotal: 150,
    lines: [['pilotage', 0, 150]],
    notRecommendedSubjects: ['francais', 'maths-anticipees'],
  },
  400: {
    monthlyTotal: 400,
    lines: [
      ['pilotage', 0, 150],
      ['francais', 4, 250],
    ],
    notRecommendedSubjects: ['maths-anticipees'],
  },
  650: {
    monthlyTotal: 650,
    lines: [
      ['pilotage', 0, 150],
      ['francais', 4, 250],
      ['maths-anticipees', 4, 250],
    ],
    notRecommendedSubjects: [],
  },
};

const terminaleAlwaysNotRecommended = ['enseignement-scientifique', 'histoire-geographie', 'lva', 'lvb'];
const terminaleScenarioByMonthlyTotal: Record<number, ScenarioExpectation> = {
  150: {
    monthlyTotal: 150,
    lines: [['pilotage', 0, 150]],
    notRecommendedSubjects: [...terminaleAlwaysNotRecommended, 'eds1', 'eds2', 'grand-oral', 'philosophie'],
  },
  400: {
    monthlyTotal: 400,
    lines: [
      ['pilotage', 0, 150],
      ['eds1', 4, 250],
    ],
    notRecommendedSubjects: [...terminaleAlwaysNotRecommended, 'eds2', 'grand-oral', 'philosophie'],
  },
  544: {
    monthlyTotal: 544,
    lines: [
      ['pilotage', 0, 150],
      ['eds1', 4, 250],
      ['grand-oral', null, 144],
    ],
    notRecommendedSubjects: [...terminaleAlwaysNotRecommended, 'eds2', 'philosophie'],
  },
  650: {
    monthlyTotal: 650,
    lines: [
      ['pilotage', 0, 150],
      ['eds1', 4, 250],
      ['eds2', 4, 250],
    ],
    notRecommendedSubjects: [...terminaleAlwaysNotRecommended, 'grand-oral', 'philosophie'],
  },
  1044: {
    monthlyTotal: 1044,
    lines: [
      ['pilotage', 0, 150],
      ['eds1', 4, 250],
      ['eds2', 4, 250],
      ['philosophie', 4, 250],
      ['grand-oral', null, 144],
    ],
    notRecommendedSubjects: terminaleAlwaysNotRecommended,
  },
};

function expectScenarioToMatchCharacterization(
  scenario: ReturnType<typeof buildRecommendation>['scenarios'][number],
  expectation: ScenarioExpectation,
) {
  // expectation.monthlyTotal is the raw sur-mesure combo total (pre-acompte)
  // — décision D4 turns that into an annual total that's then split into a
  // 25% acompte + 10 mensualités, so scenario.monthlyTotal (the regular
  // post-acompte installment) is no longer equal to that raw figure.
  const rawGrandTotal = expectation.monthlyTotal * 10;
  const schedule = computeCandidatLibreSchedule(rawGrandTotal);
  expect(scenario.monthlyTotal).toBe(schedule.installmentAmount);
  expect(scenario.grandTotal).toBe(rawGrandTotal);
  expect(scenario.deposit).toBe(schedule.deposit);
  expect(scenario.lastInstallmentAmount).toBe(schedule.lastInstallmentAmount);
  expect(scenario.months).toBe(10);
  expect(scenario.matchedOfferId).toBeNull();
  expect(scenario.lines.map((line) => [line.subject, line.hoursPerMonth, line.unitPriceMonthly])).toEqual(
    expectation.lines,
  );
  expect(scenario.notRecommended.map((line) => line.subject).sort()).toEqual(
    [...expectation.notRecommendedSubjects].sort(),
  );
}

describe('buildRecommendation — sans bilan (no diagnostic yet)', () => {
  test('every subject resolves NON_EVALUE and still produces a usable estimation', () => {
    const result = buildRecommendation({
      situation: terminaleDeuxEds,
      diagnosticDomainScores: null,
      budget: { monthlyBudgetTnd: 2000, strategy: 'BEST_BALANCE' },
    });
    expect(result.scenarios).toHaveLength(3);
    for (const scenario of result.scenarios) {
      expect(scenario.lines.find((l) => l.modality === 'PILOTAGE')).toBeDefined();
      expect(scenario.monthlyTotal).toBeGreaterThan(0);
    }
  });

  test.each([
    ['Première', premiereMathsFrancais, premiereSansBilanByBudget, premiereScenarioByMonthlyTotal],
    ['Terminale avec deux EDS', terminaleDeuxEds, terminaleSansBilanByBudget, terminaleScenarioByMonthlyTotal],
  ] as const)(
    '%s : la matrice budgétaire sans bilan reste reproductible et respecte les invariants',
    (_label, situation, expectedTotalsByBudget, expectedScenarioByMonthlyTotal) => {
      const completeTotals = new Set<number>();

      for (const budget of budgetsSansBilan) {
        const result = buildRecommendation({
          situation,
          diagnosticDomainScores: null,
          budget: { monthlyBudgetTnd: budget, strategy: 'BEST_BALANCE' },
        });
        const [essentiel, recommande, complet] = result.scenarios;
        const [expectedEssentiel, expectedRecommande, expectedComplet] = expectedTotalsByBudget[budget];

        expect(result.scenarios.map((scenario) => scenario.tier)).toEqual(['ESSENTIEL', 'RECOMMANDE', 'COMPLET']);
        expectScenarioToMatchCharacterization(essentiel, expectedScenarioByMonthlyTotal[expectedEssentiel]);
        expectScenarioToMatchCharacterization(recommande, expectedScenarioByMonthlyTotal[expectedRecommande]);
        expectScenarioToMatchCharacterization(complet, expectedScenarioByMonthlyTotal[expectedComplet]);

        if (budget < 150) {
          // Pilotage-only combo: raw 150 TND/mois -> 1500 TND/an -> D4 schedule.
          expect(essentiel.monthlyTotal).toBe(computeCandidatLibreSchedule(1500).installmentAmount);
          expect(essentiel.lines).toHaveLength(1);
          expect(essentiel.lines[0].modality).toBe('PILOTAGE');
        } else {
          expect(essentiel.monthlyTotal).toBeLessThanOrEqual(budget);
        }
        if (budget >= 150) {
          expect(recommande.monthlyTotal).toBeLessThanOrEqual(Math.round(budget * 1.1));
        }
        expect(complet.monthlyTotal).toBeGreaterThanOrEqual(essentiel.monthlyTotal);
        expect(complet.monthlyTotal).toBeGreaterThanOrEqual(recommande.monthlyTotal);
        completeTotals.add(complet.monthlyTotal);
      }

      expect(completeTotals.size).toBe(1);
    },
  );
});

describe('buildRecommendation — avec bilan, matière solide non vendue', () => {
  test('a SOLIDE EDS never appears as a priced line and is explicitly listed as not recommended', () => {
    const result = buildRecommendation({
      situation: terminaleDeuxEds,
      diagnosticDomainScores: {
        mathematiques: { points: 92, maxPoints: 100, percentage: 92 }, // SOLIDE
        nsi: { points: 20, maxPoints: 100, percentage: 20 }, // A_RECTIFIER
      },
      budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
    });
    const complet = result.scenarios.find((s) => s.tier === 'COMPLET')!;
    expect(complet.lines.find((l) => l.subject === 'eds1')).toBeUndefined();
    expect(complet.notRecommended.some((n) => n.subject === 'eds1' && /solide/i.test(n.reason))).toBe(true);
    expect(complet.lines.find((l) => l.subject === 'eds2')).toBeDefined(); // NSI, weak, is recommended
  });
});

describe('buildRecommendation — priorité rouge (A_RECTIFIER) gets the highest volume', () => {
  // Tested at the ideal-recommendation layer (before budget optimization and
  // pack-matching), which is the stage actually responsible for the
  // priority -> volume mapping. A fully-loaded profile can legitimately
  // resolve to a cheaper canonical pack downstream (CDC §21) — that's a
  // separate, already-tested concern (see "pack plus avantageux" below), not
  // a reason this unit's own volume decision would be wrong.
  test('an A_RECTIFIER EDS is assigned 12h/mois (the maximum foundational tier)', () => {
    const profile = buildExamProfile(terminaleDeuxEds);
    const foundational = new Set(profile.filter((p) => p.defaultCandidateForRegularSupport).map((p) => p.subject));
    const diag = projectDiagnostic(terminaleDeuxEds, {
      mathematiques: { points: 15, maxPoints: 100, percentage: 15 },
      nsi: { points: 15, maxPoints: 100, percentage: 15 },
    });
    const priorities = scoreSubjects(profile, diag);
    const ideal = buildIdealRecommendation(priorities, foundational);
    const eds1 = ideal.lines.find((l) => l.subject === 'eds1');
    expect(eds1?.hoursPerMonth).toBe(12);
  });
});

describe('buildRecommendation — confiance faussement élevée (overconfidence)', () => {
  test('an overconfident subject scores higher than an identical, well-calibrated one', () => {
    const base = {
      situation: terminaleDeuxEds,
      budget: { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' as const },
    };
    const overconfident = buildRecommendation({
      ...base,
      diagnosticDomainScores: { mathematiques: { points: 60, maxPoints: 100, percentage: 60 } },
      overconfidentDomainKeys: new Set(['mathematiques']),
    });
    const calibrated = buildRecommendation({
      ...base,
      diagnosticDomainScores: { mathematiques: { points: 60, maxPoints: 100, percentage: 60 } },
    });
    const overconfidentEds1 = overconfident.scenarios[0].lines.find((l) => l.subject === 'eds1');
    const calibratedEds1 = calibrated.scenarios[0].lines.find((l) => l.subject === 'eds1');
    expect(overconfidentEds1?.priorityScore).toBeGreaterThan(calibratedEds1?.priorityScore ?? 0);
  });
});

describe('buildRecommendation — budget insuffisant / budget confortable', () => {
  const weakEverywhere = {
    mathematiques: { points: 15, maxPoints: 100, percentage: 15 },
    nsi: { points: 15, maxPoints: 100, percentage: 15 },
  };

  test('ESSENTIEL never exceeds an insufficient budget', () => {
    const result = buildRecommendation({
      situation: terminaleDeuxEds,
      diagnosticDomainScores: weakEverywhere,
      budget: { monthlyBudgetTnd: 200, strategy: 'RESPECT_BUDGET' },
    });
    const essentiel = result.scenarios.find((s) => s.tier === 'ESSENTIEL')!;
    expect(essentiel.monthlyTotal).toBeLessThanOrEqual(200);
  });

  test('a comfortable budget covers the full ideal recommendation in COMPLET', () => {
    const result = buildRecommendation({
      situation: terminaleDeuxEds,
      diagnosticDomainScores: weakEverywhere,
      budget: { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' },
    });
    const complet = result.scenarios.find((s) => s.tier === 'COMPLET')!;
    expect(complet.notRecommended.some((n) => /budget/i.test(n.reason))).toBe(false);
  });
});

describe('buildRecommendation — pack plus avantageux que la somme des modules', () => {
  test('two EDS both weak (12h each) matches Terminale Focus Bac if cheaper than the sur-mesure sum', () => {
    const result = buildRecommendation({
      situation: terminaleDeuxEds,
      diagnosticDomainScores: {
        mathematiques: { points: 15, maxPoints: 100, percentage: 15 },
        nsi: { points: 15, maxPoints: 100, percentage: 15 },
      },
      budget: { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' },
    });
    const complet = result.scenarios.find((s) => s.tier === 'COMPLET')!;
    // 12h + 12h EDS lines alone (before philosophie/grand-oral) already cost
    // 680+680=1360/mois sur-mesure, which Focus Bac (1290) or Intégrale
    // (1690, covers up to 30h) can undercut or match depending on total hours.
    expect(complet.matchedOfferId).not.toBeNull();
    expect(complet.includedFeatures).toEqual(expect.arrayContaining([expect.stringMatching(/Grand Oral/i)]));
  });

  test('matchCanonicalPack returns null when the sur-mesure total is already cheaper than any pack', () => {
    const match = matchCanonicalPack('terminale', 4, 100);
    expect(match).toBeNull();
  });

  test('matchCanonicalPack never reconstructs a price — it only reads canonical offer numbers (sans acompte, 10 mensualités — commercial decision 2026-09-02, supersedes D4)', () => {
    const match = matchCanonicalPack('terminale', 20, 5000);
    expect(match?.offerId).toBe('terminale-libre-focus-bac');
    expect(match?.priceAnnual).toBe(12900); // canonical price, not recomputed
    expect(match?.deposit).toBe(0);
    expect(match?.installmentAmount).toBe(1290);
    expect(match?.lastInstallmentAmount).toBe(1290);
    // Sanity: deposit + 9 regular + 1 last reconstructs the exact annual price.
    expect((match?.deposit ?? 0) + (match?.installmentAmount ?? 0) * 9 + (match?.lastInstallmentAmount ?? 0)).toBe(
      12900,
    );
  });
});

describe('matchCanonicalPack — unit-normalization guard (regression: post-D4 apples-to-oranges bug)', () => {
  // Bug found during the main-branch reconciliation merge: comparing a
  // canonical pack's post-acompte installment_amount (968 for Focus Bac)
  // directly against a flat, acompte-free sur-mesure monthly rate made the
  // pack look artificially cheap and over-selected it, even when the pack's
  // real annual price (12900) was HIGHER than the sur-mesure annual total.
  // matchCanonicalPack must always compare on an annual basis.
  test('a sur-mesure monthly rate between the pack installment (968) and the true annual break-even (1290) is correctly rejected, not over-selected', () => {
    // 968 < surMesureMonthlyTotal < 1290: the old (buggy) monthly comparison
    // would have matched (968 <= surMesureMonthlyTotal); the correct annual
    // comparison (12900 <= surMesureMonthlyTotal * 10) must reject it.
    for (const surMesureMonthlyTotal of [970, 1000, 1100, 1200, 1289]) {
      const match = matchCanonicalPack('terminale', 20, surMesureMonthlyTotal);
      expect(match).toBeNull();
    }
  });

  test('at and above the true annual break-even (1290/mois = 12900/an), the pack is correctly selected', () => {
    for (const surMesureMonthlyTotal of [1290, 1400, 5000]) {
      const match = matchCanonicalPack('terminale', 20, surMesureMonthlyTotal);
      expect(match?.offerId).toBe('terminale-libre-focus-bac');
    }
  });

  test('property: for every (level, hours, surMesureMonthlyTotal) combination, a returned match always satisfies priceAnnual <= surMesureMonthlyTotal x 10 — never a bare monthly-vs-monthly comparison', () => {
    const levels: SituationInput['level'][] = ['premiere', 'terminale'];
    const hoursOptions = [0, 4, 8, 12, 20, 30, 40];
    const totals = [50, 100, 300, 500, 800, 970, 1000, 1200, 1290, 1500, 1690, 2000, 5000];

    let matchedCount = 0;
    for (const level of levels) {
      for (const hours of hoursOptions) {
        for (const total of totals) {
          const match = matchCanonicalPack(level, hours, total);
          if (match) {
            matchedCount += 1;
            // The one invariant that must never be violated: annual price
            // never exceeds the sur-mesure annual equivalent. If this ever
            // fails, the comparison has regressed to mixing a post-acompte
            // monthly figure against a pre-acompte one again.
            expect(match.priceAnnual).toBeLessThanOrEqual(total * 10);
            // Internal consistency: the returned schedule must itself sum
            // exactly to the returned annual price (D4 invariant).
            expect(match.deposit + match.installmentAmount * 9 + match.lastInstallmentAmount).toBe(
              match.priceAnnual,
            );
          }
        }
      }
    }
    // Sanity: the matrix above is wide enough to actually exercise both
    // branches (some matches, some nulls) — an empty matchedCount would
    // mean this property test is vacuously true and proves nothing.
    expect(matchedCount).toBeGreaterThan(0);
  });
});

describe('buildRecommendation — aucune matière nécessaire', () => {
  test('when every subject (including philosophie and Grand Oral) is SOLIDE, only Pilotage remains', () => {
    const result = buildRecommendation({
      situation: terminaleDeuxEds,
      diagnosticDomainScores: {
        mathematiques: { points: 95, maxPoints: 100, percentage: 95 },
        nsi: { points: 95, maxPoints: 100, percentage: 95 },
        philosophie: { points: 90, maxPoints: 100, percentage: 90 },
        grand_oral: { points: 90, maxPoints: 100, percentage: 90 },
      },
      budget: { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' },
    });
    const complet = result.scenarios.find((s) => s.tier === 'COMPLET')!;
    expect(complet.lines).toHaveLength(1);
    expect(complet.lines[0].modality).toBe('PILOTAGE');
    expect(complet.notRecommended.length).toBeGreaterThan(0);
  });
});

describe('buildRecommendation — plusieurs EDS (both tracked distinctly)', () => {
  test('EDS1 and EDS2 are scored and priced independently', () => {
    const profile = buildExamProfile(terminaleDeuxEds);
    const foundational = new Set(profile.filter((p) => p.defaultCandidateForRegularSupport).map((p) => p.subject));
    const diag = projectDiagnostic(terminaleDeuxEds, {
      mathematiques: { points: 20, maxPoints: 100, percentage: 20 }, // A_RECTIFIER
      nsi: { points: 70, maxPoints: 100, percentage: 70 }, // A_CONSOLIDER
    });
    const priorities = scoreSubjects(profile, diag);
    const ideal = buildIdealRecommendation(priorities, foundational);
    const eds1 = ideal.lines.find((l) => l.subject === 'eds1');
    const eds2 = ideal.lines.find((l) => l.subject === 'eds2');
    expect(eds1?.hoursPerMonth).toBeGreaterThan(eds2?.hoursPerMonth ?? Infinity);
  });
});

describe('buildRecommendation — entrée en cours d\'année (urgency scales with months remaining)', () => {
  test('a candidate joining in February (less time left) scores subjects higher than one starting in September', () => {
    const base = {
      situation: terminaleDeuxEds,
      diagnosticDomainScores: { mathematiques: { points: 40, maxPoints: 100, percentage: 40 } },
      budget: { monthlyBudgetTnd: 5000, strategy: 'MOST_COMPLETE' as const },
    };
    const septembre = buildRecommendation({ ...base, pedagogicalUrgencyMonths: 10 });
    const fevrier = buildRecommendation({ ...base, pedagogicalUrgencyMonths: 4 });
    const eds1Sept = septembre.scenarios[0].lines.find((l) => l.subject === 'eds1');
    const eds1Fev = fevrier.scenarios[0].lines.find((l) => l.subject === 'eds1');
    expect(eds1Fev?.priorityScore).toBeGreaterThan(eds1Sept?.priorityScore ?? 0);
  });
});

describe('buildRecommendation — session réglementaire inconnue (fail closed)', () => {
  test('an unsupported exam session throws rather than silently using a default policy', () => {
    expect(() =>
      buildRecommendation({
        situation: { ...terminaleDeuxEds, examSession: 2099 },
        diagnosticDomainScores: null,
        budget: { monthlyBudgetTnd: 1000, strategy: 'BEST_BALANCE' },
      }),
    ).toThrow(/not sellable/);
  });

  test('a registered but non-sellable session (historical or unconfirmed skeleton) also throws rather than pricing it', () => {
    expect(() =>
      buildRecommendation({
        situation: { ...terminaleDeuxEds, examSession: 2026 },
        diagnosticDomainScores: null,
        budget: { monthlyBudgetTnd: 1000, strategy: 'BEST_BALANCE' },
      }),
    ).toThrow(/HISTORICAL_READONLY/);
  });
});

describe('checkBacAccelereEligibility — accéléré éligible / non éligible / incertain', () => {
  test('éligible: age >= 20 confirmed', () => {
    expect(checkBacAccelereEligibility(2027, { age20: true })).toBe('ELIGIBLE');
  });

  test('non éligible: standard two-session path when every auto-checkable condition is confirmed false', () => {
    const allFalse = {
      age20: false,
      enfant_charge: false,
      echec_anterieur: false,
      deja_titulaire_bac: false,
      diplome_etranger_comparable: false,
    };
    expect(checkBacAccelereEligibility(2027, allFalse)).toBe('NOT_ELIGIBLE_STANDARD_TWO_SESSION_PATH');
  });

  test('incertain: no answers at all requires human review, never a false validation', () => {
    expect(checkBacAccelereEligibility(2027, {})).toBe('ELIGIBILITY_REQUIRES_HUMAN_REVIEW');
  });
});
