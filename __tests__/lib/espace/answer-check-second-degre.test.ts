import { evaluateAnswer, type AnswerCheck } from '@/lib/espace/answer-check';
import { parsePolynomial } from '@/lib/espace/poly-parse';

describe('parsePolynomial', () => {
  it.each([
    ['2x²-4x+1', [1, -4, 2]],
    ['2x^2 - 4x + 1', [1, -4, 2]],
    ['−x²+3', [3, 0, -1]],
    ['(x-2)(x+3)', [-6, 1, 1]],
    ['2(x-1)^2-3', [-1, -4, 2]],
    ['(x-1)²', [1, -2, 1]],
    ['x(x-5)', [0, -5, 1]],
    ['0,5x²+1,5', [1.5, 0, 0.5]],
    ['x²/2', [0, 0, 0.5]],
    ['3/2', [1.5]],
    ['-x', [0, -1]],
    ['2*x*x', [0, 0, 2]],
    ['x+x', [0, 2]],
  ])('%s', (input, coeffs) => {
    const p = parsePolynomial(input);
    expect(p).not.toBeNull();
    expect(p!.length).toBe(coeffs.length);
    coeffs.forEach((c, i) => expect(p![i]).toBeCloseTo(c, 9));
  });

  it('racines carrées de constantes', () => {
    expect(parsePolynomial('√9')![0]).toBeCloseTo(3, 9);
    expect(parsePolynomial('2√5')![0]).toBeCloseTo(2 * Math.sqrt(5), 9);
    expect(parsePolynomial('sqrt(5)')![0]).toBeCloseTo(Math.sqrt(5), 9);
    expect(parsePolynomial('(1+√5)/2')![0]).toBeCloseTo((1 + Math.sqrt(5)) / 2, 9);
    expect(parsePolynomial('x√2')).toEqual([expect.closeTo(0, 9), expect.closeTo(Math.sqrt(2), 9)]);
  });

  it.each(['', 'abc', '2x+', '(x', 'x)', '1/0', '1/x', '√(-1)', '√x', 'x2', '2x²²', 'x^x', 'x^9', 'y'])('rejette %p', (s) => {
    expect(parsePolynomial(s)).toBeNull();
  });
});

const trinome: AnswerCheck = {
  kind: 'polynomial',
  accept: ['x²-x-6'],
  rules: [{ when: ['x²+x-6'], feedback: 'Signe du terme en x.' }],
};

describe('kind polynomial', () => {
  it.each(['x²-x-6', '(x-3)(x+2)', 'x^2-x-6', '-6-x+x²', 'x(x-1)-6', '(x-0,5)²-6,25'])('accepte %s', (s) => {
    expect(evaluateAnswer(trinome, s).ok).toBe(true);
  });
  it('règle ciblée', () => {
    const v = evaluateAnswer(trinome, 'x²+x-6');
    expect(v).toMatchObject({ ok: false, targeted: true, feedback: 'Signe du terme en x.' });
  });
  it('mauvaise réponse lisible vs illisible', () => {
    expect(evaluateAnswer(trinome, 'x²-x-5')).toMatchObject({ ok: false, targeted: false, empty: false });
    expect(evaluateAnswer(trinome, 'x²-x-5').feedback).not.toMatch(/ne reconnais pas/);
    expect(evaluateAnswer(trinome, 'x²-x-').feedback).toMatch(/ne reconnais pas/);
  });
  it('vide', () => expect(evaluateAnswer(trinome, '  ')).toMatchObject({ ok: false, empty: true }));
});

const racines: AnswerCheck = { kind: 'set', accept: ['-2;3'], rules: [{ when: ['2;-3'], feedback: 'Signes inversés.' }] };

