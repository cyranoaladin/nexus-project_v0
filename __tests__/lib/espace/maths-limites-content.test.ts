/**
 * Contenu « Fonctions, limites et lecture graphique » : invariants de structure
 * + vérification MATHÉMATIQUE des réponses attendues (calcul numérique indépendant du texte).
 */
import content from '@/content/espace/maths-fonctions-limites/content.json';
import { evaluateAnswer } from '@/lib/espace/answer-check';
import { derivativeAt, evalFunction } from '@/lib/espace/figures/function-svg';
import type { FunctionSpec, LessonContent, LessonStep } from '@/lib/espace/lesson-types';

const lesson = content as unknown as LessonContent;
const step = (id: string): LessonStep => {
  const s = lesson.steps.find((x) => x.id === id);
  if (!s) throw new Error(`étape ${id}`);
  return s;
};
const field = (stepId: string, id: string) => {
  const f = step(stepId).fields.find((x) => x.id === id);
  if (!f?.check) throw new Error(`champ ${stepId}/${id}`);
  return f;
};
const fig = (stepId: string, id: string) => {
  const f = step(stepId).figures?.find((x) => x.id === id);
  if (!f || f.type !== 'function') throw new Error(`figure ${id}`);
  return f;
};

const rat = (num: number[], den: number[]): FunctionSpec => ({ kind: 'rational', num, den });
const g = rat([1, 2], [-1, 1]);
const f2 = rat([1, -3, 2], [4, 0, 1]);
const k = rat([0, -3, 2], [-1, 0, 1]);
const m = rat([1, 1, 1], [0, 1]);
const d = rat([-2, 3], [1, 1]);

describe('structure', () => {
  it('11 étapes dont la fiche imprimable et le bonus', () => {
    expect(lesson.steps.map((s) => s.id)).toEqual([
      'diagnostic', 'limite', 'operations', 'asymptote-verticale', 'asymptote-horizontale',
      'tangente', 'variations', 'etude', 'autonome', 'methodes', 'bonus',
    ]);
    expect(step('methodes').printable).toBe(true);
    expect(lesson.duration).toBe(lesson.steps.filter((s) => s.id !== 'bonus').reduce((a, s) => a + s.minutes, 0));
    expect(lesson.duration).toBeGreaterThanOrEqual(100);
    expect(lesson.duration).toBeLessThanOrEqual(125);
  });

  it('ids uniques, jetons {{…}} résolus, questions cohérentes', () => {
    const stepIds = new Set<string>();
    for (const s of lesson.steps) {
      expect(stepIds.has(s.id)).toBe(false);
      stepIds.add(s.id);
      const qIds = s.questions.map((x) => x.id);
      const fIds = s.fields.map((x) => x.id);
      const gIds = (s.figures ?? []).map((x) => x.id);
      expect(new Set([...qIds, ...fIds]).size).toBe(qIds.length + fIds.length);
      const tokens = [...s.lesson.matchAll(/\{\{(q|f|fig):([^}]+)\}\}/g)];
      const used = new Set<string>();
      for (const [, kind, id] of tokens) {
        const pool = kind === 'q' ? qIds : kind === 'f' ? fIds : gIds;
        expect({ s: s.id, kind, id, found: pool.includes(id) }).toEqual({ s: s.id, kind, id, found: true });
        used.add(`${kind}:${id}`);
      }
      // tout élément défini est placé (aucun orphelin silencieux)
      for (const id of qIds) expect(used.has(`q:${id}`)).toBe(true);
      for (const id of fIds) expect(used.has(`f:${id}`)).toBe(true);
      for (const id of gIds) expect(used.has(`fig:${id}`)).toBe(true);
      for (const qu of s.questions) {
        expect(qu.correct).toBeGreaterThanOrEqual(0);
        expect(qu.correct).toBeLessThan(qu.choices.length);
        expect(qu.choiceFeedback).toHaveLength(qu.choices.length);
        expect(qu.choiceFeedback![qu.correct]).toBe('');
        expect(qu.choiceFeedback!.every((t, i) => i === qu.correct || t.length > 15)).toBe(true);
        expect(new Set(qu.choices).size).toBe(qu.choices.length);
      }
      // pas de mot de vérité brute : jamais un « Faux. » nu
      for (const f of s.fields) if (f.check) expect((f.check.fallback ?? '').length).toBeGreaterThan(20);
    }
  });

  it('formules délimitées et équilibrées, pas de < ou > brut dans le texte HTML', () => {
    const texts: string[] = [];
    const walk = (o: unknown): void => {
      if (typeof o === 'string') texts.push(o);
      else if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') Object.values(o).forEach(walk);
    };
    walk(lesson);
    for (const t of texts) {
      expect((t.match(/\\\(/g) ?? []).length).toBe((t.match(/\\\)/g) ?? []).length);
      expect((t.match(/\\\[/g) ?? []).length).toBe((t.match(/\\\]/g) ?? []).length);
      const outside = t.replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, '');
      expect(outside).not.toMatch(/ [;!?:]/); // espace avant ponctuation haute : insécable attendue
    }
  });

  it('toutes les formules se compilent avec KaTeX (mode strict)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const katex = require('katex');
    const texts: string[] = [];
    const walk = (o: unknown): void => {
      if (typeof o === 'string') texts.push(o);
      else if (Array.isArray(o)) o.forEach(walk);
      else if (o && typeof o === 'object') Object.values(o).forEach(walk);
    };
    walk(lesson);
    let n = 0;
    for (const t of texts) {
      for (const [, a, b] of t.matchAll(/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g)) {
        katex.renderToString((a ?? b) as string, { throwOnError: true, strict: 'error' });
        n++;
      }
    }
    expect(n).toBeGreaterThan(200);
  });

  it('aucune balise HTML hors du champ `lesson` (le reste est affiché comme texte)', () => {
    for (const s of lesson.steps) {
      const { lesson: _l, ...rest } = s;
      expect(JSON.stringify(rest)).not.toMatch(/<\/?[a-z]/i);
    }
  });

  it('chaque figure a une fenêtre valide et un champ de superposition existant', () => {
    for (const s of lesson.steps)
      for (const f of s.figures ?? []) {
        if (f.type !== 'function') continue;
        expect(f.window.xmax).toBeGreaterThan(f.window.xmin);
        expect(f.window.ymax).toBeGreaterThan(f.window.ymin);
        if (f.overlayFieldId) expect(s.fields.some((x) => x.id === f.overlayFieldId)).toBe(true);
      }
  });
});

