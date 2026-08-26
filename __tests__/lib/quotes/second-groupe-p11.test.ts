/**
 * P11 (SVC_SECOND_GROUPE) payment-path tests — mission "vers un produit
 * complet", lot de fermeture P11. Drives the REAL pipeline entry point
 * (buildCandidateQuoteRecommendation), never calling
 * computeSecondGroupePayment/buildSecondGroupeScenarios directly — proves
 * the mechanism is actually reached, not merely correct in isolation.
 *
 * Two halves, matching mission §2.4's explicit dual requirement:
 * 1. Against the REAL canonical catalogue (data/pricing.canonical.json,
 *    unmocked): SVC_SECOND_GROUPE stays DIRECTION_A_VALIDER — the pipeline
 *    must still block a definitive emission today, mechanism or not.
 * 2. Against a catalogue fixture where ONLY the raw loader is mocked
 *    (jest.doMock + resetCatalogueCacheForTests forces a re-parse) —
 *    SVC_SECOND_GROUPE marked APPROVED — proving the engine correctly
 *    computes the P11 policy once a price is actually approved, without
 *    ever touching the real canonical file (never runs outside this
 *    disposable test process).
 */
import { resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';
import { buildCandidateQuoteRecommendation, type CandidateQuotePipelineInput } from '@/lib/quotes/pipeline';

function p11Input(budget: CandidateQuotePipelineInput['budget'] = { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' }): CandidateQuotePipelineInput {
  return {
    publicInput: {
      level: 'TERMINALE',
      examSession: 2027,
      modalite: 'A',
      specialite1: 'MATHEMATIQUES',
      specialite2: 'PHYSIQUE_CHIMIE',
      moyenneRattrapage: 9,
    },
    budget,
  };
}

describe('P11 (second groupe) — real pipeline, real canonical catalogue (unmocked)', () => {
  afterEach(() => resetCatalogueCacheForTests());

  test('a well-qualified P11 profile (moyenneRattrapage in [8,10]) is classified P11_SECOND_GROUPE', () => {
    const result = buildCandidateQuoteRecommendation(p11Input());
    expect(result.status).not.toBe('INVALID');
    if ('carte' in result) {
      expect(result.carte.parcours.parcoursPrincipal).toBe('P11_SECOND_GROUPE');
    } else {
      throw new Error(`expected a carte-bearing status, got ${result.status}`);
    }
  });

  test('the REAL canonical catalogue still blocks definitive emission today (SVC_SECOND_GROUPE stays DIRECTION_A_VALIDER) — mission §2.4 second requirement', () => {
    const result = buildCandidateQuoteRecommendation(p11Input());
    expect(result.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    if (result.status === 'DIRECTION_APPROVAL_REQUIRED') {
      expect(result.pendingServiceIds).toContain('SVC_SECOND_GROUPE');
      expect(result.pendingModuleIds).toEqual([]);
    }
  });

  test('never reaches READY regardless of budget/strategy — no route-level check to route around, the gate lives in the pipeline itself', () => {
    for (const strategy of ['RESPECT_BUDGET', 'BEST_BALANCE', 'MOST_COMPLETE'] as const) {
      const result = buildCandidateQuoteRecommendation(p11Input({ monthlyBudgetTnd: 5000, strategy }));
      expect(result.status).toBe('DIRECTION_APPROVAL_REQUIRED');
    }
  });
});

describe('P11 (second groupe) — mechanism proof, catalogue fixture APPROVED (disposable test process only, never the real canonical file)', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('@/lib/pricing', () => {
      const actual = jest.requireActual('@/lib/pricing');
      const raw = actual.getCandidatIndividuelCatalogueRaw();
      const approved = {
        ...raw,
        services: raw.services.map((s: { serviceId: string; directionApprovalStatus: string }) =>
          s.serviceId === 'SVC_SECOND_GROUPE' ? { ...s, directionApprovalStatus: 'APPROVED' } : s,
        ),
      };
      return { ...actual, getCandidatIndividuelCatalogueRaw: () => approved };
    });
  });

  afterEach(() => {
    jest.dontMock('@/lib/pricing');
    jest.resetModules();
  });

  test('with SVC_SECOND_GROUPE APPROVED (fixture-only), the pipeline reaches READY and computeSecondGroupePayment is genuinely exercised (not bypassed)', async () => {
    const { buildCandidateQuoteRecommendation: build } = await import('@/lib/quotes/pipeline');
    const result = build(p11Input());
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;

    for (const scenario of result.scenarios) {
      // computeSecondGroupePayment's exact, distinctive output shape
      // (depositTnd===totalTnd, remainingTnd===0, nInstallments===1) is
      // the only thing that could have produced these values — proof by
      // shape, not by re-implementing the function's arithmetic here.
      expect(scenario.paymentPolicy).toBe('PAY_IN_FULL_AT_BOOKING');
      expect(scenario.months).toBe(1);
      expect(scenario.deposit).toBe(scenario.grandTotal);
      expect(scenario.lastInstallmentAmount).toBe(0);
      // Never the annual model's vocabulary.
      expect(scenario.lines.every((l) => l.subject === 'second-groupe')).toBe(true);
    }
  });

  test('the 3 tiers match the 14-arbitrages dossier exactly: 6h/10h/16h at 180 TND/h = 1080/1800/2880 TND', async () => {
    const { buildCandidateQuoteRecommendation: build } = await import('@/lib/quotes/pipeline');
    const result = build(p11Input());
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;
    const byTier = Object.fromEntries(result.scenarios.map((s) => [s.tier, s.grandTotal]));
    expect(byTier.ESSENTIEL).toBe(1080);
    expect(byTier.RECOMMANDE).toBe(1800);
    expect(byTier.COMPLET).toBe(2880);
  });

  test('no annual échéancier vocabulary anywhere in a P11 scenario — no "acompte 25%" label, no 10-mensualité breakdown', async () => {
    const { buildCandidateQuoteRecommendation: build } = await import('@/lib/quotes/pipeline');
    const result = build(p11Input());
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;
    for (const scenario of result.scenarios) {
      expect(scenario.months).not.toBe(10);
      for (const line of scenario.lines) {
        expect(line.reason).not.toMatch(/25\s*%|acompte|mensualit/i);
      }
    }
  });
});
