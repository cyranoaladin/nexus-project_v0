import { getCandidatIndividuelModules, getRules } from '@/lib/pricing';
import * as quotePricing from '@/lib/quotes/pricing';
import type { QuoteScenario } from '@/lib/quotes/schemas';

const { computeCandidatLibreSchedule } = quotePricing;

describe('recettes financières candidat individuel R1/R2', () => {
  const modules = getCandidatIndividuelModules();
  const group4h = modules.petit_groupe.find((entry) => entry.hours_per_month === 4)!;

  test('R1 conserve 10 440 TND/an, 2 610 TND d’acompte et 10 mensualités de 783 TND', () => {
    const grandOralMonthly = Math.round(
      (getRules().grand_oral_policy.total_hours_max * modules.individuel.price_per_hour_min) / 10,
    );
    const annualTotal = (
      modules.pilotage.price_monthly
      + group4h.price_per_student_monthly * 3
      + grandOralMonthly
    ) * 10;
    const schedule = computeCandidatLibreSchedule(annualTotal);

    expect(annualTotal).toBe(10_440);
    expect(schedule).toEqual({ deposit: 2_610, installmentAmount: 783, lastInstallmentAmount: 783, nInstallments: 10 });
  });

  test('R2 conserve 14 800 TND/an, 3 700 TND d’acompte et 10 mensualités de 1 110 TND', () => {
    const fourHours = group4h.hours_per_month;
    const annualTotal = (
      modules.pilotage.price_monthly
      + group4h.price_per_student_monthly
      + modules.individuel.price_per_hour_min * fourHours
      + modules.duo.price_per_hour_per_student * fourHours
    ) * 10;
    const schedule = computeCandidatLibreSchedule(annualTotal);

    expect(annualTotal).toBe(14_800);
    expect(schedule).toEqual({ deposit: 3_700, installmentAmount: 1_110, lastInstallmentAmount: 1_110, nInstallments: 10 });
  });
});

