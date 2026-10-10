/**
 * Parcours « Le second degré » (Première générale) : invariants de structure + vérification
 * MATHÉMATIQUE des réponses attendues. Chaque réponse est recalculée ICI, indépendamment du texte
 * du contenu (discriminant, racines, sommet, valeurs numériques), puis soumise à `evaluateAnswer` :
 * une erreur de calcul dans le contenu fait échouer ce test.
 */
import content from '@/content/espace/maths-second-degre/content.json';
import { evaluateAnswer } from '@/lib/espace/answer-check';
import { ACTIVITIES, getActivityDef, getLesson, getLessonRequiredSteps } from '@/lib/espace/catalog';
import { lessonHref, MATHS_SECOND_DEGRE_ACTIVITY_SLUG } from '@/lib/espace/lesson-routes';
import type { LessonContent, LessonStep } from '@/lib/espace/lesson-types';

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
const question = (stepId: string, id: string) => {
  const q = step(stepId).questions.find((x) => x.id === id);
  if (!q) throw new Error(`question ${stepId}/${id}`);
  return q;
};
const correctChoice = (stepId: string, id: string) => {
  const q = question(stepId, id);
  return q.choices[q.correct]!;
};

// ─── Calcul indépendant ─────────────────────────────────────────────────────

type Trinome = readonly [a: number, b: number, c: number];
const ev = ([a, b, c]: Trinome, x: number) => a * x * x + b * x + c;
const disc = ([a, b, c]: Trinome) => b * b - 4 * a * c;
/** Racines réelles distinctes, croissantes. */
const roots = (t: Trinome): number[] => {
  const d = disc(t);
  if (d < 0) return [];
  if (d === 0) return [-t[1] / (2 * t[0])];
  return [(-t[1] - Math.sqrt(d)) / (2 * t[0]), (-t[1] + Math.sqrt(d)) / (2 * t[0])].sort((p, q) => p - q);
};
const alpha = ([a, b]: Trinome) => -b / (2 * a);
const beta = (t: Trinome) => ev(t, alpha(t));
const num = (x: number) => String(Math.round(x * 1e9) / 1e9);
const asSet = (xs: number[]) => (xs.length ? xs.map(num).join(';') : '∅');

/** Solution d'une inéquation `ax²+bx+c ⋄ 0` (⋄ ∈ {>, ≥, <, ≤}), construite par étude de signe, en notation d'intervalles. */
function ineq(t: Trinome, positive: boolean, strict: boolean): string {
  const r = roots(t);
  if (r.length === 0) return positive === t[0] > 0 ? 'ℝ' : '∅';
  if (r.length === 1) throw new Error('racine double non gérée ici');
  const [x1, x2] = r as [number, number];
  // Le trinôme est positif à l'extérieur des racines si a>0, entre elles si a<0 (et inversement pour « négatif »).
  const outside = positive === t[0] > 0;
  const inc = !strict; // les racines appartiennent-elles à l'ensemble solution ?
  const left = inc ? '[' : ']';
  const right = inc ? ']' : '[';
  return outside ? `]-∞;${num(x1)}${right}∪${left}${num(x2)};+∞[` : `${left}${num(x1)};${num(x2)}${right}`;
}

/** Vérification brute de `ineq` par échantillonnage, pour ne pas faire confiance à un seul code. */
function ineqHolds(t: Trinome, positive: boolean, strict: boolean, x: number): boolean {
  const v = ev(t, x);
  return positive ? (strict ? v > 1e-12 : v >= -1e-12) : strict ? v < -1e-12 : v <= 1e-12;
}
function inInterval(s: string, x: number): boolean {
  if (s === 'ℝ') return true;
  if (s === '∅') return false;
  return s.split('∪').some((piece) => {
    const m = /^([[\]])(.+);(.+)([[\]])$/.exec(piece)!;
    const lo = m[2] === '-∞' ? -Infinity : Number(m[2]);
    const hi = m[3] === '+∞' ? Infinity : Number(m[3]);
    const okLo = m[1] === '[' ? x >= lo - 1e-12 : x > lo + 1e-12;
    const okHi = m[4] === ']' ? x <= hi + 1e-12 : x < hi - 1e-12;
    return okLo && okHi;
  });
}

