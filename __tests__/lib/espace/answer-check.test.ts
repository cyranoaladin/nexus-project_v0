import { evaluateAnswer, parseAffine, type AnswerCheck } from '@/lib/espace/answer-check';

describe('parseAffine', () => {
  it.each([
    ['-3x-1', -3, -1],
    ['−3x−1', -3, -1],
    ['-1-3x', -3, -1],
    ['y', null, null],
    ['3*x+2', 3, 2],
    ['(3/2)x', 1.5, 0],
    ['3x/2', 1.5, 0],
    ['2(x+1)', 2, 2],
    ['0,5x+1,25', 0.5, 1.25],
    ['x', 1, 0],
    ['4', 0, 4],
    ['-(x-2)', -1, 2],
  ])('%s', (input, a, b) => {
    const v = parseAffine(input);
    if (a === null) expect(v).toBeNull();
    else expect(v).toEqual({ a: expect.closeTo(a, 9), b: expect.closeTo(b as number, 9) });
  });

  it.each(['x*x', 'x/x', '3x/', '(2x', '2x)', '', 'abc', '1/0', 'x²'])('rejette %p', (s) => expect(parseAffine(s)).toBeNull());
});

const tangent: AnswerCheck = {
  kind: 'linear',
  accept: ['y=-3x-1'],
  rules: [
    { when: ['y=-3x+1', '-3x+1'], feedback: 'Vérifie f(0) : l’ordonnée à l’origine est f(0), pas son opposé.' },
    { when: ['y=3x-1'], feedback: 'Le coefficient directeur est f’(0) = −3, avec son signe.' },
  ],
  success: 'Oui : y = −3x − 1.',
};

describe('linear', () => {
  it.each(['y=-3x-1', 'y = −3x − 1', 'y=-1-3x', '-3x-1', 'y=-3*x-1', 'Y=-3X-1'])('accepte %p', (s) => {
    expect(evaluateAnswer(tangent, s)).toMatchObject({ ok: true, feedback: 'Oui : y = −3x − 1.' });
  });
  it('message ciblé sur une erreur de signe reconnue', () => {
    expect(evaluateAnswer(tangent, 'y=-3x+1')).toMatchObject({ ok: false, targeted: true });
    expect(evaluateAnswer(tangent, '3x-1').feedback).toContain('coefficient directeur');
  });
  it('autre réponse fausse : message générique, jamais « Faux. »', () => {
    const v = evaluateAnswer(tangent, 'y=2x');
    expect(v.ok).toBe(false);
    expect(v.targeted).toBe(false);
    expect(v.feedback).not.toMatch(/^Faux\.?$/);
  });
  it('vide et illisible', () => {
    expect(evaluateAnswer(tangent, '  ').empty).toBe(true);
    expect(evaluateAnswer(tangent, 'blabla').feedback).toContain('ne reconnais pas');
  });
});

const lim: AnswerCheck = {
  kind: 'limit',
  accept: ['+inf'],
  rules: [{ when: ['-inf', '−∞'], feedback: 'Regarde le signe du dénominateur quand x tend vers 1 par valeurs supérieures.' }, { when: ['inf/inf', '∞/∞'], feedback: '∞/∞ est une forme indéterminée, pas une valeur.' }],
};

describe('limit', () => {
  it.each(['+∞', '∞', '+inf', 'inf', 'plus l’infini', 'plus l\'infini', '+ ∞', '(+∞)'])('accepte %p', (s) => expect(evaluateAnswer(lim, s).ok).toBe(true));
  it('distingue +∞ de −∞ et une valeur finie', () => {
    expect(evaluateAnswer(lim, '-∞')).toMatchObject({ ok: false, targeted: true });
    expect(evaluateAnswer(lim, '−∞').targeted).toBe(true);
    expect(evaluateAnswer(lim, '2')).toMatchObject({ ok: false, targeted: false });
  });
  it('reconnaît une forme indéterminée donnée comme résultat', () => {
    expect(evaluateAnswer(lim, '∞/∞').feedback).toContain('forme indéterminée');
  });
  it('limite finie sous plusieurs écritures', () => {
    const two: AnswerCheck = { kind: 'limit', accept: ['2'] };
    for (const s of ['2', '2,0', '4/2', '2.00', '(2)']) expect(evaluateAnswer(two, s).ok).toBe(true);
    expect(evaluateAnswer(two, '+∞').ok).toBe(false);
  });
});

describe('equation', () => {
  const av: AnswerCheck = { kind: 'equation', accept: ['x=1'], rules: [{ when: ['y=1'], feedback: 'Une asymptote verticale est une droite x = a.' }] };
  it.each(['x=1', 'x = 1', '1=x', 'X=1.0', 'x=2/2'])('accepte %p', (s) => expect(evaluateAnswer(av, s).ok).toBe(true));
  it('ne confond pas x=1 et y=1', () => {
    expect(evaluateAnswer(av, 'y=1')).toMatchObject({ ok: false, targeted: true });
    expect(evaluateAnswer(av, 'x=2').ok).toBe(false);
    expect(evaluateAnswer(av, '1').feedback).toContain('ne reconnais pas');
  });
});

describe('number', () => {
  const n: AnswerCheck = { kind: 'number', accept: ['-3'], rules: [{ when: ['3'], feedback: 'Regarde le signe.' }] };
  it('accepte les écritures équivalentes', () => {
    for (const s of ['-3', '−3', '-3,0', '-6/2', '-(3)']) expect(evaluateAnswer(n, s).ok).toBe(true);
  });
  it('règle ciblée', () => expect(evaluateAnswer(n, '3').feedback).toBe('Regarde le signe.'));
});
