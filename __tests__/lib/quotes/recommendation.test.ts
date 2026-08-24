/**
 * End-to-end tests for the quote domain engine orchestration (CDC §60).
 * Exercises the full pipeline: exam-profile -> diagnostic -> priority ->
 * pricing -> optimizer -> pack-matching, without React or a DB.
 */
import { buildRecommendation, matchCanonicalPack } from '@/lib/quotes/recommendation';
import { checkBacAccelereEligibility, buildExamProfile } from '@/lib/quotes/exam-profile';
import { projectDiagnostic } from '@/lib/quotes/diagnostic';
import { scoreSubjects } from '@/lib/quotes/priority';
import { buildIdealRecommendation } from '@/lib/quotes/pricing';
import type { SituationInput } from '@/lib/quotes/schemas';

const terminaleDeuxEds: SituationInput = {
  level: 'terminale',
  examSession: 2027,
  specialites: ['MATHEMATIQUES', 'NSI'],
};

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
  });

  test('matchCanonicalPack returns null when the sur-mesure total is already cheaper than any pack', () => {
    const match = matchCanonicalPack('terminale', 4, 100);
    expect(match).toBeNull();
  });

  test('matchCanonicalPack never reconstructs a price — it only reads canonical offer numbers (D4: 25% acompte + 10 mensualités)', () => {
    const match = matchCanonicalPack('terminale', 20, 5000);
    expect(match?.offerId).toBe('terminale-libre-focus-bac');
    expect(match?.priceAnnual).toBe(12900); // canonical price, not recomputed
    expect(match?.deposit).toBe(3220); // 25% of 12900, rounded to nearest 10
    expect(match?.installmentAmount).toBe(968);
    expect(match?.lastInstallmentAmount).toBe(968);
    // Sanity: deposit + 9 regular + 1 last reconstructs the exact annual price.
    expect((match?.deposit ?? 0) + (match?.installmentAmount ?? 0) * 9 + (match?.lastInstallmentAmount ?? 0)).toBe(
      12900,
    );
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
    const septembre = buildRecommendation({ ...base, monthsRemaining: 10 });
    const fevrier = buildRecommendation({ ...base, monthsRemaining: 4 });
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