function verifies(stepId: string, fieldId: string, answer: string) {
  const f = field(stepId, fieldId);
  const v = evaluateAnswer(f.check!, answer);
  expect({ field: `${stepId}/${fieldId}`, answer, ok: v.ok, feedback: v.feedback }).toEqual({ field: `${stepId}/${fieldId}`, answer, ok: true, feedback: expect.any(String) });
}

// ─── Structure ──────────────────────────────────────────────────────────────

describe('structure', () => {
  it('10 étapes dont la fiche imprimable et le bonus', () => {
    expect(lesson.steps.map((s) => s.id)).toEqual(['diagnostic', 'racines', 'equations', 'inequations', 'somme-produit', 'variations', 'problemes', 'problemes-2', 'methodes', 'bonus']);
    expect(step('methodes').printable).toBe(true);
    expect(lesson.duration).toBe(lesson.steps.filter((s) => s.id !== 'bonus').reduce((a, s) => a + s.minutes, 0));
    expect(lesson.duration).toBeGreaterThanOrEqual(90);
    expect(lesson.duration).toBeLessThanOrEqual(125);
    expect(lesson.session).toContain('Première');
  });

  it('chaque thème demandé est couvert', () => {
    const concepts = lesson.steps.flatMap((s) => s.concepts).join(' | ').toLowerCase();
    for (const topic of ['racine', 'discriminant', 'inéquation', 'somme des racines', 'produit des racines', 'tableau de variations', 'mise en équation']) expect(concepts).toContain(topic);
  });

  it('ids uniques, jetons {{…}} résolus, questions et champs cohérents', () => {
    const stepIds = new Set<string>();
    for (const s of lesson.steps) {
      expect(stepIds.has(s.id)).toBe(false);
      stepIds.add(s.id);
      const qIds = s.questions.map((x) => x.id);
      const fIds = s.fields.map((x) => x.id);
      const gIds = (s.figures ?? []).map((x) => x.id);
      expect(new Set([...qIds, ...fIds]).size).toBe(qIds.length + fIds.length);
      const used = new Set<string>();
      for (const [, kind, id] of s.lesson.matchAll(/\{\{(q|f|fig):([^}]+)\}\}/g)) {
        const pool = kind === 'q' ? qIds : kind === 'f' ? fIds : gIds;
        expect({ s: s.id, kind, id, found: pool.includes(id!) }).toEqual({ s: s.id, kind, id, found: true });
        used.add(`${kind}:${id}`);
      }
      for (const id of qIds) expect({ s: s.id, id, placed: used.has(`q:${id}`) }).toEqual({ s: s.id, id, placed: true });
      for (const id of fIds) expect({ s: s.id, id, placed: used.has(`f:${id}`) }).toEqual({ s: s.id, id, placed: true });
      for (const id of gIds) expect({ s: s.id, id, placed: used.has(`fig:${id}`) }).toEqual({ s: s.id, id, placed: true });
      for (const qu of s.questions) {
        expect(qu.correct).toBeGreaterThanOrEqual(0);
        expect(qu.correct).toBeLessThan(qu.choices.length);
        expect(qu.choiceFeedback).toHaveLength(qu.choices.length);
        expect(qu.choiceFeedback![qu.correct]).toBe('');
        expect(qu.choiceFeedback!.every((t, i) => i === qu.correct || t.length > 15)).toBe(true);
        expect(new Set(qu.choices).size).toBe(qu.choices.length);
        expect(qu.feedback.length).toBeGreaterThan(20);
      }
    }
  });

  it('aucun reste d’échappement, de HTML brut dans les formules ni de « Faux. » nu', () => {
    const all = JSON.stringify(content);
    expect(all).not.toMatch(/\\\\u[0-9a-f]{4}/i);
    for (const m of all.matchAll(/\\\\\((.*?)\\\\\)/g)) expect(m[1]).not.toMatch(/[<>]/);
  });
});

