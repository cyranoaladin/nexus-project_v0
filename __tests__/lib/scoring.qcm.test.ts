import { scoreQcm } from '@/lib/scoring/qcm';

describe('scoreQcm', () => {
  it('calcule les points et pourcentages par domaine', () => {
    const qcm = {
      questions: [
        { id: 'Q1', domain: 'algebre', weight: 2, answer: 3 },
        { id: 'Q2', domain: 'algebre', weight: 1, correct: [1, 2], },
        { id: 'Q3', domain: 'fonctions', weight: 1, answer: 5 },
      ],
    } as any;
    const answers = { Q1: 3, Q2: [1, 2], Q3: 7 };
    const s = scoreQcm(qcm, answers);
    expect(s.total).toBe(3);
    expect(s.totalMax).toBe(4);
    expect(s.byDomain.algebre.points).toBe(3);
    expect(s.byDomain.algebre.max).toBe(3);
    expect(s.byDomain.algebre.percent).toBe(100);
    expect(s.byDomain.fonctions.percent).toBe(0);
  });
});
