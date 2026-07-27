import { runStagePlanningValidation } from '@/scripts/validate-stage-planning';

/**
 * Structural + pedagogical gate for the stage planning (Lot 1.4). Must stay
 * green through every subsequent change to the campaign schedule — a red
 * result here means a real resource conflict or an impossible pedagogical
 * combination, never something to silently work around.
 */
describe('Pré-rentrée 2026 — stage planning validator', () => {
  it('reports zero violations against the live campaign data', () => {
    const result = runStagePlanningValidation();
    expect(result.violations).toEqual([]);
  });

  it('keeps every module at exactly 5 sessions (volume = 10h per subject)', () => {
    const result = runStagePlanningValidation();
    expect(result.summary.modulesCount).toBeGreaterThan(0);
    expect(result.summary.sessionTemplatesCount).toBe(result.summary.modulesCount * 5);
  });

  it('never lets the itinerary engine give up or exceed the 60-minute idle cap on an actionable combination', () => {
    const result = runStagePlanningValidation();
    const allCombinations = Object.values(result.summary.combinationsByLevel).flat();
    expect(allCombinations.length).toBeGreaterThan(0);
    for (const combination of allCombinations) {
      expect(combination.status).not.toBe('REQUIRES_MANUAL_REVIEW');
      if (combination.status === 'COMPACT' || combination.status === 'NO_SHARED_DAY') {
        expect(combination.maxIdleMinutes).toBeLessThanOrEqual(60);
      }
    }
  });

  it('never enumerates a Terminale combination with 3+ specialties or a Première combination with 4+', () => {
    const result = runStagePlanningValidation();
    const SPECIALTIES = new Set(['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'NSI', 'SVT']);
    for (const combination of result.summary.combinationsByLevel.TERMINALE ?? []) {
      const specialtyCount = combination.subjects.filter((s) => SPECIALTIES.has(s)).length;
      expect(specialtyCount).toBeLessThanOrEqual(2);
    }
    for (const combination of result.summary.combinationsByLevel.PREMIERE ?? []) {
      const specialtyCount = combination.subjects.filter((s) => SPECIALTIES.has(s)).length;
      expect(specialtyCount).toBeLessThanOrEqual(3);
    }
  });

  it('never enumerates Mathématiques expertes without Mathématiques', () => {
    const result = runStagePlanningValidation();
    for (const combination of result.summary.combinationsByLevel.TERMINALE ?? []) {
      if (combination.subjects.includes('MATHS_EXPERTES')) {
        expect(combination.subjects).toContain('MATHEMATIQUES');
      }
    }
  });
});