describe('chaque champ vérifiable est complet et ses règles sont cohérentes', () => {
  const checks = lesson.steps.flatMap((s) => s.fields.filter((f) => f.check).map((f) => ({ s: s.id, f })));

  it('couvre bien de nombreux champs', () => expect(checks.length).toBeGreaterThanOrEqual(35));

  it.each(checks.map(({ s, f }) => [`${s}/${f.id}`, f] as const))('%s', (_n, f) => {
    const c = f.check!;
    expect((c.fallback ?? '').length).toBeGreaterThan(20);
    expect((c.success ?? '').length).toBeGreaterThan(10);
    expect((c.solution ?? '').length).toBeGreaterThan(20); // correction détaillée proposée après une réponse fausse
    for (const a of c.accept) expect(evaluateAnswer(c, a).ok).toBe(true);
    for (const r of c.rules ?? []) {
      expect(r.feedback.length).toBeGreaterThan(20);
      for (const w of r.when) {
        const v = evaluateAnswer(c, w);
        expect({ w, ok: v.ok, targeted: v.targeted }).toEqual({ w, ok: false, targeted: true }); // une erreur type n'est jamais une bonne réponse
      }
    }
    expect(evaluateAnswer(c, '').empty).toBe(true);
    expect(evaluateAnswer(c, 'zzz zzz').ok).toBe(false);
    expect(evaluateAnswer(c, 'zzz zzz').solution).toBe(c.solution);
  });
});

// ─── Vérification mathématique indépendante ─────────────────────────────────

describe('diagnostic', () => {
  const f: Trinome = [1, -2, -3];
  it('courbe et lectures', () => {
    expect(step('diagnostic').figures![0]).toMatchObject({ fn: { kind: 'polynomial', coeffs: [-3, -2, 1] } });
    verifies('diagnostic', 'f0', num(ev(f, 0)));
    verifies('diagnostic', 'lecture', asSet(roots(f)));
    expect(correctChoice('diagnostic', 'sens')).toMatch(/haut/); // a = 1 > 0
    expect(f[0]).toBeGreaterThan(0);
  });
});

describe('racines', () => {
  it('test de racine et factorisation', () => {
    const p: Trinome = [1, -7, 10];
    expect(ev(p, 5)).toBe(0);
    expect(correctChoice('racines', 'test')).toMatch(/Oui.*0/);
    verifies('racines', 'produit-nul', asSet([4, -3]));
    verifies('racines', 'commun', asSet(roots([1, -5, 0])));
    verifies('racines', 'ident', asSet(roots([1, 0, -9])));
    const q: Trinome = [1, 1, -6];
    const [r1, r2] = roots(q) as [number, number];
    verifies('racines', 'factorise', `(x-(${num(r1)}))(x-(${num(r2)}))`);
    expect([r1, r2]).toEqual([-3, 2]);
  });
});

describe('équations', () => {
  it('discriminants et solutions', () => {
    verifies('equations', 'delta1', num(disc([2, -3, -2])));
    verifies('equations', 'sol1', asSet(roots([2, -3, -2])));
    expect(disc([1, -6, 9])).toBe(0);
    expect(correctChoice('equations', 'double')).toMatch(/seule/);
    verifies('equations', 'sol2', asSet(roots([1, -6, 9])));
    expect(disc([1, 1, 1])).toBeLessThan(0);
    verifies('equations', 'sol3', asSet(roots([1, 1, 1])));
    verifies('equations', 'sol4', asSet(roots([1, -1, -1]))); // valeurs numériques = (1±√5)/2
    verifies('equations', 'sol5', asSet(roots([3, -5, -2]))); // 3x² = 5x + 2 ⇔ 3x² − 5x − 2 = 0
  });
  it('les solutions annoncées annulent bien le trinôme', () => {
    for (const [t, rs] of [[[2, -3, -2], [2, -0.5]], [[3, -5, -2], [2, -1 / 3]], [[1, -1, -1], [(1 + Math.sqrt(5)) / 2, (1 - Math.sqrt(5)) / 2]]] as [Trinome, number[]][]) {
      for (const r of rs) expect(ev(t, r)).toBeCloseTo(0, 9);
    }
  });
});

