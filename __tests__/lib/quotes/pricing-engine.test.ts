import {
  applyDiscounts,
  computeSecondGroupePayment,
  DiscountRejectedError,
  NoCostDataError,
  resolveGroupModality,
  resolveRate,
} from '@/lib/quotes/pricing-engine';

describe('resolveRate — résolution des règles tarifaires (mission §7)', () => {
  test('PILOTAGE_MONTHLY résout vers candidat_individuel_modules.pilotage', () => {
    const rate = resolveRate('PILOTAGE_MONTHLY');
    expect(rate.kind).toBe('flat_monthly');
    expect(rate.amountTnd).toBeGreaterThan(0);
  });

  test('PETIT_GROUPE_8H expose hoursPerMonth/groupMinOpen/groupMax depuis la table existante', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    expect(rate.hoursPerMonth).toBe(8);
    expect(rate.groupMinOpen).toBeGreaterThan(0);
    expect(rate.groupMax).toBeGreaterThan(0);
  });
});

describe('P11 — paiement intégral à la réservation (mission §6)', () => {
  test('aucun acompte, aucune mensualité — 100% du total, un seul versement', () => {
    const payment = computeSecondGroupePayment(1500);
    expect(payment.depositTnd).toBe(1500);
    expect(payment.remainingTnd).toBe(0);
    expect(payment.nInstallments).toBe(1);
  });
});

describe('Remises (mission §7/§9 — plafond 20%, non cumulables) — kept as a deliberate exception to the Phase F dead-code deletion; see pricing-engine.ts\'s top doc comment', () => {
  test('une remise unique sous le plafond est acceptée', () => {
    const result = applyDiscounts(1000, [{ label: 'comptant', pct: 5 }]);
    expect(result.appliedPct).toBe(5);
    expect(result.finalAmountTnd).toBe(950);
  });

  test('une remise cumulée dépassant 20% est bloquée', () => {
    expect(() => applyDiscounts(1000, [{ label: 'fratrie', pct: 25 }])).toThrow(DiscountRejectedError);
  });

  test('deux remises simultanées sont bloquées (non cumulables, rules.discounts.cumulable=false)', () => {
    expect(() =>
      applyDiscounts(1000, [
        { label: 'fratrie', pct: 10 },
        { label: 'carte_nexus', pct: 10 },
      ]),
    ).toThrow(DiscountRejectedError);
  });
});

describe('Effectif insuffisant / bascule DUO-SOLO (mission §9)', () => {
  test('effectif >= seuil : reste GROUPE', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    const resolved = resolveGroupModality(rate.groupMinOpen!, 8, rate);
    expect(resolved.modality).toBe('GROUPE');
  });

  test('effectif = 2 < seuil : bascule DUO', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    const resolved = resolveGroupModality(2, 8, rate);
    expect(resolved.modality).toBe('DUO');
    expect(resolved.monthlyAmountTnd).toBeGreaterThan(0);
  });

  test('effectif = 1 < seuil, pas DUO : bascule individuel (SOLO)', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    const resolved = resolveGroupModality(1, 8, rate);
    expect(resolved.modality).toBe('SOLO');
    expect(resolved.monthlyAmountTnd).toBeGreaterThan(0);
  });

  // T2 (CANDIDAT INDIVIDUEL HEADCOUNT & GROUP STATE SAFETY, direction
  // decision registry 4ffaac8ed) — before this lot, effectif=0/negative/
  // fractional silently fell through to the SOLO branch (neither >= seuil
  // nor === 2), mispricing an invalid input as a confirmed 1-student
  // group instead of rejecting it. Hardened defensively even though the
  // only real caller (resolveScenarioEffectiveGroupPricing) already
  // validates upstream — resolveGroupModality is exported and must be
  // safe to call directly.
  test('effectif = 0 is rejected, never silently treated as SOLO', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    expect(() => resolveGroupModality(0, 8, rate)).toThrow(NoCostDataError);
  });

  test('effectif négatif is rejected, never silently treated as SOLO', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    expect(() => resolveGroupModality(-2, 8, rate)).toThrow(NoCostDataError);
  });

  test('effectif fractionnaire is rejected, never silently treated as SOLO', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    expect(() => resolveGroupModality(1.5, 8, rate)).toThrow(NoCostDataError);
  });

  test('effectif au-dessus du max catalogue (7 > 6) is rejected — voir group-headcount-resolution.test.ts pour la couverture complète de ce cas (Phase E)', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    expect(() => resolveGroupModality(7, 8, rate)).toThrow(NoCostDataError);
  });
});
