/**
 * T1 — CANDIDAT INDIVIDUEL POLICY SAFETY CORE, §5 "Remise × marge —
 * invariant obligatoire" (direction decision registry, commit 4ffaac8ed).
 *
 * Audit finding (documented, not invented): as of this lot, NO real quote-
 * creation path applies a discount at all — grep confirms `applyDiscounts`
 * (lib/quotes/pricing-engine.ts) has zero callers outside its own file and
 * tests, in both the candidat-individuel route
 * (app/api/assistante/candidat-individuel/profils/[id]/quote/route.ts) and
 * the legacy public route (app/api/quotes/route.ts). The "discount
 * validated on the pre-discount price, then emitted post-discount without
 * a new margin check" risk this invariant guards against therefore cannot
 * be reproduced against a real, live code path today — there is no live
 * path that applies a discount at all.
 *
 * Per the T1 mandate ("si l'audit révèle que l'hypothèse du lot est
 * fausse... documente le blocker au lieu d'inventer une règle"): this
 * file does NOT wire a new discount parameter into the real route (that
 * would be a new commercial capability, never decided by direction — the
 * registry approved the 20%/non-cumulable VALUES as governance
 * parameters, never a decision to expose discount application on this
 * route). Instead it does two things that are safe, real, and immediately
 * useful once a discount path is ever wired:
 *
 * 1. Proves the CORRECT composition (discount before margin, on the net
 *    price) produces the right gate, using the two real, already-shipped
 *    functions (applyDiscounts + computeMargin) — nothing invented,
 *    nothing routed.
 * 2. Locks the CURRENT safe state of the real route's request schema (no
 *    discount field exists) as a tested invariant — if a future lot adds
 *    one without updating this test, the test fails and forces an
 *    explicit decision, rather than a silent gap reappearing.
 */
import { applyDiscounts, DiscountRejectedError } from '@/lib/quotes/pricing-engine';
import { computeMargin, type CommercialCostPolicy } from '@/lib/quotes/margin.server';
import { createQuoteFromProfilBodySchema } from '@/lib/quotes/candidat-individuel-api-schemas';
import type { RecommendedLine } from '@/lib/quotes/schemas';

const policy: CommercialCostPolicy = {
  source: 'BLENDED_FALLBACK',
  teacherNominalCostPerHourTnd: 100,
  structureCostPerHourTnd: 0,
  oneOffDossierCostTnd: 0, // kept 0 — this file tests discount/margin composition, not the one-off dossier cost (covered in margin.test.ts).
  marginGates: { greenPct: 40, warningPct: 30 },
};

function lineAt(unitPriceMonthly: number): RecommendedLine {
  return {
    subject: 'francais',
    label: 'Français',
    modality: 'GROUPE',
    hoursPerMonth: 8,
    unitPriceMonthly,
    priorityScore: 100,
    priorityLabel: 'haute',
    reason: 'test',
  };
}

describe('applyDiscounts -> computeMargin composition (correct order: discount first, margin on the net price)', () => {
  test('a discount that keeps the net price healthy still lands MARGIN_OK on the net price, not the gross price', () => {
    const grossLine = lineAt(1000);
    const { finalAmountTnd } = applyDiscounts(grossLine.unitPriceMonthly, [{ label: 'test', pct: 5 }]);
    const netLine = { ...grossLine, unitPriceMonthly: finalAmountTnd };
    const result = computeMargin([netLine], policy);
    expect(finalAmountTnd).toBe(950);
    expect(result.marginPct).toBeLessThan(computeMargin([grossLine], policy).marginPct);
    expect(result.gate).toBe('MARGIN_OK');
  });

  test('a discount large enough to push the net margin from MARGIN_OK to BLOCKED is correctly caught when margin is computed on the net price', () => {
    // GROUPE/8h delivery cost (teacher 100 TND/h x 8h / conservative
    // projected headcount 3 = 266.67 TND/month) doesn't scale with price,
    // so a price chosen just above the gross MARGIN_OK boundary crosses
    // well below 30% after a 20% discount, since the fixed cost becomes a
    // much larger share of a smaller net price. Solved directly from
    // computeMargin's own formula (never a hand-guessed magic number):
    // gross margin 41% => price = deliveryCost / (1 - 0.41).
    const deliveryCostPerMonth = (policy.teacherNominalCostPerHourTnd * 8) / 3;
    const grossPrice = Math.round(deliveryCostPerMonth / (1 - 0.41));
    const gross = lineAt(grossPrice);
    const grossMargin = computeMargin([gross], policy);
    expect(grossMargin.gate).toBe('MARGIN_OK');

    const { finalAmountTnd, appliedPct } = applyDiscounts(gross.unitPriceMonthly, [{ label: 'remise max', pct: 20 }]);
    expect(appliedPct).toBe(20);
    const netLine = { ...gross, unitPriceMonthly: finalAmountTnd };
    const netMargin = computeMargin([netLine], policy);

    // Proves the invariant this lot must guard: computing margin on the
    // GROSS price after this discount would have wrongly reported the
    // pre-discount gate — the net-price computation is the only one that
    // reflects what the family is actually charged.
    expect(netMargin.marginPct).toBeLessThan(grossMargin.marginPct);
    expect(netMargin.gate).not.toBe(grossMargin.gate);
  });

  test('remise > 20% is refused before it ever reaches computeMargin — the invariant is enforced upstream, not by margin alone', () => {
    expect(() => applyDiscounts(1000, [{ label: 'trop généreuse', pct: 25 }])).toThrow(DiscountRejectedError);
  });

  test('cumul de remises est refusé avant tout calcul de marge', () => {
    expect(() => applyDiscounts(1000, [{ label: 'a', pct: 10 }, { label: 'b', pct: 10 }])).toThrow(DiscountRejectedError);
  });
});

describe('Architecture lock — the real candidat-individuel quote-creation route currently accepts NO discount input (T1 audit finding)', () => {
  test('createQuoteFromProfilBodySchema has no discount-shaped field — a real devis is always priced at the catalogue price, never a post-discount price', () => {
    const parsed = createQuoteFromProfilBodySchema.safeParse({
      idempotencyKey: 'a'.repeat(10),
      budget: { monthlyBudgetTnd: 2000, strategy: 'MOST_COMPLETE' },
      scenarioTier: 'RECOMMANDE',
      discount: { pct: 20 },
    });
    // .strict() schema — an unknown "discount" key must be rejected, not
    // silently dropped. If this ever starts passing, a discount input has
    // been added to this route without the corresponding margin-recompute
    // safeguard this lot's tests above assume — treat that as a signal to
    // build the recompute-on-net-price path, not to relax this test.
    expect(parsed.success).toBe(false);
  });
});
