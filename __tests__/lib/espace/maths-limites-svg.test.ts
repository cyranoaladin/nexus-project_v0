import { buildFunctionSvg, derivativeAt, evalFunction, findSingularities, realRoots } from '@/lib/espace/figures/function-svg';
import type { FunctionFigureSpec, FunctionSpec } from '@/lib/espace/lesson-types';

const g: FunctionSpec = { kind: 'rational', num: [1, 2], den: [-1, 1] }; // (2x+1)/(x-1)
const h: FunctionSpec = { kind: 'rational', num: [-1, 0, 1], den: [-1, 1] }; // (x²-1)/(x-1)
const k: FunctionSpec = { kind: 'rational', num: [0, -3, 2], den: [-1, 0, 1] }; // (2x²-3x)/(x²-1)

const base: FunctionFigureSpec = {
  type: 'function',
  id: 'fig-g',
  fn: g,
  window: { xmin: -6, xmax: 8, ymin: -8, ymax: 10 },
  verticalAsymptotes: [1],
  horizontalAsymptotes: [2],
  tangentAt: 0,
  points: [{ x: 0, label: 'A' }],
};

describe('évaluation et dérivée exactes', () => {
  it('g, h, k', () => {
    expect(evalFunction(g, 0)).toBe(-1);
    expect(evalFunction(g, 3)).toBe(3.5);
    expect(evalFunction(k, 0)).toBeCloseTo(0, 12);
  });
  it('dérivée de g : −3/(x−1)²', () => {
    for (const x of [-4, 0, 0.5, 2, 5]) expect(derivativeAt(g, x)).toBeCloseTo(-3 / (x - 1) ** 2, 12);
  });
  it('dérivée de k : (3x²−4x+3)/(x²−1)²', () => {
    for (const x of [-3, -0.5, 0, 0.3, 2, 7]) expect(derivativeAt(k, x)).toBeCloseTo((3 * x * x - 4 * x + 3) / (x * x - 1) ** 2, 10);
  });
  it('polynôme : 3x⁴−5x²+7x−1', () => {
    const p: FunctionSpec = { kind: 'polynomial', coeffs: [-1, 7, -5, 0, 3] };
    expect(derivativeAt(p, 2)).toBe(12 * 8 - 10 * 2 + 7);
  });
});

describe('singularités', () => {
  it('pôle simple de g, deux pôles de k', () => {
    expect(findSingularities(g, -6, 8).poles).toEqual([1]);
    expect(findSingularities(k, -6, 8).poles).toEqual([-1, 1]);
  });
  it('h : singularité levable en 1 (trou), pas de pôle', () => {
    const s = findSingularities(h, -6, 8);
    expect(s.poles).toEqual([]);
    expect(s.holes).toHaveLength(1);
    expect(s.holes[0]!.x).toBeCloseTo(1, 9);
    expect(s.holes[0]!.y).toBeCloseTo(2, 4);
  });
  it('racines : degré 3 par balayage', () => {
    const roots = realRoots([-6, 11, -6, 1], -10, 10); // (x-1)(x-2)(x-3)
    expect(roots).toHaveLength(3);
    [1, 2, 3].forEach((r, i) => expect(roots[i]).toBeCloseTo(r, 9));
  });
});