describe('mathématiques — les réponses attendues sont VRAIES', () => {
  const big = 1e7;
  it('limites de g', () => {
    expect(evalFunction(g, big)).toBeCloseTo(2, 5);
    expect(evalFunction(g, -big)).toBeCloseTo(2, 5);
    expect(evalFunction(g, 1 - 1e-7)).toBeLessThan(-1e6);
    expect(evalFunction(g, 1 + 1e-7)).toBeGreaterThan(1e6);
  });
  it('polynôme P et quotient f', () => {
    const P = (x: number) => 3 * x ** 4 - 5 * x ** 2 + 7 * x - 1;
    expect(P(1e3)).toBeGreaterThan(1e12);
    expect(P(-1e3)).toBeGreaterThan(1e12);
    expect(evalFunction(f2, big)).toBeCloseTo(2, 5);
    // f coupe y = 2 en −7/3 (et nulle part ailleurs)
    expect(evalFunction(f2, -7 / 3)).toBeCloseTo(2, 12);
    expect(evalFunction(f2, 0)).not.toBeCloseTo(2, 3);
  });
  it('contre-exemple h : limite 2 en 1', () => {
    const h = rat([-1, 0, 1], [-1, 1]);
    expect(evalFunction(h, 1 + 1e-6)).toBeCloseTo(2, 4);
    expect(evalFunction(h, 1 - 1e-6)).toBeCloseTo(2, 4);
  });
  it('dérivée et tangente de g en 0', () => {
    expect(evalFunction(g, 0)).toBeCloseTo(-1, 12);
    expect(derivativeAt(g, 0)).toBeCloseTo(-3, 12);
    const num = 2 * (0 - 1) - (2 * 0 + 1);
    expect(num).toBe(-3);
    for (const x of [-5, 0.5, 3, 10]) expect(derivativeAt(g, x)).toBeCloseTo(-3 / (x - 1) ** 2, 9);
  });
  it('g(0) < g(2) : pas de décroissance globale ; g(x)-2 = 3/(x-1) ; zéro en −1/2', () => {
    expect(evalFunction(g, 0)).toBeLessThan(evalFunction(g, 2));
    expect(evalFunction(g, 2)).toBeCloseTo(5, 12);
    for (const x of [-3, 0, 4]) expect(evalFunction(g, x) - 2).toBeCloseTo(3 / (x - 1), 12);
    expect(evalFunction(g, -0.5)).toBeCloseTo(0, 12);
  });
  it('fonction k : limites, dérivée (numérateur 3x²−4x+3), tangente y = 3x', () => {
    expect(evalFunction(k, big)).toBeCloseTo(2, 5);
    expect(evalFunction(k, 1 - 1e-7)).toBeGreaterThan(1e6); // numérateur −1, dénominateur 0⁻
    expect(evalFunction(k, 1 + 1e-7)).toBeLessThan(-1e6);
    expect(evalFunction(k, -1 + 1e-7)).toBeLessThan(-1e6); // numérateur 5, dénominateur 0⁻
    expect(evalFunction(k, -1 - 1e-7)).toBeGreaterThan(1e6);
    expect(evalFunction(k, 0)).toBeCloseTo(0, 12);
    expect(derivativeAt(k, 0)).toBeCloseTo(3, 12);
    for (const x of [-4, -0.3, 0.7, 2.5]) {
      expect(derivativeAt(k, x)).toBeCloseTo((3 * x * x - 4 * x + 3) / (x * x - 1) ** 2, 9);
      expect(3 * x * x - 4 * x + 3).toBeGreaterThan(0);
    }
    expect((-4) ** 2 - 4 * 3 * 3).toBe(-20);
  });
  it('asymptote oblique de m : m(x) − (x+1) = 1/x → 0', () => {
    for (const x of [1e3, -1e3]) expect(evalFunction(m, x) - (x + 1)).toBeCloseTo(1 / x, 9);
  });
  it('diagnostic : d(1)=0,5, d(0)=−2, limite 3', () => {
    expect(evalFunction(d, 1)).toBeCloseTo(0.5, 12);
    expect(evalFunction(d, 0)).toBeCloseTo(-2, 12);
    expect(evalFunction(d, big)).toBeCloseTo(3, 5);
    expect(derivativeAt(d, 2)).toBeGreaterThan(0);
  });
});

