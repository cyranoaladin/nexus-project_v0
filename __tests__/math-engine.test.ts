import {
  areEquivalentAnswers,
  generateExerciseRandomFloat,
  generateExerciseRandomInt,
} from '@/app/programme/maths-1ere/lib/math-engine';

describe('Math engine', () => {
  it('accepte 2x comme équivalent à 2*x', () => {
    expect(areEquivalentAnswers('2x', '2*x')).toBe(true);
    expect(areEquivalentAnswers('3(x+1)', '3*(x+1)')).toBe(true);
  });

  it('les générateurs aléatoires d’exercices ne retournent jamais NaN', () => {
    for (let i = 0; i < 200; i += 1) {
      const n = generateExerciseRandomInt(-10, 10);
      const f = generateExerciseRandomFloat(-5, 5, 3);
      expect(Number.isNaN(n)).toBe(false);
      expect(Number.isNaN(f)).toBe(false);
      expect(Number.isFinite(n)).toBe(true);
      expect(Number.isFinite(f)).toBe(true);
    }
  });
});
