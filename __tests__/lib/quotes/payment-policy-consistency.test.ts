/**
 * Payment-policy consistency — "fair go-live" mission Phase C. QuotePaymentPolicy
 * (schemas.ts) already exists as a discriminated type, and the sur-mesure
 * schedule (computeCandidatLibreSchedule, pricing.ts) already derives its
 * numbers from two named constants (CANDIDAT_LIBRE_DEPOSIT_PCT=25,
 * CANDIDAT_LIBRE_N_INSTALLMENTS=10) with its own dedicated invariant tests
 * (pricing.test.ts). What was NOT locked in anywhere: that every scenario a
 * real engine run can actually produce — including a matched canonical pack,
 * whose deposit/installment_amount/last_installment are static catalog data,
 * not computed by computeCandidatLibreSchedule — stays consistent with the
 * paymentPolicy label it's tagged with. A catalog edit could silently make
 * `paymentPolicy` a decorative string (mission's own wording) without this.
 *
 * PAYMENT_POLICY_CONSISTENCY = PASS is this file's exact claim: every
 * QuoteScenario buildRecommendation (the legacy engine — still the only one
 * that ever reaches a matched pack, see r1-r2-reference-dossiers.test.ts's
 * incrément-3 finding that the canonical pipeline blocks on
 * DIRECTION_APPROVAL_REQUIRED before packs are reachable) can produce, swept
 * across both levels and every budget/strategy combination, satisfies:
 *   1. grandTotal === deposit + monthlyTotal × (months - 1) + lastInstallmentAmount
 *      (generic reconstruction invariant — holds under ANY policy, by the
 *      QuotePaymentPolicy contract itself, schemas.ts's own doc comments).
 *   2. under ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS specifically: months===10,
 *      deposit > 0 (mission: "a pack with deposit=0 must never be returned
 *      under a 25% policy"), and deposit is within a real 25% band of
 *      grandTotal (not some other rate silently substituted).
 */
import { buildRecommendation, matchCanonicalPack } from '@/lib/quotes/recommendation';
import type { QuoteScenario, SituationInput } from '@/lib/quotes/schemas';
import { getAnnualOffer } from '@/lib/pricing';

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

const budgets = [100, 150, 250, 400, 544, 600, 1044, 1200, 1290, 1690, 3000, 5000] as const;
const strategies = ['RESPECT_BUDGET', 'BEST_BALANCE', 'MOST_COMPLETE'] as const;

function assertPaymentPolicyConsistent(scenario: QuoteScenario) {
  // 1. Generic reconstruction invariant — holds regardless of which policy.
  const reconstructed = scenario.deposit + scenario.monthlyTotal * (scenario.months - 1) + scenario.lastInstallmentAmount;
  expect(reconstructed).toBe(scenario.grandTotal);

  if (scenario.paymentPolicy === 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS') {
    expect(scenario.months).toBe(10);
    expect(scenario.deposit).toBeGreaterThan(0); // never a false 0-acompte pack under a 25% label.
    const depositRatio = scenario.deposit / scenario.grandTotal;
    expect(depositRatio).toBeGreaterThan(0.24);
    expect(depositRatio).toBeLessThan(0.26);
  } else if (scenario.paymentPolicy === 'PAY_IN_FULL_AT_BOOKING') {
    expect(scenario.months).toBe(1);
    expect(scenario.deposit).toBe(scenario.grandTotal);
    expect(scenario.lastInstallmentAmount).toBe(0);
  }
}

describe('PAYMENT_POLICY_CONSISTENCY — every scenario buildRecommendation can produce', () => {
  test.each([
    ['Première', premiereMathsFrancais],
    ['Terminale, deux EDS', terminaleDeuxEds],
  ] as const)('%s — swept across every budget/strategy, sans bilan', (_label, situation) => {
    // "Sans bilan" resolves every subject to NON_EVALUE, which caps each
    // foundational subject at 4h/month (pricing.ts's volumeForSubject) — not
    // enough regularHoursNeeded to ever outprice a canonical pack, so this
    // sweep only ever exercises the sur-mesure branch of buildScenario. The
    // pack branch is proven separately below (both via matchCanonicalPack
    // directly and via the 4 real catalog offers), where it IS reachable.
    let sawSurMesure = false;
    for (const monthlyBudgetTnd of budgets) {
      for (const strategy of strategies) {
        const result = buildRecommendation({
          situation,
          diagnosticDomainScores: null,
          budget: { monthlyBudgetTnd, strategy },
        });
        for (const scenario of result.scenarios) {
          assertPaymentPolicyConsistent(scenario);
          if (!scenario.matchedOfferId) sawSurMesure = true;
        }
      }
    }
    expect(sawSurMesure).toBe(true);
  });
});

describe('PAYMENT_POLICY_CONSISTENCY — the 4 real candidat-libre canonical pack offers, as catalog data', () => {
  test.each([
    'premiere-libre-cap-anticipees',
    'premiere-libre-renforcee',
    'terminale-libre-focus-bac',
    'terminale-libre-integrale',
  ])('%s: deposit + 9×installment + lastInstallment === price_annual, deposit is a real ~25%%, never 0', (offerId) => {
    const offer = getAnnualOffer(offerId);
    expect(offer).toBeDefined();
    expect(offer!.price_annual).toBeGreaterThan(0);
    expect(offer!.deposit).toBeGreaterThan(0);
    const last = offer!.last_installment ?? offer!.installment_amount!;
    const reconstructed = offer!.deposit! + offer!.installment_amount! * 9 + last;
    expect(reconstructed).toBe(offer!.price_annual);
    const depositRatio = offer!.deposit! / offer!.price_annual!;
    expect(depositRatio).toBeGreaterThan(0.24);
    expect(depositRatio).toBeLessThan(0.26);
  });
});

describe("PAYMENT_POLICY_CONSISTENCY — matchCanonicalPack never returns a pack inconsistent with the 25% policy it's always tagged with", () => {
  test('every level x plausible regularHoursNeeded x surMesureMonthlyTotal combination that matches a pack is internally consistent', () => {
    let sawMatch = false;
    for (const level of ['premiere', 'terminale'] as const) {
      for (const regularHoursNeeded of [0, 4, 8, 12, 16, 20]) {
        for (const surMesureMonthlyTotal of [150, 400, 650, 1044, 1500, 2000]) {
          const match = matchCanonicalPack(level, regularHoursNeeded, surMesureMonthlyTotal);
          if (!match) continue;
          sawMatch = true;
          expect(match.deposit).toBeGreaterThan(0);
          const reconstructed = match.deposit + match.installmentAmount * 9 + match.lastInstallmentAmount;
          expect(reconstructed).toBe(match.priceAnnual);
        }
      }
    }
    expect(sawMatch).toBe(true);
  });
});