describe('kind set', () => {
  it.each(['-2;3', '3;-2', '−2 ; 3', '-2 et 3', 'x1=-2 ; x2=3', 'S={-2;3}', 'S = {−2 ; 3}', '{3 ; -2}', '-2 ou 3', '-2;3;3', '6/2;-4/2'])('accepte %s', (s) => {
    expect(evaluateAnswer(racines, s).ok).toBe(true);
  });
  it.each(['-2', '3', '-2;3;4', '2;3', '-2;-3'])('refuse %s', (s) => expect(evaluateAnswer(racines, s).ok).toBe(false));
  it('règle ciblée', () => expect(evaluateAnswer(racines, '2 ; -3')).toMatchObject({ targeted: true, feedback: 'Signes inversés.' }));
  it('racine double', () => expect(evaluateAnswer({ kind: 'set', accept: ['2'] }, 'S={2}').ok).toBe(true));
  it('irrationnelles', () => {
    const irr: AnswerCheck = { kind: 'set', accept: ['(1-√5)/2;(1+√5)/2'] };
    expect(evaluateAnswer(irr, '(1+√5)/2 ; (1−√5)/2').ok).toBe(true);
    expect(evaluateAnswer(irr, '1,618 ; -0,618').ok).toBe(false); // valeur approchée ≠ valeur exacte
  });
  it.each(['∅', 'S=∅', '{}', 'aucune', 'pas de solution', 'S = ∅', 'vide'])('ensemble vide : %s', (s) => {
    expect(evaluateAnswer({ kind: 'set', accept: ['∅'] }, s).ok).toBe(true);
  });
  it('ensemble vide ≠ une solution', () => expect(evaluateAnswer({ kind: 'set', accept: ['∅'] }, '0').ok).toBe(false));
  it('illisible', () => expect(evaluateAnswer(racines, 'les deux racines').feedback).toMatch(/ne reconnais pas/));
});

const sol: AnswerCheck = { kind: 'interval', accept: [']-∞;-2[∪]3;+∞['] };

describe('kind interval', () => {
  it.each([
    ']-∞;-2[∪]3;+∞[',
    ']−∞ ; −2[ ∪ ]3 ; +∞[',
    ']-inf;-2[U]3;+inf[',
    ']-∞;-2[ ∪ ]3;∞[',
    ']3;+∞[∪]-∞;-2[',
    'S=]-∞;-2[∪]3;+∞[',
    ']−∞ ; −2[ ou ]3 ; +∞[',
  ])('accepte %s', (s) => expect(evaluateAnswer(sol, s).ok).toBe(true));
  it.each([']-∞;-2]∪[3;+∞[', ']-2;3[', ']-∞;-2[', ']-∞;-2[∪]3;4['])('refuse %s', (s) => expect(evaluateAnswer(sol, s).ok).toBe(false));
  it('crochets : fermé ≠ ouvert, avec règle ciblée', () => {
    const c: AnswerCheck = { kind: 'interval', accept: ['[-2;3]'], rules: [{ when: [']-2;3['], feedback: 'Bornes incluses.' }] };
    expect(evaluateAnswer(c, '[−2 ; 3]').ok).toBe(true);
    expect(evaluateAnswer(c, ']-2;3[')).toMatchObject({ ok: false, targeted: true });
  });
  it('intervalle simple et bornes fractionnaires', () => {
    expect(evaluateAnswer({ kind: 'interval', accept: ['[1/2;+∞['] }, '[0,5 ; +∞[').ok).toBe(true);
  });
  it('infini sur un crochet fermé est illisible', () => expect(evaluateAnswer(sol, '[-∞;-2[').feedback).toMatch(/ne reconnais pas/));
  it.each(['∅', 'S=∅', 'aucune'])('vide %s', (s) => expect(evaluateAnswer({ kind: 'interval', accept: ['∅'] }, s).ok).toBe(true));
  it('ℝ', () => {
    for (const s of ['ℝ', 'R', ']-∞;+∞[', 'S=ℝ']) expect(evaluateAnswer({ kind: 'interval', accept: ['ℝ'] }, s).ok).toBe(true);
  });
  it('illisible', () => expect(evaluateAnswer(sol, 'x<-2 ou x>3').feedback).toMatch(/ne reconnais pas/));
});

describe('solution détaillée', () => {
  it('remontée dans le verdict (réponse fausse seulement utile, mais toujours présente)', () => {
    const c: AnswerCheck = { kind: 'number', accept: ['4'], solution: 'Δ = 16 − 0 = 16 donc …' };
    expect(evaluateAnswer(c, '5')).toMatchObject({ ok: false, solution: 'Δ = 16 − 0 = 16 donc …' });
    expect(evaluateAnswer(c, '4')).toMatchObject({ ok: true });
    expect(evaluateAnswer({ kind: 'number', accept: ['4'] }, '5').solution).toBeUndefined();
  });
});