describe('buildFunctionSvg', () => {
  const svg = buildFunctionSvg(base);

  it('est déterministe', () => {
    expect(buildFunctionSvg(base)).toBe(svg);
  });
  it('ne contient aucun NaN / Infinity / undefined', () => {
    expect(svg).not.toMatch(/NaN|Infinity|undefined/);
  });
  it('est accessible : role img, titre, description, légende minimale', () => {
    expect(svg).toContain('role="img"');
    expect(svg).toContain('<title');
    expect(svg).toContain('<desc');
    expect(svg).toContain('Asymptote verticale d’équation x = 1');
    expect(svg).toContain('Asymptote horizontale d’équation y = 2');
    expect(svg).toContain('coefficient directeur −3');
  });
  it('étiquette les asymptotes et le point de tangence avec ses coordonnées', () => {
    expect(svg).toContain('x = 1');
    expect(svg).toContain('y = 2');
    expect(svg).toContain('A(0 ; −1)');
  });
  it('coupe la courbe au pôle : deux sous-chemins, aucun segment ne traverse l’asymptote', () => {
    const d = /<path d="([^"]+)" fill="none" stroke="#1d4ed8"/.exec(svg)![1]!;
    const subpaths = d.split('M').filter(Boolean);
    expect(subpaths.length).toBeGreaterThanOrEqual(2);
    // abscisse pixel de x = 1 : m.l + (1+6)/14 * (560-40-16)
    const px1 = 40 + (7 / 14) * 504;
    for (const sp of subpaths) {
      const xsPx = [...sp.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
      const allLeft = xsPx.every((x) => x <= px1 + 0.5);
      const allRight = xsPx.every((x) => x >= px1 - 0.5);
      expect(allLeft || allRight).toBe(true);
    }
  });
  it('place les asymptotes à la bonne abscisse / ordonnée', () => {
    const px1 = 40 + (7 / 14) * 504; // x=1
    expect(svg).toContain(`x1="${px1}" y1="14" x2="${px1}"`);
    const py2 = 14 + ((10 - 2) / 18) * (380 - 14 - 28); // y=2
    expect(svg).toContain(`y1="${Math.round(py2 * 100) / 100}" x2="${40 + 504}"`);
  });
  it('trace la tangente exacte : passe par (0, −1) avec la pente −3', () => {
    const m = /<line x1="40" y1="([\d.-]+)" x2="544" y2="([\d.-]+)" stroke="#047857"/.exec(svg)!;
    const Y = (y: number) => 14 + ((10 - y) / 18) * 338;
    expect(Number(m[1])).toBeCloseTo(Y(-1 + -3 * -6), 1);
    expect(Number(m[2])).toBeCloseTo(Y(-1 + -3 * 8), 1);
  });
  it('droite de l’élève : pointillés et couleur distincts, légende', () => {
    const withOverlay = buildFunctionSvg(base, { overlay: { a: -3, b: -1 } });
    expect(withOverlay).toContain('stroke="#be123c"');
    expect(withOverlay).toContain('stroke-dasharray="2 4"');
    expect(withOverlay).toContain('ta droite');
    expect(withOverlay).not.toMatch(/NaN/);
    expect(svg).not.toContain('#be123c');
  });
  it('trou de h : cercle ouvert, courbe continue', () => {
    const s = buildFunctionSvg({ type: 'function', id: 'fig-h', fn: h, window: { xmin: -4, xmax: 5, ymin: -3, ymax: 7 } });
    expect(s).toMatch(/<circle[^>]+fill="#ffffff"[^>]+stroke="#1d4ed8"/);
    expect((/<path d="([^"]+)"/.exec(s)![1]!.match(/M/g) ?? []).length).toBe(1);
    expect(s).not.toMatch(/NaN/);
  });
  it('k : deux pôles, trois branches', () => {
    const s = buildFunctionSvg({ type: 'function', id: 'fig-k', fn: k, window: { xmin: -6, xmax: 6, ymin: -8, ymax: 10 }, verticalAsymptotes: [-1, 1], horizontalAsymptotes: [2] });
    const d = /<path d="([^"]+)" fill="none" stroke="#1d4ed8"/.exec(s)![1]!;
    expect(d.split('M').filter(Boolean).length).toBeGreaterThanOrEqual(3);
    expect(s).not.toMatch(/NaN|Infinity/);
  });
  it('courbe masquée : aucune courbe', () => {
    const s = buildFunctionSvg({ ...base, hideCurve: true });
    expect(s).not.toContain('stroke="#1d4ed8"');
    expect(s).toContain('La courbe est masquée');
  });
  it('un contenu hostile dans la légende ou la description est échappé', () => {
    const s = buildFunctionSvg({ ...base, caption: '<script>alert(1)</script>', curveLabel: '"><img src=x>' });
    expect(s).not.toContain('<script>');
    expect(s).not.toContain('<img');
  });
});
