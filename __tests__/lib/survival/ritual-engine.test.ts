import { chooseDailyRitual } from '@/lib/survival/ritual-engine';
import type { SurvivalProgressSnapshot } from '@/lib/survival/types';

function progress(overrides: Partial<SurvivalProgressSnapshot> = {}): SurvivalProgressSnapshot {
  return {
    reflexesState: {},
    phrasesState: {},
    qcmAttempts: 0,
    qcmCorrect: 0,
    rituals: [],
    ...overrides,
  };
}

describe('chooseDailyRitual', () => {
  it('starts with reflex 1 when it has not been seen', () => {
    const ritual = chooseDailyRitual(progress(), new Date('2026-05-01'), new Date('2026-06-08'));

    expect(ritual.kind).toBe('REFLEX');
    expect(ritual.targetId).toBe('reflex_1');
    expect(ritual.durationMinutes).toBeLessThanOrEqual(12);
  });

  it('returns exactly one short QCM action after all reflexes are seen but QCM accuracy is low', () => {
    const ritual = chooseDailyRitual(
      progress({
        reflexesState: {
          reflex_1: 'ACQUIS',
          reflex_2: 'ACQUIS',
          reflex_3: 'ACQUIS',
          reflex_4: 'ACQUIS',
          reflex_5: 'ACQUIS',
          reflex_6: 'ACQUIS',
          reflex_7: 'ACQUIS',
        },
        qcmAttempts: 10,
        qcmCorrect: 4,
      }),
      new Date('2026-05-20'),
      new Date('2026-06-08'),
    );

    expect(ritual.kind).toBe('QCM');
    expect(ritual.durationMinutes).toBeLessThanOrEqual(12);
  });

  it('switches to an exam ritual during the final week', () => {
    const ritual = chooseDailyRitual(
      progress({
        reflexesState: {
          reflex_1: 'ACQUIS',
          reflex_2: 'ACQUIS',
          reflex_3: 'ACQUIS',
          reflex_4: 'ACQUIS',
          reflex_5: 'ACQUIS',
          reflex_6: 'ACQUIS',
          reflex_7: 'ACQUIS',
        },
        qcmAttempts: 10,
        qcmCorrect: 9,
      }),
      new Date('2026-06-03'),
      new Date('2026-06-08'),
    );

    expect(ritual.kind).toBe('EXAM');
    expect(ritual.durationMinutes).toBe(60);
  });
});
