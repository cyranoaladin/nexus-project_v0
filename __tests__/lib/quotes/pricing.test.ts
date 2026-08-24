import {
  CANDIDAT_LIBRE_DEPOSIT_PCT,
  CANDIDAT_LIBRE_N_INSTALLMENTS,
  computeCandidatLibreSchedule,
} from '@/lib/quotes/pricing';

describe('computeCandidatLibreSchedule — D4 (25% acompte + 10 mensualités)', () => {
  test('deposit is exactly 25% (rounded to the nearest 10 TND) of the net total', () => {
    expect(CANDIDAT_LIBRE_DEPOSIT_PCT).toBe(25);
    expect(CANDIDAT_LIBRE_N_INSTALLMENTS).toBe(10);

    const schedule = computeCandidatLibreSchedule(6200);
    expect(schedule.deposit).toBe(1550);
    expect(schedule.nInstallments).toBe(10);
  });

  test('invariant: deposit + installmentAmount x (n-1) + lastInstallmentAmount === totalNet, never off by a dinar', () => {
    const totals = [1500, 6200, 7900, 11900, 12900, 16900, 999, 1000, 12345, 7, 0];
    for (const totalNet of totals) {
      const s = computeCandidatLibreSchedule(totalNet);
      const reconstructed = s.deposit + s.installmentAmount * (s.nInstallments - 1) + s.lastInstallmentAmount;
      expect(reconstructed).toBe(totalNet);
    }
  });

  test('the last installment absorbs the rounding remainder — never negative, never larger than a rounding step away from the regular installment', () => {
    const s = computeCandidatLibreSchedule(12345);
    expect(s.lastInstallmentAmount).toBeGreaterThanOrEqual(0);
    expect(Math.abs(s.lastInstallmentAmount - s.installmentAmount)).toBeLessThan(CANDIDAT_LIBRE_N_INSTALLMENTS);
  });

  test('the 6 candidat-libre canonical SKUs each resolve to exactly 25% (nearest 10 TND) with 10 clean installments', () => {
    const skuTotals: Record<string, number> = {
      'libre-pilotage': 1500,
      'libre-sur-mesure': 6200,
      'premiere-libre-cap-anticipees': 7900,
      'premiere-libre-renforcee': 11900,
      'terminale-libre-focus-bac': 12900,
      'terminale-libre-integrale': 16900,
    };
    for (const [id, total] of Object.entries(skuTotals)) {
      const s = computeCandidatLibreSchedule(total);
      const pct = s.deposit / total;
      expect(pct).toBeGreaterThan(0.24);
      expect(pct).toBeLessThan(0.26);
      expect(s.deposit % 10).toBe(0);
      const reconstructed = s.deposit + s.installmentAmount * 9 + s.lastInstallmentAmount;
      expect(reconstructed).toBe(total);
      void id;
    }
  });
});
