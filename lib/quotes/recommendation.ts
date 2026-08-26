/**
 * Top-level orchestration of the quote domain engine (CDC §13/§17/§21).
 *
 * Combines exam-profile + diagnostic + priority + pricing + optimizer +
 * pack-matching into the three scenarios shown to the family: ESSENTIEL
 * (strict budget), RECOMMANDE (Nexus's balanced pick), COMPLET (the
 * pedagogically ideal parcours, uncapped). Pure, no React, no DB — every
 * price comes from lib/pricing.ts, every regulatory fact from
 * lib/exams/catalog.ts.
 */
import { getAnnualOffer, getFullPricingData, type AnnualOffer } from '@/lib/pricing';
import { assertSessionSellable, requireExamPolicy, type EligibilityAnswers } from '@/lib/exams/catalog';
import { buildExamProfile, checkBacAccelereEligibility, getExamPolicyVersion } from './exam-profile';
import { projectDiagnostic, type RawDomainScores } from './diagnostic';
import { scoreSubjects } from './priority';
import { buildIdealRecommendation, computeCandidatLibreSchedule } from './pricing';
import { optimizeForBudget } from './optimizer';
import {
  ALWAYS_INCLUDED_PRIORITY_SCORE,
  type BudgetInput,
  type QuoteScenario,
  type RecommendationResult,
  type ScenarioTier,
  type SituationInput,
} from './schemas';

const SCENARIO_TIER_BY_STRATEGY: Record<BudgetInput['strategy'], ScenarioTier> = {
  RESPECT_BUDGET: 'ESSENTIEL',
  BEST_BALANCE: 'RECOMMANDE',
  MOST_COMPLETE: 'COMPLET',
};

interface PackMatch {
  offerId: string;
  title: string;
  priceAnnual: number;
  deposit: number;
  installmentAmount: number;
  lastInstallmentAmount: number;
  includedFeatures: string[];
}

/**
 * A sur-mesure combination is replaced by a fixed canonical pack when the
 * pack covers at least the regular hours needed AND costs the same or
 * less (CDC §21). Never reconstructs a price — only reads canonical
 * numbers already validated by __tests__/lib/candidat-individuel-pricing.test.ts.
 *
 * Compares on an ANNUAL basis (price_annual vs surMesureMonthlyTotal × 10),
 * not on the monthly installment — since D4 (25% acompte), a canonical
 * offer's installment_amount is already net of its acompte while
 * surMesureMonthlyTotal is a flat rate with no acompte concept, so
 * comparing the two monthly figures directly would understate the pack's
 * real cost and over-select it.
 */
export function matchCanonicalPack(
  level: SituationInput['level'],
  regularHoursNeeded: number,
  surMesureMonthlyTotal: number,
): PackMatch | null {
  const candidateIds =
    level === 'premiere'
      ? ['premiere-libre-cap-anticipees', 'premiere-libre-renforcee']
      : ['terminale-libre-focus-bac', 'terminale-libre-integrale'];

  const candidates = candidateIds
    .map((id) => getAnnualOffer(id))
    .filter(
      (o): o is AnnualOffer & { price_annual: number; deposit: number; installment_amount: number } =>
        o != null && o.price_annual != null && o.deposit != null && o.installment_amount != null,
    )
    .filter((o) => (o.hours_per_month ?? 0) >= regularHoursNeeded)
    .sort((a, b) => a.price_annual - b.price_annual);

  const best = candidates[0];
  if (!best) return null;
  if (best.price_annual > surMesureMonthlyTotal * 10) return null;

  const annualVolume = best.hours_per_year == null
    ? []
    : [best.hours_per_month_is_ceiling ? `${best.hours_per_year} h maximum` : `${best.hours_per_year} h régulières`];
  const grandOralPolicy = getFullPricingData().rules.grand_oral_policy;
  const hasGrandOralPolicy = grandOralPolicy.applies_to_offer_ids.includes(best.id);
  const canonicalInclusions = hasGrandOralPolicy
    ? [
        ...best.included.filter((feature) => !/grand oral/i.test(feature)),
        `Grand Oral — ${
          best.id === 'terminale-libre-focus-bac'
            ? grandOralPolicy.note_focus_bac
            : grandOralPolicy.note_integrale
        }`,
      ]
    : best.included;
  return {
    offerId: best.id,
    title: best.title,
    priceAnnual: best.price_annual,
    deposit: best.deposit,
    installmentAmount: best.installment_amount,
    lastInstallmentAmount: best.last_installment ?? best.installment_amount,
    includedFeatures: [...annualVolume, ...canonicalInclusions],
  };
}