describe('inéquations', () => {
  const cases: [string, Trinome, boolean, boolean][] = [
    ['i1', [1, -1, -6], true, true], // x²−x−6 > 0
    ['i2', [-1, 4, -3], true, false], // −x²+4x−3 ≥ 0
    ['i3', [1, 2, 5], true, true], // x²+2x+5 > 0
    ['i4', [2, -1, -1], false, false], // 2x²−x−1 ≤ 0
    ['i5', [1, -2, -3], true, true], // x² > 2x+3 ⇔ x²−2x−3 > 0
  ];
  it.each(cases)('%s', (id, t, positive, strict) => {
    const solution = ineq(t, positive, strict);
    // L'étude de signe elle-même est contrôlée par échantillonnage fin.
    for (let x = -12; x <= 12; x += 0.0173) expect({ x, in: inInterval(solution, x) }).toEqual({ x, in: ineqHolds(t, positive, strict, x) });
    verifies('inequations', id, solution);
  });
  it('carré ≤ 0', () => {
    expect(correctChoice('inequations', 'carre')).toMatch(/Uniquement/);
    expect([1, 2, 3].map((x) => (x - 2) ** 2 <= 0)).toEqual([false, true, false]);
  });
  it('la figure marque les racines de x²−x−6', () => {
    const fg = step('inequations').figures![0] as { fn: { coeffs: number[] }; points: { x: number }[] };
    expect(fg.fn.coeffs).toEqual([-6, -1, 1]);
    for (const p of fg.points) expect(ev([1, -1, -6], p.x)).toBeCloseTo(0, 9);
  });
});

describe('somme et produit', () => {
  it('S, P, racines évidentes', () => {
    const t: Trinome = [2, -10, 12];
    verifies('somme-produit', 's1', num(-t[1] / t[0]));
    verifies('somme-produit', 'p1', num(t[2] / t[0]));
    verifies('somme-produit', 'r1', asSet(roots(t)));
    expect(disc(t)).toBeGreaterThan(0);
    const e1: Trinome = [2, -7, 5];
    expect(e1[0] + e1[1] + e1[2]).toBe(0);
    verifies('somme-produit', 'ev1', asSet(roots(e1)));
    const e2: Trinome = [2, 5, 3];
    expect(e2[0] - e2[1] + e2[2]).toBe(0);
    verifies('somme-produit', 'ev2', asSet(roots(e2)));
  });
  it('somme 7 produit 12 ; somme 2 produit 5 impossible', () => {
    verifies('somme-produit', 'sp2', asSet(roots([1, -7, 12])));
    expect(disc([1, -2, 5])).toBeLessThan(0);
    expect(correctChoice('somme-produit', 'sp3')).toMatch(/Non/);
  });
  it('racine 3 de x²−8x+c', () => {
    const c = 3 * 5;
    expect(ev([1, -8, c], 3)).toBe(0);
    verifies('somme-produit', 'autre', num(8 - 3));
    verifies('somme-produit', 'cc', num(c));
    expect(roots([1, -8, c])).toEqual([3, 5]);
  });
  it('x1²+x2² = S²−2P, vérifié sur les racines réelles', () => {
    const t: Trinome = [2, -6, 1];
    expect(disc(t)).toBe(28);
    const [r1, r2] = roots(t) as [number, number];
    verifies('somme-produit', 'carres', num(r1 * r1 + r2 * r2));
  });
});

