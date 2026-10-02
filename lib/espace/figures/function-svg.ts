/**
 * Tracé SVG pur d'une courbe de fonction (polynôme ou fraction rationnelle).
 *
 * - aucune dépendance au DOM ni au CSS de la page : le même module sert l'interface
 *   React et le fallback hors ligne / le corrigé imprimable ;
 * - la courbe est coupée aux pôles et lorsqu'elle sort de la fenêtre (jamais de trait
 *   vertical parasite à travers une asymptote) ; une singularité « levable »
 *   (ex. (x²−1)/(x−1) en 1) est tracée avec un petit cercle ouvert ;
 * - dérivée exacte (règle du quotient), jamais numérique ;
 * - sortie déterministe : mêmes entrées → même chaîne.
 */
import type { FunctionFigureSpec, FunctionSpec } from '../lesson-types';

// ─── Évaluation exacte ──────────────────────────────────────────────────────

const horner = (coeffs: readonly number[], x: number): number => coeffs.reduceRight((acc, k) => acc * x + k, 0);

const derive = (coeffs: readonly number[]): number[] => (coeffs.length <= 1 ? [0] : coeffs.slice(1).map((c, i) => c * (i + 1)));

export function evalFunction(fn: FunctionSpec, x: number): number {
  return fn.kind === 'polynomial' ? horner(fn.coeffs, x) : horner(fn.num, x) / horner(fn.den, x);
}

/** Dérivée en x, calculée analytiquement (polynôme : dérivation terme à terme ; fraction : (N′D − ND′)/D²). */
export function derivativeAt(fn: FunctionSpec, x: number): number {
  if (fn.kind === 'polynomial') return horner(derive(fn.coeffs), x);
  const n = horner(fn.num, x);
  const d = horner(fn.den, x);
  return (horner(derive(fn.num), x) * d - n * horner(derive(fn.den), x)) / (d * d);
}

// ─── Pôles et singularités levables ─────────────────────────────────────────

function trim(coeffs: readonly number[]): number[] {
  const c = [...coeffs];
  while (c.length > 0 && Math.abs(c[c.length - 1]!) < 1e-12) c.pop();
  return c;
}

/** Racines réelles (ordre croissant) d'un polynôme : exactes jusqu'au degré 2, par balayage + bissection au-delà. */
export function realRoots(coeffs: readonly number[], lo: number, hi: number): number[] {
  const c = trim(coeffs);
  if (c.length <= 1) return [];
  if (c.length === 2) return [-c[0]! / c[1]!];
  if (c.length === 3) {
    const [c0, c1, c2] = c as [number, number, number];
    const disc = c1 * c1 - 4 * c2 * c0;
    if (Math.abs(disc) < 1e-12) return [-c1 / (2 * c2)];
    if (disc < 0) return [];
    const s = Math.sqrt(disc);
    return [(-c1 - s) / (2 * c2), (-c1 + s) / (2 * c2)].sort((p, q) => p - q);
  }
  const roots: number[] = [];
  const steps = 4000;
  let prevX = lo;
  let prevY = horner(c, lo);
  for (let i = 1; i <= steps; i++) {
    const x = lo + ((hi - lo) * i) / steps;
    const y = horner(c, x);
    if (prevY === 0) roots.push(prevX);
    else if (prevY * y < 0) {
      let a = prevX;
      let b = x;
      for (let k = 0; k < 80; k++) {
        const m = (a + b) / 2;
        if (horner(c, a) * horner(c, m) <= 0) b = m;
        else a = m;
      }
      roots.push((a + b) / 2);
    }
    prevX = x;
    prevY = y;
  }
  return roots;
}

export interface Singularities {
  /** Pôles (asymptotes verticales de la courbe) dans la fenêtre. */
  poles: number[];
  /** Trous : dénominateur nul mais limite finie. */
  holes: { x: number; y: number }[];
}

export function findSingularities(fn: FunctionSpec, xmin: number, xmax: number): Singularities {
  const out: Singularities = { poles: [], holes: [] };
  if (fn.kind !== 'rational') return out;
  for (const r of realRoots(fn.den, xmin, xmax)) {
    if (r < xmin - 1e-9 || r > xmax + 1e-9) continue;
    const left = evalFunction(fn, r - 1e-5);
    const right = evalFunction(fn, r + 1e-5);
    if (Number.isFinite(left) && Number.isFinite(right) && Math.abs(left) < 1e3 && Math.abs(right) < 1e3 && Math.abs(left - right) < 1e-2) {
      out.holes.push({ x: r, y: (left + right) / 2 });
    } else out.poles.push(r);
  }
  return out;
}

// ─── Mise en forme ──────────────────────────────────────────────────────────

