/**
 * computeCandidatLibreSchedule — commercial decision 2026-09-02 (URGENT FAIR
 * HOTFIX, supersedes D4's 25% acompte model): candidat-individuel annual
 * offers are SANS ACOMPTE, exactly 10 identical monthly installments
 * (price_annual / 10). Scope confirmed ALL_CANDIDAT_QUOTES via the source
 * commit's own test-suite diff (5ebac7ee2) — no contradictory active
 * decision found.
 */
import {
  CANDIDAT_LIBRE_DEPOSIT_PCT,
  CANDIDAT_LIBRE_N_INSTALLMENTS,
  computeCandidatLibreSchedule,
} from '@/lib/quotes/pricing';

describe('computeCandidatLibreSchedule — sans acompte, 10 mensualités (2026-09-02)', () => {
  test('constants reflect the current, in-force commercial decision', () => {
    expect(CANDIDAT_LIBRE_DEPOSIT_PCT).toBe(0);
    expect(CANDIDAT_LIBRE_N_INSTALLMENTS).toBe(10);
  });

  test('deposit is always 0 — never a false-positive acompte silently reintroduced', () => {
    const schedule = computeCandidatLibreSchedule(6200);
    expect(schedule.deposit).toBe(0);
    expect(schedule.nInstallments).toBe(10);
  });

  test('a total exactly divisible by 10 yields 10 IDENTICAL installments', () => {
    const s = computeCandidatLibreSchedule(6200);
    expect(s.installmentAmount).toBe(s.lastInstallmentAmount);
    expect(s.installmentAmount).toBe(620);
  });

  test('invariant holds for any total: deposit + installmentAmount*(n-1) + lastInstallmentAmount === totalNet', () => {
    for (const totalNet of [6200, 12345, 999, 10000, 1]) {
      const s = computeCandidatLibreSchedule(totalNet);
      const reconstructed = s.deposit + s.installmentAmount * (CANDIDAT_LIBRE_N_INSTALLMENTS - 1) + s.lastInstallmentAmount;
      expect(reconstructed).toBe(totalNet);
    }
  });

  test('rounding remainder never differs from the regular installment by more than nInstallments-1 (last absorbs the remainder)', () => {
    const s = computeCandidatLibreSchedule(12345);
    expect(Math.abs(s.lastInstallmentAmount - s.installmentAmount)).toBeLessThan(CANDIDAT_LIBRE_N_INSTALLMENTS);
  });
});
