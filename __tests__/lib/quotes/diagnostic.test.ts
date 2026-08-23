import { percentageToTier, projectDiagnostic, computeDiagnosticChecksum, DIAGNOSTIC_TIER_THRESHOLDS } from '@/lib/quotes/diagnostic';
import type { SituationInput } from '@/lib/quotes/schemas';

describe('percentageToTier — documented, centralized thresholds', () => {
  test('null percentage -> NON_EVALUE', () => {
    expect(percentageToTier(null)).toBe('NON_EVALUE');
  });
  test('boundary values resolve to the documented tier', () => {
    expect(percentageToTier(DIAGNOSTIC_TIER_THRESHOLDS.SOLIDE)).toBe('SOLIDE');
    expect(percentageToTier(DIAGNOSTIC_TIER_THRESHOLDS.SOLIDE - 1)).toBe('A_CONSOLIDER');
    expect(percentageToTier(DIAGNOSTIC_TIER_THRESHOLDS.A_CONSOLIDER)).toBe('A_CONSOLIDER');
    expect(percentageToTier(DIAGNOSTIC_TIER_THRESHOLDS.A_CONSOLIDER - 1)).toBe('A_INSTALLER');
    expect(percentageToTier(DIAGNOSTIC_TIER_THRESHOLDS.A_INSTALLER)).toBe('A_INSTALLER');
    expect(percentageToTier(DIAGNOSTIC_TIER_THRESHOLDS.A_INSTALLER - 1)).toBe('A_RECTIFIER');
    expect(percentageToTier(0)).toBe('A_RECTIFIER');
  });
});

const premiereSituation: SituationInput = {
  level: 'premiere',
  examSession: 2027,
  specialites: ['MATHEMATIQUES', 'NSI'],
};

const terminaleSituation: SituationInput = {
  level: 'terminale',
  examSession: 2027,
  specialites: ['MATHEMATIQUES', 'NSI'],
  specialiteAbandonnee: 'SES',
  langueA: 'ANGLAIS',
};

describe('projectDiagnostic — never guesses a subject the diagnostic has no data for', () => {
  test('no bilan at all -> every subject NON_EVALUE', () => {
    const results = projectDiagnostic(premiereSituation, {});
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.tier).toBe('NON_EVALUE');
      expect(r.percentage).toBeNull();
    }
  });

  test('a subject the diagnostic tool has never covered (e.g. Physique-Chimie) stays NON_EVALUE even with rich data elsewhere', () => {
    const situation: SituationInput = {
      level: 'terminale',
      examSession: 2027,
      specialites: ['PHYSIQUE_CHIMIE', 'SVT'],
    };
    const results = projectDiagnostic(situation, {
      mathematiques: { points: 90, maxPoints: 100, percentage: 90 },
    });
    const eds1 = results.find((r) => r.subject === 'eds1')!;
    expect(eds1.tier).toBe('NON_EVALUE');
    expect(eds1.percentage).toBeNull();
  });

  test('francais averages only the domains with real data (production_ecrite missing is ignored, not zeroed)', () => {
    const results = projectDiagnostic(premiereSituation, {
      francais_academique: { points: 80, maxPoints: 100, percentage: 80 },
      langue: { points: 60, maxPoints: 100, percentage: 60 },
    });
    const francais = results.find((r) => r.subject === 'francais')!;
    expect(francais.percentage).toBe(70); // (80+60)/2, production_ecrite/expression_orale ignored
    expect(francais.tier).toBe('A_CONSOLIDER');
  });

  test('a solid EDS (mathematiques) resolves SOLIDE from real percentage data', () => {
    const results = projectDiagnostic(terminaleSituation, {
      mathematiques: { points: 92, maxPoints: 100, percentage: 92 },
    });
    const eds1 = results.find((r) => r.subject === 'eds1')!;
    expect(eds1.tier).toBe('SOLIDE');
  });

  test('overconfidence flag propagates from the domain to the subject projection', () => {
    const results = projectDiagnostic(
      terminaleSituation,
      { mathematiques: { points: 50, maxPoints: 100, percentage: 50 } },
      new Set(['mathematiques']),
    );
    const eds1 = results.find((r) => r.subject === 'eds1')!;
    expect(eds1.overconfident).toBe(true);
  });

  test('specialite-abandonnee only appears when the situation declares one', () => {
    const withAbandon = projectDiagnostic(terminaleSituation, {});
    expect(withAbandon.some((r) => r.subject === 'specialite-abandonnee')).toBe(true);

    const without = projectDiagnostic({ ...terminaleSituation, specialiteAbandonnee: undefined }, {});
    expect(without.some((r) => r.subject === 'specialite-abandonnee')).toBe(false);
  });
});

describe('computeDiagnosticChecksum — deterministic, order-independent', () => {
  test('same subjects in different order produce the same checksum', () => {
    const a = [
      { subject: 'francais' as const, tier: 'SOLIDE' as const, percentage: 90, overconfident: false },
      { subject: 'maths-anticipees' as const, tier: 'A_RECTIFIER' as const, percentage: 20, overconfident: true },
    ];
    const b = [a[1], a[0]];
    expect(computeDiagnosticChecksum(a)).toBe(computeDiagnosticChecksum(b));
  });

  test('a changed percentage changes the checksum', () => {
    const a = [{ subject: 'francais' as const, tier: 'SOLIDE' as const, percentage: 90, overconfident: false }];
    const b = [{ subject: 'francais' as const, tier: 'A_CONSOLIDER' as const, percentage: 60, overconfident: false }];
    expect(computeDiagnosticChecksum(a)).not.toBe(computeDiagnosticChecksum(b));
  });
});