export interface BuildRecommendationInput {
  situation: SituationInput;
  /** Raw per-domain diagnostic scores, or null when no bilan has been done yet. */
  diagnosticDomainScores: RawDomainScores | null;
  overconfidentDomainKeys?: Set<string>;
  budget: BudgetInput;
  /** 1-10 (September=1 .. June=10). Defaults to a full year. */
  monthsRemaining?: number;
  /** Answers to the Article 3 same-session ("Bac accéléré") eligibility conditions, if the candidate asked about it. */
  bacAccelereEligibilityAnswers?: EligibilityAnswers;
}

export function buildRecommendation(input: BuildRecommendationInput): RecommendationResult {
  assertSessionSellable(input.situation.examSession);
  const policy = requireExamPolicy(input.situation.examSession);
  const profile = buildExamProfile(input.situation);
  const foundationalSubjects = new Set(
    profile.filter((p) => p.defaultCandidateForRegularSupport).map((p) => p.subject),
  );
  const diagnosticResults = projectDiagnostic(
    input.situation,
    input.diagnosticDomainScores ?? {},
    input.overconfidentDomainKeys,
  );
  const priorities = scoreSubjects(profile, diagnosticResults, input.monthsRemaining);
  const ideal = buildIdealRecommendation(priorities, foundationalSubjects);

  const strategies: BudgetInput['strategy'][] = ['RESPECT_BUDGET', 'BEST_BALANCE', 'MOST_COMPLETE'];

  const scenarios: QuoteScenario[] = strategies.map((strategy) => {
    const optimized = optimizeForBudget(ideal.lines, input.budget.monthlyBudgetTnd, strategy);
    const notRecommended = [...ideal.notRecommended, ...optimized.droppedForBudget];

    const regularHoursNeeded = optimized.lines
      .filter((l) => l.modality === 'GROUPE' && l.hoursPerMonth != null)
      .reduce((sum, l) => sum + (l.hoursPerMonth ?? 0), 0);
    const pack = matchCanonicalPack(input.situation.level, regularHoursNeeded, optimized.monthlyTotal);

    if (pack) {
      return {
        tier: SCENARIO_TIER_BY_STRATEGY[strategy],
        lines: [
          {
            subject: 'pack',
            label: pack.title,
            modality: 'PACK',
            hoursPerMonth: null,
            unitPriceMonthly: pack.installmentAmount,
            priorityScore: ALWAYS_INCLUDED_PRIORITY_SCORE,
            priorityLabel: 'haute',
            reason: `Ce parcours combiné (${pack.priceAnnual} TND/an) couvre les mêmes besoins que la somme des modules équivalents (${optimized.monthlyTotal * 10} TND/an) pour un tarif identique ou inférieur.`,
            offerId: pack.offerId,
          },
        ],
        notRecommended,
        monthlyTotal: pack.installmentAmount,
        grandTotal: pack.priceAnnual,
        months: 10,
        matchedOfferId: pack.offerId,
        paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
        deposit: pack.deposit,
        lastInstallmentAmount: pack.lastInstallmentAmount,
        includedFeatures: pack.includedFeatures,
      };
    }

    const grandTotal = optimized.monthlyTotal * 10;
    const schedule = computeCandidatLibreSchedule(grandTotal);
    return {
      tier: SCENARIO_TIER_BY_STRATEGY[strategy],
      lines: optimized.lines,
      notRecommended,
      monthlyTotal: schedule.installmentAmount,
      grandTotal,
      months: 10,
      matchedOfferId: null,
      paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
      deposit: schedule.deposit,
      lastInstallmentAmount: schedule.lastInstallmentAmount,
    };
  });

  const bacAccelereEligibility = input.bacAccelereEligibilityAnswers
    ? checkBacAccelereEligibility(input.situation.examSession, input.bacAccelereEligibilityAnswers)
    : undefined;

  return {
    pricingVersion: getFullPricingData().version,
    examPolicyVersion: getExamPolicyVersion(policy),
    examSession: input.situation.examSession,
    scenarios,
    bacAccelereEligibility,
  };
}