describe('vérificateurs de réponses', () => {
  const expected: [string, string, string[]][] = [
    ['diagnostic', 'lim-droite', ['3', ' 3 ']],
    ['operations', 'limp', ['+∞', '+inf', 'plus l’infini', '+infini']],
    ['operations', 'limf', ['2', '2/1', '4/2']],
    ['operations', 'asym-f', ['y=2', 'y = 2']],
    ['asymptote-verticale', 'lim-moins', ['-∞', '−∞', 'moins l’infini']],
    ['asymptote-verticale', 'lim-plus', ['+∞', 'infini']],
    ['asymptote-verticale', 'av-eq', ['x=1', 'x = 1', 'x=1.0']],
    ['asymptote-verticale', 'limh', ['2']],
    ['asymptote-horizontale', 'lim-plus-inf', ['2']],
    ['asymptote-horizontale', 'lim-moins-inf', ['2']],
    ['asymptote-horizontale', 'ah-eq', ['y=2']],
    ['tangente', 'num', ['-3', '−3']],
    ['tangente', 'g0', ['-1']],
    ['tangente', 'gp0', ['-3']],
    ['tangente', 'tangente', ['y=-3x-1', 'y = −3x − 1', 'y=-1-3x', 'y=-3*x-1', 'y=-3(x-0)-1', 'y=-1+(-3)(x-0)']],
    ['variations', 'var-debut', ['+∞']],
    ['variations', 'var-fin', ['2']],
    ['etude', 'zero', ['-1/2', '-0,5', '−0.5', '-2/4']],
    ['autonome', 'k-1m', ['+∞']],
    ['autonome', 'k-inf', ['2']],
    ['autonome', 'k-tan', ['y=3x', 'y = 3x', 'y=3*x', 'y=0+3x']],
    ['bonus', 'bonus-ab', ['y=x+1', 'y=1+x', 'y = x + 1']],
  ];
  it.each(expected)('%s/%s accepte les écritures usuelles', (s, id, answers) => {
    const f = field(s, id);
    for (const a of answers) expect({ a, ok: evaluateAnswer(f.check!, a).ok }).toEqual({ a, ok: true });
  });

  it('chaque règle ciblée est déclenchée par ses réponses, qui ne sont PAS acceptées, avec un message utile', () => {
    for (const s of lesson.steps)
      for (const f of s.fields) {
        if (!f.check) continue;
        for (const r of f.check.rules ?? []) {
          expect(r.feedback.length).toBeGreaterThan(25);
          for (const w of r.when) {
            const v = evaluateAnswer(f.check, w);
            expect({ s: s.id, f: f.id, w, ok: v.ok }).toEqual({ s: s.id, f: f.id, w, ok: false });
            expect({ s: s.id, f: f.id, w, targeted: v.targeted }).toEqual({ s: s.id, f: f.id, w, targeted: true });
          }
        }
      }
  });

  it('une erreur non prévue ou une réponse vide donne un message aidant, jamais « Faux »', () => {
    for (const s of lesson.steps)
      for (const f of s.fields) {
        if (!f.check) continue;
        for (const bad of ['zzz', '', '12345']) {
          const v = evaluateAnswer(f.check, bad);
          if (v.ok) continue;
          expect(v.feedback).toBeTruthy();
          expect(v.feedback.trim().toLowerCase()).not.toBe('faux');
          expect(v.feedback.length).toBeGreaterThan(15);
        }
      }
  });

  it('les réponses attendues sont cohérentes avec les mathématiques (tangente reconnue = droite exacte)', () => {
    const t = field('tangente', 'tangente').check!;
    expect(evaluateAnswer(t, 'y=-3x+1').ok).toBe(false);
    expect(evaluateAnswer(t, 'y=3x-1').ok).toBe(false);
    expect(evaluateAnswer(t, 'y=-3x').ok).toBe(false);
  });
});

