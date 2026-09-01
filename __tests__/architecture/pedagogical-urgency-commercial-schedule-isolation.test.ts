import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRecommendation } from '@/lib/quotes/recommendation';
import { urgencyFactor } from '@/lib/quotes/priority';
import type { SituationInput, BudgetInput } from '@/lib/quotes/schemas';

/**
 * docs/candidat-individuel/ADR-MID-YEAR-BILLING-MODEL.md — locks the
 * business decision MID_YEAR_BILLING_MODEL = ANNUAL_CONTRACT:
 *
 *   PEDAGOGICAL_URGENCY_CANNOT_CHANGE_COMMERCIAL_SCHEDULE = PASS
 *
 * A candidat-individuel enrollment started mid-year stays a full annual
 * contract: 25% acompte + 10 mensualités, regardless of how many months
 * remain before the exam. The months-remaining signal may only reorder
 * subject priority (urgencyFactor, lib/quotes/priority.ts) — it must never
 * reach deposit, installment count, monthly amount, or grand total.
 *
 * This test locks two things:
 *  1. Behavioral sweep: the same dossier priced at 1/3/6/10 months
 *     remaining produces byte-identical grandTotal/deposit/monthlyTotal/
 *     paymentPolicy for every scenario, while the urgency signal itself
 *     genuinely varies (proving this isn't a no-op check).
 *  2. Source: the canonical domain names the value `pedagogicalUrgencyMonths`
 *     (never the ambiguous `monthsRemaining`) in priority.ts, pipeline.ts
 *     and recommendation.ts. The public HTTP boundary
 *     (app/api/quotes/recommend/route.ts) is explicitly exempted — it keeps
 *     the wire-compatible `monthsRemaining` field name and maps it locally,
 *     isolating the ambiguous name outside the canonical engine (mission
 *     "l'isoler explicitement hors du moteur canonique"). Neither name may
 *     ever reach computeSchedule/computeCandidatLibreSchedule.
 */

const root = process.cwd();

function read(relPath: string): string {
  return readFileSync(join(root, relPath), 'utf8');
}

const situation: SituationInput = {
  level: 'terminale',
  examSession: 2027,
  specialites: ['MATHEMATIQUES', 'NSI'],
};

const budget: BudgetInput = { monthlyBudgetTnd: 1200, strategy: 'BEST_BALANCE' };

function priceAt(pedagogicalUrgencyMonths: number | undefined) {
  return buildRecommendation({
    situation,
    diagnosticDomainScores: null,
    budget,
    pedagogicalUrgencyMonths,
  });
}

describe('PEDAGOGICAL_URGENCY_CANNOT_CHANGE_COMMERCIAL_SCHEDULE — ADR-MID-YEAR-BILLING-MODEL.md', () => {
  test('0. sanity: the urgency signal itself genuinely varies across the sweep (this is not a no-op check)', () => {
    const values = [1, 3, 6, 10].map(urgencyFactor);
    expect(new Set(values).size).toBe(4);
    expect(values[0]).toBeGreaterThan(values[3]);
  });

  test('1. same dossier at 1/3/6/10 months remaining -> identical grandTotal/deposit/monthlyTotal/paymentPolicy for every scenario', () => {
    const results = [1, 3, 6, 10, undefined].map((m) => priceAt(m));
    const baseline = results[0].scenarios.map((s) => ({
      tier: s.tier,
      grandTotal: s.grandTotal,
      deposit: s.deposit,
      monthlyTotal: s.monthlyTotal,
      paymentPolicy: s.paymentPolicy,
    }));

    for (const result of results.slice(1)) {
      const projected = result.scenarios.map((s) => ({
        tier: s.tier,
        grandTotal: s.grandTotal,
        deposit: s.deposit,
        monthlyTotal: s.monthlyTotal,
        paymentPolicy: s.paymentPolicy,
      }));
      expect(projected).toEqual(baseline);
    }
  });

  test('2a. canonical domain names the value pedagogicalUrgencyMonths, never monthsRemaining, in priority.ts', () => {
    const priority = read('lib/quotes/priority.ts');
    expect(priority).toMatch(/pedagogicalUrgencyMonths/);
    expect(priority).not.toMatch(/monthsRemaining/);
  });

  test('2b. canonical domain names the value pedagogicalUrgencyMonths, never monthsRemaining, in pipeline.ts', () => {
    const pipeline = read('lib/quotes/pipeline.ts');
    expect(pipeline).toMatch(/pedagogicalUrgencyMonths/);
    expect(pipeline).not.toMatch(/monthsRemaining/);
  });

  test('2c. canonical domain names the value pedagogicalUrgencyMonths, never monthsRemaining, in recommendation.ts', () => {
    const recommendation = read('lib/quotes/recommendation.ts');
    expect(recommendation).toMatch(/pedagogicalUrgencyMonths/);
    expect(recommendation).not.toMatch(/monthsRemaining/);
  });

  test('2d. the public HTTP boundary keeps the wire-compatible monthsRemaining field but maps it locally to pedagogicalUrgencyMonths, citing the ADR', () => {
    const route = read('app/api/quotes/recommend/route.ts');
    expect(route).toMatch(/monthsRemaining:\s*z\.number/);
    expect(route).toMatch(/pedagogicalUrgencyMonths:\s*input\.monthsRemaining/);
    expect(route).toMatch(/ADR-MID-YEAR-BILLING-MODEL\.md/);
  });

  test('3. neither name ever reaches the schedule/deposit builders', () => {
    const pricing = read('lib/quotes/pricing.ts');
    const legacyPricing = read('lib/pricing.ts');
    expect(pricing).not.toMatch(/monthsRemaining|pedagogicalUrgencyMonths/);
    expect(legacyPricing).not.toMatch(/monthsRemaining|pedagogicalUrgencyMonths/);
  });
});
