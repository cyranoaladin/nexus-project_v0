import questionModule from '@/lib/assessments/questions/maths/premiere/stmg';

describe('Maths Premiere STMG question bank', () => {
  it('exposes 30 questions across the six STMG maths domains', () => {
    expect(questionModule.id).toBe('stmg');
    expect(questionModule.questions).toHaveLength(30);
    expect(new Set(questionModule.questions.map((q) => q.category))).toEqual(new Set([
      'Suites et finance',
      'Fonctions utiles en gestion',
      'Pourcentages, évolutions et indices',
      'Statistiques à deux variables',
      'Probabilités et loi binomiale',
      'Algorithmique appliquée et tableur',
    ]));
  });

  it('has one correct option per question', () => {
    for (const question of questionModule.questions) {
      expect(question.options.filter((option) => option.isCorrect)).toHaveLength(1);
    }
  });
});