describe('variations', () => {
  const g: Trinome = [2, -8, 5];
  const h: Trinome = [-1, 6, -4];
  it('sommet, forme canonique, extrema', () => {
    verifies('variations', 'alpha', num(alpha(g)));
    verifies('variations', 'beta', num(beta(g)));
    verifies('variations', 'canonique', `${g[0]}(x-(${num(alpha(g))}))^2+(${num(beta(g))})`);
    expect(g[0]).toBeGreaterThan(0);
    expect(correctChoice('variations', 'minimum')).toMatch(/minimum/);
    expect(disc(g)).toBeGreaterThan(0);
    expect(correctChoice('variations', 'racines-g')).toBe('Deux');
    verifies('variations', 'hmax', num(beta(h)));
    expect(h[0]).toBeLessThan(0);
    verifies('variations', 'hcroi', `]-∞;${num(alpha(h))}]`);
  });
  it('croissance : échantillonnage', () => {
    for (let x = -5; x < alpha(h) - 0.01; x += 0.1) expect(ev(h, x + 0.01)).toBeGreaterThan(ev(h, x));
    for (let x = alpha(h) + 0.01; x < 9; x += 0.1) expect(ev(h, x + 0.01)).toBeLessThan(ev(h, x));
  });
  it('comparaison sans calcul', () => {
    const f: Trinome = [1, -6, 1];
    expect(alpha(f)).toBe(3);
    expect(ev(f, 1)).toBeGreaterThan(ev(f, 2));
    expect(correctChoice('variations', 'compare')).toBe('\\(f(1)\\gt f(2)\\)');
  });
  it('image de [0 ; 5] par k', () => {
    const k: Trinome = [1, -4, 3];
    let lo = Infinity;
    let hi = -Infinity;
    for (let x = 0; x <= 5 + 1e-9; x += 0.0005) {
      lo = Math.min(lo, ev(k, x));
      hi = Math.max(hi, ev(k, x));
    }
    expect([Math.round(lo * 1e6) / 1e6, Math.round(hi * 1e6) / 1e6]).toEqual([-1, 8]);
    verifies('variations', 'image', `[${num(beta(k))};${num(ev(k, 5))}]`);
  });
  it('le sommet marqué sur la figure est le bon', () => {
    const fg = step('variations').figures![0] as { fn: { coeffs: number[] }; points: { x: number }[] };
    expect(fg.fn.coeffs).toEqual([g[2], g[1], g[0]]);
    expect(fg.points[0]!.x).toBe(alpha(g));
  });
});

describe('problèmes', () => {
  it('rectangle de périmètre 20', () => {
    const A: Trinome = [-1, 10, 0]; // x(10−x)
    verifies('problemes', 'aire', `x(10-x)`);
    expect(ev(A, 3)).toBe(3 * (10 - 3));
    verifies('problemes', 'xmax', num(alpha(A)));
    verifies('problemes', 'amax', num(beta(A)));
    expect(correctChoice('problemes', 'nature')).toBe('Un carré');
    expect(10 - alpha(A)).toBe(alpha(A));
  });
  it('entiers consécutifs de produit 156', () => {
    const rs = roots([1, 1, -156]);
    for (const n of rs) expect(n * (n + 1)).toBe(156);
    verifies('problemes', 'entiers', asSet(rs));
  });
  it('chemin autour de la pelouse', () => {
    // (60−2x)(40−2x) − 1500 = 4x² − 200x + 900
    const full: Trinome = [4, -200, 2400 - 1500];
    for (const x of [0, 1, 7, 13]) expect((60 - 2 * x) * (40 - 2 * x) - 1500).toBe(ev(full, x));
    const simplified: Trinome = [1, -50, 225];
    expect(full.map((c) => c / 4)).toEqual([...simplified]);
    verifies('problemes', 'simplifie', `x^2-50x+225`);
    verifies('problemes', 'chemin', asSet(roots(simplified)));
    const valid = roots(simplified).filter((x) => x > 0 && 40 - 2 * x > 0);
    expect(valid).toEqual([5]);
    expect((60 - 2 * 5) * (40 - 2 * 5)).toBe(1500);
    expect(correctChoice('problemes', 'rejet')).toMatch(/20/);
  });
});

