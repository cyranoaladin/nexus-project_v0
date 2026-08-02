import { permuteOptionsForDisplay } from '@/lib/bilans/passation/option-permutation';

const OPTIONS = Object.freeze([
  Object.freeze({ id: 'A', text: 'Distracteur A', isCorrect: false }),
  Object.freeze({ id: 'B', text: 'Réponse juste', isCorrect: true }),
  Object.freeze({ id: 'C', text: 'Distracteur C', isCorrect: false }),
  Object.freeze({ id: 'D', text: 'Distracteur D', isCorrect: false }),
]);

describe('permutation déterministe des options de passation', () => {
  it('rejoue exactement le même ordre avec le même seed', () => {
    const first = permuteOptionsForDisplay(OPTIONS, 'attempt-seed-001', 'MATH-2DE-01');
    const replay = permuteOptionsForDisplay(OPTIONS, 'attempt-seed-001', 'MATH-2DE-01');

    expect(first.map(({ id }) => id)).toEqual(replay.map(({ id }) => id));
  });

  it('produit des ordres différents pour deux seeds distincts', () => {
    const first = permuteOptionsForDisplay(OPTIONS, 'attempt-seed-001', 'MATH-2DE-01');
    const second = permuteOptionsForDisplay(OPTIONS, 'attempt-seed-002', 'MATH-2DE-01');

    expect(first.map(({ id }) => id)).not.toEqual(second.map(({ id }) => id));
  });

  it('préserve la bonne réponse sur le fond et ne modifie jamais le pack', () => {
    const initialOrder = OPTIONS.map(({ id }) => id);
    const correctOption = OPTIONS.find(({ isCorrect }) => isCorrect);
    const displayed = permuteOptionsForDisplay(OPTIONS, 20260817, 'MATH-2DE-01');

    expect(OPTIONS.map(({ id }) => id)).toEqual(initialOrder);
    expect(displayed).not.toBe(OPTIONS);
    expect(displayed).toHaveLength(OPTIONS.length);
    expect(displayed.find(({ isCorrect }) => isCorrect)).toBe(correctOption);
    expect(displayed.map(({ id }) => id).sort()).toEqual([...initialOrder].sort());
  });
});
