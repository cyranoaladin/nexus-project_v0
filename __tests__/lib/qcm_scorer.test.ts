import { computeQcmScores } from '@/lib/scoring/qcm_scorer';

describe('computeQcmScores', () => {
  it('calcule les pourcentages par domaine', () => {
    const items: any[] = [
      { id: 'Q1', domain: 'algebre', type: 'mcq', difficulty: 'A', weight: 2, prompt_latex: 'x', choices: [{ k: 'A', latex: '1', correct: true }, { k: 'B', latex: '2' }] },
      { id: 'Q2', domain: 'algebre', type: 'short', difficulty: 'A', weight: 1, prompt_latex: 'y', answer_latex: 'ok' },
      { id: 'Q3', domain: 'fonctions', type: 'numeric', difficulty: 'A', weight: 1, prompt_latex: 'z', answer_latex: '3' },
    ];
    const answers = { Q1: 'A', Q2: 'ok', Q3: '0' };
    const s = computeQcmScores(items as any, answers);
    expect(s.total).toBe(3);
    expect(s.totalMax).toBe(4);
    expect(s.byDomain.algebre.percent).toBe(100);
    expect(s.byDomain.fonctions.percent).toBe(0);
  });
});