export interface BuildOptions {
  /** Droite y = a·x + b saisie par l'élève, tracée en pointillés. */
  overlay?: { a: number; b: number } | null;
  width?: number;
  height?: number;
}

export const FIGURE_COLORS = {
  background: '#ffffff',
  ink: '#111827',
  grid: '#e5e7eb',
  axis: '#374151',
  curve: '#1d4ed8',
  asymptote: '#b45309',
  tangent: '#047857',
  overlay: '#be123c',
} as const;

const MINUS = '−';

function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  const s = Object.is(r, -0) ? '0' : String(r);
  return s;
}

/** Nombre pour un affichage français : virgule décimale, vrai signe moins. */
function label(n: number): string {
  const r = Math.round(n * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r).replace('-', MINUS).replace('.', ',');
}

function niceStep(range: number): number {
  const raw = range / 12;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
}

function ticks(lo: number, hi: number): number[] {
  const step = niceStep(hi - lo);
  const out: number[] = [];
  for (let t = Math.ceil(lo / step - 1e-9); t * step <= hi + 1e-9; t++) out.push(Math.round(t * step * 1e9) / 1e9);
  return out;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Description textuelle (lecteurs d'écran, impression en niveaux de gris). */
export function describeFigure(spec: FunctionFigureSpec, overlay?: { a: number; b: number } | null): string {
  const w = spec.window;
  const parts = [`Repère : x de ${label(w.xmin)} à ${label(w.xmax)}, y de ${label(w.ymin)} à ${label(w.ymax)}.`];
  for (const a of spec.verticalAsymptotes ?? []) parts.push(`Asymptote verticale d’équation x = ${label(a)}.`);
  for (const l of spec.horizontalAsymptotes ?? []) parts.push(`Asymptote horizontale d’équation y = ${label(l)}.`);
  for (const p of spec.points ?? []) parts.push(`Point d’abscisse ${label(p.x)}.`);
  if (spec.tangentAt !== undefined) {
    parts.push(`Tangente au point d’abscisse ${label(spec.tangentAt)}, de coefficient directeur ${label(derivativeAt(spec.fn, spec.tangentAt))}.`);
  }
  if (overlay) parts.push('Une droite en pointillés représente l’équation saisie par l’élève.');
  if (spec.hideCurve) parts.push('La courbe est masquée.');
  return parts.join(' ');
}

export function buildFunctionSvg(spec: FunctionFigureSpec, options: BuildOptions = {}): string {
  const width = options.width ?? 560;
  const height = options.height ?? 380;
  const overlay = options.overlay ?? null;
  const { xmin, xmax, ymin, ymax } = spec.window;
  const m = { l: 40, r: 16, t: 14, b: 28 };
  const pw = width - m.l - m.r;
  const ph = height - m.t - m.b;
  const X = (x: number) => m.l + ((x - xmin) / (xmax - xmin)) * pw;
  const Y = (y: number) => m.t + ((ymax - y) / (ymax - ymin)) * ph;
  const clipId = `clip-${spec.id}`;
  const titleId = `fig-${spec.id}-title`;
  const descId = `fig-${spec.id}-desc`;
  const C = FIGURE_COLORS;
  const out: string[] = [];

  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="${titleId} ${descId}" font-family="system-ui, sans-serif" font-size="12">`,
    `<title id="${titleId}">${esc(spec.caption ?? 'Courbe représentative de la fonction')}</title>`,
    `<desc id="${descId}">${esc(describeFigure(spec, overlay))}</desc>`,
    `<defs><clipPath id="${clipId}"><rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}"/></clipPath></defs>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${C.background}"/>`,
  );

  // Grille et graduations
  const xt = ticks(xmin, xmax);
  const yt = ticks(ymin, ymax);
  const axisY = ymin <= 0 && ymax >= 0 ? Y(0) : Y(ymin);
  const axisX = xmin <= 0 && xmax >= 0 ? X(0) : X(xmin);
  for (const t of xt) out.push(`<line x1="${fmt(X(t))}" y1="${m.t}" x2="${fmt(X(t))}" y2="${m.t + ph}" stroke="${C.grid}" stroke-width="1"/>`);
  for (const t of yt) out.push(`<line x1="${m.l}" y1="${fmt(Y(t))}" x2="${m.l + pw}" y2="${fmt(Y(t))}" stroke="${C.grid}" stroke-width="1"/>`);
  out.push(`<line x1="${m.l}" y1="${fmt(axisY)}" x2="${m.l + pw}" y2="${fmt(axisY)}" stroke="${C.axis}" stroke-width="1.5"/>`);
  out.push(`<line x1="${fmt(axisX)}" y1="${m.t}" x2="${fmt(axisX)}" y2="${m.t + ph}" stroke="${C.axis}" stroke-width="1.5"/>`);
  for (const t of xt) {
    if (Math.abs(t) < 1e-9 && axisX > m.l + 1) continue;
    out.push(`<text x="${fmt(X(t))}" y="${fmt(Math.min(axisY + 14, m.t + ph + 14))}" text-anchor="middle" fill="${C.ink}">${label(t)}</text>`);
  }
  for (const t of yt) {
    if (Math.abs(t) < 1e-9) continue;
    out.push(`<text x="${fmt(Math.max(axisX - 5, m.l - 3))}" y="${fmt(Y(t) + 4)}" text-anchor="end" fill="${C.ink}">${label(t)}</text>`);
  }
  out.push(`<text x="${m.l + pw - 2}" y="${fmt(axisY - 5)}" text-anchor="end" font-style="italic" fill="${C.ink}">x</text>`);
  out.push(`<text x="${fmt(axisX + 6)}" y="${m.t + 11}" font-style="italic" fill="${C.ink}">y</text>`);

  out.push(`<g clip-path="url(#${clipId})">`);

  // Asymptotes (tirets longs, ambre)
  const vAs = spec.verticalAsymptotes ?? [];
  const hAs = spec.horizontalAsymptotes ?? [];
  for (const a of vAs) out.push(`<line x1="${fmt(X(a))}" y1="${m.t}" x2="${fmt(X(a))}" y2="${m.t + ph}" stroke="${C.asymptote}" stroke-width="1.8" stroke-dasharray="7 5"/>`);
  for (const l of hAs) out.push(`<line x1="${m.l}" y1="${fmt(Y(l))}" x2="${m.l + pw}" y2="${fmt(Y(l))}" stroke="${C.asymptote}" stroke-width="1.8" stroke-dasharray="7 5"/>`);

  // Courbe, coupée aux pôles et aux sorties de fenêtre
  const sing = findSingularities(spec.fn, xmin, xmax);
  if (!spec.hideCurve) {
    const range = xmax - xmin;
    const xs = new Set<number>();
    const N = 480;
    for (let i = 0; i <= N; i++) xs.add(xmin + (range * i) / N);
    for (const p of sing.poles) {
      for (const d of [0.05, 0.02, 0.008, 0.003, 0.001, 3e-4, 1e-4, 3e-5, 1e-5]) {
        xs.add(p - range * d);
        xs.add(p + range * d);
      }
    }
    const sorted = [...xs].filter((x) => x >= xmin && x <= xmax && !sing.poles.some((p) => Math.abs(p - x) < 1e-9)).sort((a, b) => a - b);
    const R = ymax - ymin;
    const lo = ymin - 0.5 * R;
    const hi = ymax + 0.5 * R;
    const d: string[] = [];
    let pen = false;
    let last: [number, number] | null = null;
    let prev: { x: number; y: number } | null = null;
    for (const x of sorted) {
      let y = evalFunction(spec.fn, x);
      if (!Number.isFinite(y)) {
        // trou levable évalué exactement en 0/0 : on le saute sans couper la courbe
        const hole = sing.holes.find((h) => Math.abs(h.x - x) < 1e-9);
        if (hole) y = hole.y;
        else {
          pen = false;
          prev = null;
          continue;
        }
      }
      if (prev) {
        const poleBetween = sing.poles.some((p) => p > prev!.x && p < x);
        if (poleBetween) {
          pen = false;
        } else {
          // Découpe du segment [prev, (x,y)] sur la bande verticale [lo, hi]
          let t0 = 0;
          let t1 = 1;
          const dy = y - prev.y;
          if (Math.abs(dy) < 1e-12) {
            if (prev.y < lo || prev.y > hi) t1 = -1;
          } else {
            const ta = (lo - prev.y) / dy;
            const tb = (hi - prev.y) / dy;
            t0 = Math.max(0, Math.min(ta, tb));
            t1 = Math.min(1, Math.max(ta, tb));
          }
          if (t0 <= t1) {
            const ax = prev.x + (x - prev.x) * t0;
            const ay = prev.y + dy * t0;
            const bx = prev.x + (x - prev.x) * t1;
            const by = prev.y + dy * t1;
            const pa: [number, number] = [X(ax), Y(ay)];
            const pb: [number, number] = [X(bx), Y(by)];
            if (!pen || !last || Math.abs(last[0] - pa[0]) > 0.01 || Math.abs(last[1] - pa[1]) > 0.01) d.push(`M${fmt(pa[0])} ${fmt(pa[1])}`);
            d.push(`L${fmt(pb[0])} ${fmt(pb[1])}`);
            last = pb;
            pen = t1 === 1;
          } else {
            pen = false;
          }
        }
      }
      prev = { x, y };
    }
    if (d.length > 0) out.push(`<path d="${d.join('')}" fill="none" stroke="${C.curve}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`);
  }

  // Tangente (exacte) et droite de l'élève
  if (spec.tangentAt !== undefined) {
    const a = spec.tangentAt;
    const slope = derivativeAt(spec.fn, a);
    const y0 = evalFunction(spec.fn, a);
    if (Number.isFinite(slope) && Number.isFinite(y0)) {
      out.push(`<line x1="${fmt(X(xmin))}" y1="${fmt(Y(y0 + slope * (xmin - a)))}" x2="${fmt(X(xmax))}" y2="${fmt(Y(y0 + slope * (xmax - a)))}" stroke="${C.tangent}" stroke-width="2.2"/>`);
    }
  }
  if (overlay && Number.isFinite(overlay.a) && Number.isFinite(overlay.b)) {
    out.push(`<line x1="${fmt(X(xmin))}" y1="${fmt(Y(overlay.a * xmin + overlay.b))}" x2="${fmt(X(xmax))}" y2="${fmt(Y(overlay.a * xmax + overlay.b))}" stroke="${C.overlay}" stroke-width="2.2" stroke-dasharray="2 4" stroke-linecap="round"/>`);
  }

  // Trous (cercles ouverts)
  if (!spec.hideCurve) {
    for (const h of sing.holes) out.push(`<circle cx="${fmt(X(h.x))}" cy="${fmt(Y(h.y))}" r="4.5" fill="${C.background}" stroke="${C.curve}" stroke-width="2"/>`);
  }
  out.push('</g>');

  // Points marqués (hors clip pour garder l'étiquette lisible)
  const marked = [...(spec.points ?? [])];
  if (spec.tangentAt !== undefined && !marked.some((p) => p.x === spec.tangentAt)) marked.push({ x: spec.tangentAt });
  for (const p of marked) {
    const y = evalFunction(spec.fn, p.x);
    if (!Number.isFinite(y) || y < ymin || y > ymax || p.x < xmin || p.x > xmax) continue;
    const text = `${p.label ?? ''}(${label(p.x)} ; ${label(y)})`;
    const px = X(p.x);
    const anchorEnd = px > m.l + pw - 90;
    out.push(`<circle cx="${fmt(px)}" cy="${fmt(Y(y))}" r="4.5" fill="${C.ink}" stroke="${C.background}" stroke-width="1.5"/>`);
    out.push(
      `<text x="${fmt(anchorEnd ? px - 8 : px + 8)}" y="${fmt(Y(y) - 8)}" text-anchor="${anchorEnd ? 'end' : 'start'}" fill="${C.ink}" font-weight="600" stroke="${C.background}" stroke-width="3" paint-order="stroke">${esc(text)}</text>`,
    );
  }

  // Étiquettes d'asymptotes
  for (const a of vAs) {
    out.push(`<text x="${fmt(X(a) + 5)}" y="${m.t + 26}" fill="${C.asymptote}" font-weight="700" stroke="${C.background}" stroke-width="3" paint-order="stroke">x = ${label(a)}</text>`);
  }
  for (const l of hAs) {
    out.push(`<text x="${m.l + pw - 4}" y="${fmt(Y(l) - 6)}" text-anchor="end" fill="${C.asymptote}" font-weight="700" stroke="${C.background}" stroke-width="3" paint-order="stroke">y = ${label(l)}</text>`);
  }

  // Légende minimale (en haut à droite)
  const legend: { color: string; dash?: string; text: string }[] = [];
  if (!spec.hideCurve) legend.push({ color: C.curve, text: spec.curveLabel ?? 'courbe' });
  if (vAs.length + hAs.length > 0) legend.push({ color: C.asymptote, dash: '7 5', text: vAs.length + hAs.length > 1 ? 'asymptotes' : 'asymptote' });
  if (spec.tangentAt !== undefined) legend.push({ color: C.tangent, text: 'tangente' });
  if (overlay) legend.push({ color: C.overlay, dash: '2 4', text: 'ta droite' });
  if (legend.length > 1 || overlay) {
    const lx = m.l + pw - 118;
    const ly = m.t + ph - 14 - legend.length * 18;
    out.push(`<rect x="${lx - 6}" y="${ly - 6}" width="122" height="${legend.length * 18 + 8}" rx="4" fill="${C.background}" fill-opacity="0.92" stroke="${C.grid}"/>`);
    legend.forEach((e, i) => {
      const y = ly + 8 + i * 18;
      out.push(`<line x1="${lx}" y1="${y}" x2="${lx + 24}" y2="${y}" stroke="${e.color}" stroke-width="2.4"${e.dash ? ` stroke-dasharray="${e.dash}"` : ''}/>`);
      out.push(`<text x="${lx + 30}" y="${y + 4}" fill="${C.ink}">${esc(e.text)}</text>`);
    });
  }

  out.push('</svg>');
  return out.join('');
}