describe('figures du parcours', () => {
  it('la figure de tangente utilise bien g et son point d\'abscisse 0', () => {
    const f = fig('tangente', 'g-tan');
    expect(f.tangentAt).toBe(0);
    expect(f.overlayFieldId).toBe('tangente');
    expect(f.verticalAsymptotes).toEqual([1]);
    expect(f.horizontalAsymptotes).toEqual([2]);
  });
  it('le croisement B de f avec y=2 est à −7/3', () => {
    const f = fig('asymptote-horizontale', 'f-croise');
    expect(f.points![0].x).toBeCloseTo(-7 / 3, 12);
    expect(evalFunction(f.fn, f.points![0].x)).toBeCloseTo(2, 12);
  });
  it('les fenêtres contiennent les éléments annoncés', () => {
    const kf = fig('autonome', 'k-fig');
    for (const a of kf.verticalAsymptotes!) expect(a).toBeGreaterThan(kf.window.xmin);
  });
});

describe('corrigé enseignant (source)', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const html: string = require('fs').readFileSync(
    require('path').join(process.cwd(), 'docs/espace/corriges/maths-limites/corrige.html'),
    'utf8',
  );
  it('chaque marqueur FIG désigne une figure du contenu, et toutes les figures sont couvertes', () => {
    const ids = new Set(lesson.steps.flatMap((s) => (s.figures ?? []).map((f) => f.id)));
    const marks = [...html.matchAll(/<!--FIG:([\w-]+?)-->/g)].map((m) => m[1]);
    for (const id of marks) expect(ids.has(id)).toBe(true);
    for (const id of ids) expect(marks).toContain(id);
  });
  it('commentaires HTML bien fermés (aucun commentaire imbriqué)', () => {
    expect((html.match(/<!--/g) ?? []).length).toBe((html.match(/-->/g) ?? []).length);
  });
  it('formules compilables', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const katex = require('katex');
    for (const [, a, b] of html.matchAll(/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g))
      katex.renderToString((a ?? b) as string, { throwOnError: true, strict: 'error' });
  });
});
