import { computeNotePotentielle } from '@/lib/survival/score-simulator';
import type { SurvivalProgressSnapshot } from '@/lib/survival/types';

function makeProgress(
  reflexesState: SurvivalProgressSnapshot['reflexesState'],
  phrasesState: SurvivalProgressSnapshot['phrasesState'] = {},
): SurvivalProgressSnapshot {
  return {
    reflexesState,
    phrasesState,
    qcmAttempts: 0,
    qcmCorrect: 0,
    rituals: [],
  };
}

describe('computeNotePotentielle', () => {
  it('keeps a no-reflex profile at the golden-rule baseline', () => {
    const score = computeNotePotentielle(makeProgress({}));

    expect(score).toBe(0.75);
  });

  it('reaches the survival target band when all reflexes and phrases are secured', () => {
    const score = computeNotePotentielle(
      makeProgress(
        {
          reflex_1: 'ACQUIS',
          reflex_2: 'ACQUIS',
          reflex_3: 'ACQUIS',
          reflex_4: 'ACQUIS',
          reflex_5: 'ACQUIS',
          reflex_6: 'ACQUIS',
          reflex_7: 'ACQUIS',
        },
        {
          phrase_1: 3,
          phrase_2: 3,
          phrase_3: 3,
          phrase_4: 3,
          phrase_5: 3,
          phrase_6: 3,
          phrase_7: 3,
          phrase_8: 3,
        },
      ),
    );

    expect(score).toBeGreaterThanOrEqual(8);
    expect(score).toBeLessThanOrEqual(9);
  });

  it('rounds the score to the nearest half point', () => {
    const score = computeNotePotentielle(
      makeProgress({
        reflex_1: 'REVOIR',
        reflex_2: 'ACQUIS',
        reflex_4: 'ACQUIS',
      }),
    );

    expect(score * 2).toBe(Math.round(score * 2));
  });
});
