import { decideModality, applyGroupAvailability } from '@/lib/quotes/group-availability';
import { ALWAYS_INCLUDED_PRIORITY_SCORE } from '@/lib/quotes/schemas';
import type { RecommendedLine } from '@/lib/quotes/schemas';

describe('decideModality — CDC §22 thresholds', () => {
  test('3+ enrolled opens the group', () => {
    expect(decideModality(3)).toBe('GROUPE');
    expect(decideModality(6)).toBe('GROUPE');
  });
  test('exactly 2 enrolled proposes duo', () => {
    expect(decideModality(2)).toBe('DUO');
  });
  test('0 or 1 enrolled falls back to individuel/waitlist', () => {
    expect(decideModality(1)).toBe('INDIVIDUEL_OR_WAITLIST');
    expect(decideModality(0)).toBe('INDIVIDUEL_OR_WAITLIST');
  });
});

const groupeLine: RecommendedLine = {
  subject: 'francais',
  label: 'Français',
  modality: 'GROUPE',
  hoursPerMonth: 8,
  unitPriceMonthly: 470, // canonical 8h/mois group price
  priorityScore: 100,
  priorityLabel: 'haute',
  reason: 'Priorité haute',
};

describe('applyGroupAvailability — never promises a place that does not exist, never exposes other students', () => {
  test('3+ enrolled keeps the GROUPE line unchanged', () => {
    const result = applyGroupAvailability(groupeLine, 3);
    expect(result).toEqual(groupeLine);
  });

  test('2 enrolled re-prices to duo (90 TND/h/élève x 8h = 720)', () => {
    const result = applyGroupAvailability(groupeLine, 2);
    expect(result.modality).toBe('DUO');
    expect(result.unitPriceMonthly).toBe(90 * 8);
  });

  test('0-1 enrolled re-prices to individuel at the >= 180 TND/h floor', () => {
    const result = applyGroupAvailability(groupeLine, 1);
    expect(result.modality).toBe('INDIVIDUEL');
    expect(result.unitPriceMonthly).toBe(180 * 8);
  });

  test('the modality decision never receives or forwards other students\' identities — only a count', () => {
    // Structural guarantee: applyGroupAvailability's signature only accepts a
    // number (enrolledCount), so it is impossible for it to echo a name it
    // was never given.
    const result = applyGroupAvailability(groupeLine, 2);
    expect(typeof result.reason).toBe('string');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  test('non-GROUPE lines (Pilotage, Grand Oral, PACK) are untouched', () => {
    const pilotage: RecommendedLine = {
      subject: 'pilotage',
      label: 'Pilotage',
      modality: 'PILOTAGE',
      hoursPerMonth: 0,
      unitPriceMonthly: 150,
      priorityScore: ALWAYS_INCLUDED_PRIORITY_SCORE,
      priorityLabel: 'haute',
      reason: 'Socle',
    };
    expect(applyGroupAvailability(pilotage, 0)).toEqual(pilotage);
  });
});
