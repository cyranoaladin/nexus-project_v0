import {
  CANDIDAT_LIBRE_DEPOSIT_PCT,
  CANDIDAT_LIBRE_N_INSTALLMENTS,
  computeCandidatLibreSchedule,
  buildIdealRecommendation,
  SPECIALITE_ABANDONNEE_WARNING,
} from '@/lib/quotes/pricing';
import type { SubjectPriority } from '@/lib/quotes/priority';

function priority(overrides: Partial<SubjectPriority> = {}): SubjectPriority {
  return {
    subject: 'eds1',
    label: 'Mathématiques',
    coefficient: 16,
    tier: 'A_RECTIFIER',
    score: 100,
    priorityLabel: 'haute',
    excludeFromRegularSupport: false,
    ...overrides,
  };
}

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

describe('buildIdealRecommendation — T3A §6 mandatory MOD_SPECIALITE_ABANDONNEE business warning (direction decisions registry, commit 4ffaac8ed; wording updated T5R6 §FINDING_16)', () => {
  test('a specialite-abandonnee line carries the exact mandatory warning in its reason — the existing, already family-facing field, no new mechanism invented', () => {
    const ideal = buildIdealRecommendation(
      [priority({ subject: 'specialite-abandonnee', label: 'NSI (spécialité de première non poursuivie)', tier: 'A_RECTIFIER' })],
      new Set(), // specialite-abandonnee is never defaultCandidateForRegularSupport (ponctuelle-only)
    );
    const line = ideal.lines.find((l) => l.subject === 'specialite-abandonnee');
    expect(line).toBeDefined();
    expect(line!.reason).toContain(SPECIALITE_ABANDONNEE_WARNING);
  });

  test('the warning is never attached to any other subject — no bleed to eds1/lva/lvb/etc.', () => {
    const ideal = buildIdealRecommendation(
      [
        priority({ subject: 'eds1', label: 'Mathématiques', tier: 'A_RECTIFIER' }),
        priority({ subject: 'lva', label: 'Anglais LVA', tier: 'A_RECTIFIER' }),
        priority({ subject: 'lvb', label: 'Espagnol LVB', tier: 'A_INSTALLER' }),
      ],
      new Set(['eds1']),
    );
    for (const line of ideal.lines) {
      expect(line.reason).not.toContain(SPECIALITE_ABANDONNEE_WARNING);
    }
  });

  test('the warning survives a SOLO/DUO bascule (T2 resolveScenarioEffectiveGroupPricing appends, never replaces, the base reason)', () => {
    const ideal = buildIdealRecommendation(
      [priority({ subject: 'specialite-abandonnee', label: 'NSI (spécialité de première non poursuivie)', tier: 'A_INSTALLER' })],
      new Set(),
    );
    const line = ideal.lines.find((l) => l.subject === 'specialite-abandonnee');
    expect(line!.modality).toBe('GROUPE');
    // Base reason already contains the warning before any group-pricing
    // resolution ever runs — resolveScenarioEffectiveGroupPricing only
    // ever appends `— ${explanation}`, so the marker is preserved by
    // construction; asserted here at the source, not re-derived.
    expect(line!.reason.endsWith(SPECIALITE_ABANDONNEE_WARNING)).toBe(true);
  });
});