describe('base de coût interne issue du runtime canonique', () => {
  const buildMarginCostBasis = (quotePricing as unknown as {
    buildScenarioMarginCostBasis: (
      scenario: QuoteScenario,
      resolutions: Array<{
        subject: string;
        effectiveModality: 'SOLO' | 'DUO' | 'GROUPE';
        confirmedHeadcount: number;
      }>,
    ) => Array<{ subject: string; modality: string; hoursPerMonth: number; confirmedHeadcount?: number }>;
  }).buildScenarioMarginCostBasis;

  test('Grand Oral isolé convertit les 8 h annuelles canoniques en charge mensuelle sans modifier sa ligne publique', () => {
    const scenario: QuoteScenario = {
      tier: 'RECOMMANDE',
      lines: [{ subject: 'grand-oral', label: 'Grand Oral', modality: 'INDIVIDUEL', hoursPerMonth: null, unitPriceMonthly: 144, priorityScore: 100, priorityLabel: 'haute', reason: 'test' }],
      notRecommended: [], monthlyTotal: 108, grandTotal: 1440, months: 10,
      matchedOfferId: null, paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS', deposit: 360, lastInstallmentAmount: 108,
    };

    expect(buildMarginCostBasis(scenario, [])).toEqual([
      { subject: 'grand-oral', modality: 'INDIVIDUEL', hoursPerMonth: getRules().grand_oral_policy.total_hours_max / 10 },
    ]);
    expect(scenario.lines).toHaveLength(1);
    expect(scenario.lines[0].hoursPerMonth).toBeNull();
  });

  test('PACK Focus Bac utilise ses matières/effectifs résolus et ajoute son enveloppe Grand Oral canonique sans éclater la ligne publique', () => {
    const scenario: QuoteScenario = {
      tier: 'RECOMMANDE',
      lines: [{ subject: 'pack', label: 'Focus Bac', modality: 'PACK', hoursPerMonth: null, unitPriceMonthly: 1290, priorityScore: 100, priorityLabel: 'haute', reason: 'test', offerId: 'terminale-libre-focus-bac' }],
      groupHeadcountRequirements: [
        { subject: 'eds1', hoursPerMonth: 8, unitPriceMonthly: 470 },
        { subject: 'eds2', hoursPerMonth: 8, unitPriceMonthly: 470 },
        { subject: 'philosophie', hoursPerMonth: 4, unitPriceMonthly: 250 },
      ],
      notRecommended: [], monthlyTotal: 1290, grandTotal: 12900, months: 10,
      matchedOfferId: 'terminale-libre-focus-bac', paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS', deposit: 0, lastInstallmentAmount: 1290,
    };

    const costBasis = buildMarginCostBasis(scenario, [
      { subject: 'eds1', effectiveModality: 'GROUPE', confirmedHeadcount: 3 },
      { subject: 'eds2', effectiveModality: 'GROUPE', confirmedHeadcount: 4 },
      { subject: 'philosophie', effectiveModality: 'DUO', confirmedHeadcount: 2 },
    ]);

    expect(costBasis).toEqual([
      { subject: 'eds1', modality: 'GROUPE', hoursPerMonth: 8, confirmedHeadcount: 3 },
      { subject: 'eds2', modality: 'GROUPE', hoursPerMonth: 8, confirmedHeadcount: 4 },
      { subject: 'philosophie', modality: 'DUO', hoursPerMonth: 4, confirmedHeadcount: 2 },
      { subject: 'grand-oral', modality: 'INDIVIDUEL', hoursPerMonth: getRules().grand_oral_policy.total_hours_max / 10 },
    ]);
    expect(scenario.lines).toHaveLength(1);
    expect(scenario.lines[0].modality).toBe('PACK');
    expect(scenario.monthlyTotal).toBe(1290);
    expect(scenario.grandTotal).toBe(12900);
    expect(scenario.deposit).toBe(0);
  });

  test('PACK sans détails sous-jacents échoue fermé au lieu de produire un coût professeur nul', () => {
    const scenario: QuoteScenario = {
      tier: 'RECOMMANDE',
      lines: [{ subject: 'pack', label: 'Pack', modality: 'PACK', hoursPerMonth: null, unitPriceMonthly: 790, priorityScore: 100, priorityLabel: 'haute', reason: 'test', offerId: 'premiere-libre-cap-anticipees' }],
      notRecommended: [], monthlyTotal: 790, grandTotal: 7900, months: 10,
      matchedOfferId: 'premiere-libre-cap-anticipees', paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS', deposit: 0, lastInstallmentAmount: 790,
    };

    expect(() => buildMarginCostBasis(scenario, [])).toThrow('PACK margin cost basis missing');
  });

  test('Intégrale retire le dépassement aux heures les moins coûteuses avec un résultat invariant à l’ordre', () => {
    const makeScenario = (requirements: NonNullable<QuoteScenario['groupHeadcountRequirements']>): QuoteScenario => ({
      tier: 'COMPLET',
      lines: [{ subject: 'pack', label: 'Intégrale', modality: 'PACK', hoursPerMonth: null, unitPriceMonthly: 1690, priorityScore: 100, priorityLabel: 'haute', reason: 'test', offerId: 'terminale-libre-integrale' }],
      groupHeadcountRequirements: requirements,
      notRecommended: [], monthlyTotal: 1690, grandTotal: 16900, months: 10,
      matchedOfferId: 'terminale-libre-integrale', paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS', deposit: 0, lastInstallmentAmount: 1690,
    });
    const requirements = [
      { subject: 'eds1', hoursPerMonth: 8, unitPriceMonthly: 1440 },
      { subject: 'lva', hoursPerMonth: 8, unitPriceMonthly: 720 },
      { subject: 'lvb', hoursPerMonth: 14, unitPriceMonthly: 680 },
    ] satisfies NonNullable<QuoteScenario['groupHeadcountRequirements']>;
    const resolutions = [
      { subject: 'eds1', effectiveModality: 'SOLO' as const, confirmedHeadcount: 1 },
      { subject: 'lva', effectiveModality: 'DUO' as const, confirmedHeadcount: 2 },
      { subject: 'lvb', effectiveModality: 'GROUPE' as const, confirmedHeadcount: 6 },
    ];

    const forward = buildMarginCostBasis(makeScenario(requirements), resolutions);
    const reversed = buildMarginCostBasis(makeScenario([...requirements].reverse()), [...resolutions].reverse());
    const hoursBySubject = (basis: typeof forward) => Object.fromEntries(basis.map((line) => [line.subject, line.hoursPerMonth]));

    expect(hoursBySubject(forward)).toEqual(hoursBySubject(reversed));
    expect(hoursBySubject(forward)).toEqual({ eds1: 8, lva: 8, lvb: 13.2, 'grand-oral': 0.8 });
  });
});
