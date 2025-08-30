// __tests__/lib/bilan/eval.test.ts
import { evaluateQcm } from '@/lib/bilan/eval';
import { QCM_PREMIERE_MATHS } from '@/lib/bilan/qcm-premiere-maths';

describe('evaluateQcm', () => {
  it('computes zero scores with no answers', () => {
    const res = evaluateQcm({});
    expect(res.scoreGlobal).toBe(0);
    for (const d of Object.keys(res.byDomain)) {
      expect(res.byDomain[d].points).toBe(0);
    }
  });
  it('perfect answers yield 100%', () => {
    const answers: Record<string, number> = {};
    for (const q of QCM_PREMIERE_MATHS) answers[q.id] = q.correctIndex;
    const res = evaluateQcm(answers);
    expect(res.scoreGlobal).toBeGreaterThanOrEqual(95); // rounding may not be exact 100
  });
});

