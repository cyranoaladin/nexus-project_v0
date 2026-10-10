/**
 * Lecture d'expressions polynomiales en x saisies par un élève (second degré) : pure, sans DOM.
 *
 * Reconnaît `2x²-4x+1`, `2(x-1)^2-3`, `(x-2)(x+3)`, `0,5x²`, `(1+√5)/2`, `2√5`…
 * et les ramène à leurs coefficients par puissances croissantes (`[1, -4, 2]` = 1 − 4x + 2x²),
 * afin de comparer des écritures différentes d'une même expression (forme développée,
 * factorisée, canonique). Ce qui n'est pas lisible renvoie `null` : jamais une valeur devinée.
 *
 * Règles volontairement strictes (pas de devinette) : pas de multiplication implicite après un
 * chiffre (`x2`, `(x-1)2` sont illisibles), division par une constante non nulle seulement,
 * √ d'une constante positive seulement, exposants entiers de 0 à 4.
 */

const EPS = 1e-9;
const MAX_DEGREE = 8;
const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/** Écritures usuelles → forme canonique de lecture (minuscules, `-`, `*`, `.`, sans espace). */
export function normalizePoly(raw: string): string {
  return raw
    .replace(/[’‘]/g, "'")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (ch) => `^${SUPERSCRIPTS.indexOf(ch)}`)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/,/g, '.')
    .replace(/\s+/g, '')
    .replace(/sqrt\(|racine\(|racinecarree\(/g, '√(')
    .replace(/(?:sqrt|racine)(?=\d)/g, '√');
}

type Poly = number[];

function trim(p: Poly): Poly {
  const out = p.slice();
  while (out.length > 1 && Math.abs(out[out.length - 1]!) < EPS) out.pop();
  return out;
}

function add(p: Poly, q: Poly, sign = 1): Poly {
  const out: number[] = Array.from({ length: Math.max(p.length, q.length) }, (_, i) => (p[i] ?? 0) + sign * (q[i] ?? 0));
  return trim(out);
}

function mul(p: Poly, q: Poly): Poly | null {
  const out: number[] = Array(p.length + q.length - 1).fill(0);
  p.forEach((a, i) => q.forEach((b, j) => (out[i + j] = out[i + j]! + a * b)));
  const t = trim(out);
  return t.length - 1 > MAX_DEGREE ? null : t;
}

const isConst = (p: Poly) => p.length === 1;

/** Coefficients (puissances croissantes) de l'expression, ou `null` si illisible. */
export function parsePolynomial(raw: string): Poly | null {
  const s = normalizePoly(raw);
  if (!s) return null;
  let i = 0;
  const peek = () => s[i];

  function expr(): Poly | null {
    let left = term();
    while (left && (peek() === '+' || peek() === '-')) {
      const op = s[i++];
      const right = term();
      if (!right) return null;
      left = add(left, right, op === '+' ? 1 : -1);
    }
    return left;
  }

  function startsFactor(): boolean {
    const c = peek();
    return c === 'x' || c === '(' || c === '√';
  }

  function term(): Poly | null {
    let left = unary();
    while (left) {
      if (peek() === '*') {
        i++;
        const right = unary();
        left = right && mul(left, right);
      } else if (peek() === '/') {
        i++;
        const right = unary();
        if (!right || !isConst(right) || Math.abs(right[0]!) < EPS) return null;
        left = left.map((c) => c / right[0]!);
      } else if (startsFactor()) {
        const right = power(); // 2x, 3(x+1), (x-1)(x+2), 2√5
        left = right && mul(left, right);
      } else break;
    }
    return left;
  }

  function unary(): Poly | null {
    if (peek() === '-') {
      i++;
      const f = unary();
      return f && f.map((c) => -c);
    }
    if (peek() === '+') {
      i++;
      return unary();
    }
    return power();
  }

  function power(): Poly | null {
    const base = atom();
    if (!base || peek() !== '^') return base;
    i++;
    const paren = peek() === '(';
    if (paren) i++;
    const m = /^[0-9]+/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    if (paren) {
      if (peek() !== ')') return null;
      i++;
    }
    const n = Number.parseInt(m[0], 10);
    if (n > 4) return null;
    let out: Poly | null = [1];
    for (let k = 0; k < n && out; k++) out = mul(out, base);
    return out;
  }

  function atom(): Poly | null {
    const c = peek();
    if (c === '(') {
      i++;
      const e = expr();
      if (peek() !== ')') return null;
      i++;
      return e;
    }
    if (c === 'x') {
      i++;
      return [0, 1];
    }
    if (c === '√') {
      i++;
      let inner: Poly | null;
      if (peek() === '(') {
        i++;
        inner = expr();
        if (peek() !== ')') return null;
        i++;
      } else {
        const m = /^[0-9]*\.?[0-9]+/.exec(s.slice(i));
        if (!m) return null;
        i += m[0].length;
        inner = [Number.parseFloat(m[0])];
      }
      if (!inner || !isConst(inner) || inner[0]! < -EPS) return null;
      return [Math.sqrt(Math.max(0, inner[0]!))];
    }
    const m = /^[0-9]*\.?[0-9]+/.exec(s.slice(i)) ?? /^[0-9]+\.?/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return [Number.parseFloat(m[0])];
  }

  const result = expr();
  return result && i === s.length && result.every(Number.isFinite) ? result : null;
}

/** Valeur d'une expression sans x (`3/2`, `(1+√5)/2`), ou `null`. */
export function parseConstant(raw: string): number | null {
  const p = parsePolynomial(raw);
  return p && isConst(p) ? p[0]! : null;
}

/** Deux polynômes de mêmes coefficients (tolérance numérique). */
export function samePolynomial(p: Poly, q: Poly): boolean {
  const n = Math.max(p.length, q.length);
  for (let k = 0; k < n; k++) if (Math.abs((p[k] ?? 0) - (q[k] ?? 0)) > 1e-7) return false;
  return true;
}
