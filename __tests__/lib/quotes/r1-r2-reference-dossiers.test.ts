/**
 * R1/R2 — the two reference "devis personnalisé V1" dossiers named in
 * docs/candidat-individuel/ADR-MID-YEAR-BILLING-MODEL.md (§ examples).
 * Incrément 2's engine-inventory audit established that this product
 * ("devis personnalisé V1") is created through the LEGACY engine
 * (buildRecommendation, lib/quotes/recommendation.ts) via the staff
 * console / POST /api/quotes — not the carte-aware canonical pipeline
 * (buildCandidateQuoteRecommendation). Incrément 3 does not touch
 * recommendation.ts at all — these are new regression locks for numbers
 * that had NO executable test anywhere in the repo before this file
 * (confirmed by exhaustive grep of the exact amounts and of "R1"/"R2" as
 * test names — see docs/audits/candidat-individuel-zero-debt-reachability.md
 * incrément 3 report), not a migration risk.
 *
 * R1: Pilotage 150, Maths 250, NSI 250, Philo 250, Grand Oral 144
 *   total 10 440, acompte 2 610, 10 mensualités de 783 TND.
 * Reproduced end-to-end through buildRecommendation: TERMINALE,
 * spécialités Mathématiques + NSI, sans bilan (diagnostic absent — every
 * subject NON_EVALUE, so only the 5 foundational/regular-support
 * subjects — Pilotage + 2 EDS + Philo + Grand Oral — are ever included,
 * CDC §18/§48), budget suffisant (>=1200 TND/mois, empirically the
 * threshold below which the optimizer starts downgrading — verified by
 * probing all three strategies converge on the identical 5-line result
 * at this budget, matching R1 exactly to the TND for all three tiers).
 *
 * R2: Pilotage 150, NSI abandonnée Première 250, LVA individuel 720,
 *   LVB duo 360 — total 14 800, acompte 3 700, 10 mensualités de 1110 TND.
 * This composition mixes a ponctuelle-only spécialité abandonnée AND two
 * different per-language MODALITIES (individuel vs duo) for LVA/LVB — a
 * staff hand-curated line selection (the real "devis personnalisé" use
 * case: a human picks and prices specific lines), not something
 * buildRecommendation's automatic diagnostic-driven scoring/optimizer
 * reproduces on its own (confirmed empirically: without a diagnosed
 * weakness, ponctuelle-only subjects are never auto-included, and the
 * automatic engine does not expose an independent per-language modality
 * choice). Reproducing the exact line SELECTION end-to-end would require
 * fabricating diagnostic/staff-override inputs not documented anywhere —
 * that would be inventing behavior, not locking it. What IS locked here,
 * honestly and without overclaiming: the payment-schedule computation
 * (lib/quotes/pricing.ts::computeCandidatLibreSchedule) — the actual
 * invariant ADR-MID-YEAR-BILLING-MODEL.md is about — applied to R2's
 * stated grandTotal, proving 25%/10-installments holds exactly at this
 * total regardless of which lines produced it.
 */
import { buildRecommendation } from '@/lib/quotes/recommendation';
import { computeCandidatLibreSchedule } from '@/lib/quotes/pricing';
import type { SituationInput } from '@/lib/quotes/schemas';

describe('R1 — Pilotage/Maths/NSI/Philo/Grand Oral, via buildRecommendation (legacy engine, live /devis-bac)', () => {
  const situation: SituationInput = { level: 'terminale', examSession: 2027, specialites: ['MATHEMATIQUES', 'NSI'] };

  test.each(['RESPECT_BUDGET', 'BEST_BALANCE', 'MOST_COMPLETE'] as const)(
    'strategy=%s at budget=1200 TND/mois: total 10 440, acompte 2 610, 10 mensualités de 783 TND',
    (strategy) => {
      const result = buildRecommendation({
        situation,
        diagnosticDomainScores: null,
        budget: { monthlyBudgetTnd: 1200, strategy },
      });
      const scenario = result.scenarios.find((s) => s.tier === (strategy === 'RESPECT_BUDGET' ? 'ESSENTIEL' : strategy === 'BEST_BALANCE' ? 'RECOMMANDE' : 'COMPLET'))!;

      expect(scenario.grandTotal).toBe(10440);
      expect(scenario.deposit).toBe(2610);
      expect(scenario.monthlyTotal).toBe(783);
      expect(scenario.lastInstallmentAmount).toBe(783);
      expect(scenario.paymentPolicy).toBe('ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS');

      const bySubject = new Map(scenario.lines.map((l) => [l.subject, l]));
      expect(bySubject.get('pilotage')?.unitPriceMonthly).toBe(150);
      expect(bySubject.get('eds1')?.unitPriceMonthly).toBe(250);
      expect(bySubject.get('eds2')?.unitPriceMonthly).toBe(250);
      expect(bySubject.get('philosophie')?.unitPriceMonthly).toBe(250);
      expect(bySubject.get('grand-oral')?.unitPriceMonthly).toBe(144);
      expect(scenario.lines).toHaveLength(5);
    },
  );
});

describe('R2 — payment-schedule invariant at the stated total (ADR-MID-YEAR-BILLING-MODEL.md), line selection out of scope (staff hand-curated, see file header)', () => {
  test('grandTotal 14 800 -> acompte 3 700, 10 mensualités de 1110 TND, ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS shape', () => {
    const schedule = computeCandidatLibreSchedule(14800);
    expect(schedule.deposit).toBe(3700);
    expect(schedule.installmentAmount).toBe(1110);
    expect(schedule.lastInstallmentAmount).toBe(1110);
    expect(schedule.nInstallments).toBe(10);
    expect(schedule.deposit + schedule.installmentAmount * (schedule.nInstallments - 1) + schedule.lastInstallmentAmount).toBe(14800);
  });
});