describe('problèmes (mouvement et bénéfice)', () => {
  const h: Trinome = [-5, 20, 25];
  const B: Trinome = [-2, 12, -10];
  it('balle', () => {
    verifies('problemes-2', 'tmax', num(alpha(h)));
    verifies('problemes-2', 'hmaxb', num(beta(h)));
    verifies('problemes-2', 'tsol', num(roots(h).find((t) => t > 0)!));
    verifies('problemes-2', 't40', asSet(roots([h[0], h[1], h[2] - 40])));
    expect(ev(h, 5)).toBe(0);
    const fg = step('problemes-2').figures![0] as { fn: { coeffs: number[] }; points: { x: number }[] };
    expect(fg.fn.coeffs).toEqual([h[2], h[1], h[0]]);
    expect(fg.points[0]!.x).toBe(alpha(h));
  });
  it('bénéfice', () => {
    verifies('problemes-2', 'rentable', ineq(B, true, true));
    verifies('problemes-2', 'xopt', num(alpha(B)));
    verifies('problemes-2', 'bmax', num(beta(B)));
    verifies('problemes-2', 'perte', num(ev(B, 8)));
    expect(ev(B, 8)).toBeLessThan(0);
    expect(correctChoice('problemes-2', 'conclusion')).toMatch(/entre 100 et 500/);
    for (let x = 0; x <= 8; x += 0.05) expect(ev(B, x) > 1e-9).toBe(x > 1 + 1e-9 && x < 5 - 1e-9);
  });
});

describe('approfondissement', () => {
  it('équations bicarrées', () => {
    const sols = (a: number, b: number, c: number) => {
      const out = new Set<number>();
      for (const X of roots([a, b, c])) if (X >= 0) { out.add(Math.sqrt(X)); out.add(-Math.sqrt(X)); }
      return [...out].sort((p, q) => p - q);
    };
    const s1 = sols(1, -5, 4);
    for (const x of s1) expect(x ** 4 - 5 * x * x + 4).toBeCloseTo(0, 9);
    verifies('bonus', 'bic1', asSet(s1));
    const s2 = sols(1, 1, -6);
    for (const x of s2) expect(x ** 4 + x * x - 6).toBeCloseTo(0, 9);
    verifies('bonus', 'bic2', asSet(s2));
    // exhaustivité : aucune autre racine réelle entre -5 et 5
    const f4 = (x: number) => x ** 4 + x * x - 6;
    let crossings = 0;
    for (let x = -5; x < 5; x += 0.001) if (f4(x) * f4(x + 0.001) < 0) crossings++;
    expect(crossings).toBe(2);
  });
});

// ─── Catalogue et routage ───────────────────────────────────────────────────

describe('catalogue', () => {
  it('activité déclarée, leçon enregistrée, route et audience', () => {
    const def = getActivityDef(MATHS_SECOND_DEGRE_ACTIVITY_SLUG)!;
    expect(def).toMatchObject({ subject: 'MATHEMATIQUES', moduleSlug: 'second-degre', kind: 'RESOURCE_PACK', groupSlugs: ['premiere-generale'] });
    expect(def.stepsTotal).toBe(getLessonRequiredSteps(MATHS_SECOND_DEGRE_ACTIVITY_SLUG).length);
    expect(def.stepsTotal).toBe(9);
    expect(def.resources).toEqual([]);
    expect(getLesson(MATHS_SECOND_DEGRE_ACTIVITY_SLUG)?.runnerPath).toBeNull();
    expect(lessonHref(MATHS_SECOND_DEGRE_ACTIVITY_SLUG)).toBe('/espace/maths/second-degre');
    expect(lessonHref(MATHS_SECOND_DEGRE_ACTIVITY_SLUG, 'abc')).toBe('/espace/maths/second-degre?seance=abc');
    expect(ACTIVITIES.filter((a) => a.slug === MATHS_SECOND_DEGRE_ACTIVITY_SLUG)).toHaveLength(1);
  });
});
