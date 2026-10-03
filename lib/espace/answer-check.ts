/**
 * Vérification pédagogique de réponses saisies (maths) : pure, sans DOM.
 *
 * Objectif : reconnaître une réponse sous ses écritures usuelles (`−3x−1`,
 * `y = -1 - 3x`, `+∞`, `plus l'infini`, `6/4`…) et, sinon, répondre par un
 * message qui aide à comprendre l'erreur (règles ciblées), jamais par « Faux. ».
 * Les réponses attendues vivent dans le contenu de la leçon : limite assumée,
 * comme pour les QCM du TP 1 (le corrigé détaillé, lui, reste privé).
 */

export type AnswerKind = 'number' | 'limit' | 'equation' | 'linear' | 'text';

export interface AnswerRule {
  /** Réponses (écritures libres) qui déclenchent ce message ciblé. */
  when: string[];
  feedback: string;
}

export interface AnswerCheck {
  kind: AnswerKind;
  /** Réponses correctes, écrites comme un élève pourrait les écrire. */
  accept: string[];
  rules?: AnswerRule[];
  success?: string;
  /** Message quand la réponse n'est ni correcte ni reconnue par une règle. */
  fallback?: string;
}

export interface AnswerVerdict {
  ok: boolean;
  feedback: string;
  /** Une règle ciblée a reconnu l'erreur. */
  targeted: boolean;
  /** Réponse vide ou illisible pour ce type de champ. */
  empty: boolean;
}

// ─── Expressions affines en x : a·x + b ─────────────────────────────────────

interface Affine {
  a: number;
  b: number;
}

const EPS = 1e-9;

function normalizeMath(raw: string): string {
  return raw
    .replace(/[’‘]/g, "'")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, '^') // NFKC écraserait « x² » en « x2 » (= 2x) : on le rend illisible, jamais faux
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/,/g, '.')
    .replace(/\s+/g, '');
}

/** Analyse `a·x + b` (multiplication implicite, fractions, parenthèses). `null` si non affine. */
export function parseAffine(raw: string): Affine | null {
  const s = normalizeMath(raw);
  if (!s) return null;
  let i = 0;

  const peek = () => s[i];
  const lin = (a: number, b: number): Affine => ({ a, b });
  const isConst = (v: Affine) => Math.abs(v.a) < EPS;
  const mul = (p: Affine, q: Affine): Affine | null => {
    if (isConst(p)) return lin(q.a * p.b, q.b * p.b);
    if (isConst(q)) return lin(p.a * q.b, p.b * q.b);
    return null;
  };

  function expr(): Affine | null {
    let left = term();
    while (left && (peek() === '+' || peek() === '-')) {
      const op = s[i++];
      const right = term();
      if (!right) return null;
      left = op === '+' ? lin(left.a + right.a, left.b + right.b) : lin(left.a - right.a, left.b - right.b);
    }
    return left;
  }

  function startsFactor(): boolean {
    const c = peek();
    return c !== undefined && (/[0-9.x(]/.test(c));
  }

  function term(): Affine | null {
    let left = factor();
    while (left) {
      if (peek() === '*') {
        i++;
        const right = factor();
        left = right && mul(left, right);
      } else if (peek() === '/') {
        i++;
        const right = factor();
        if (!right || !isConst(right) || Math.abs(right.b) < EPS) return null;
        left = lin(left.a / right.b, left.b / right.b);
      } else if (startsFactor()) {
        const right = factor(); // multiplication implicite : 3x, 2(x+1), (3/2)x
        left = right && mul(left, right);
      } else break;
    }
    return left;
  }

  function factor(): Affine | null {
    const c = peek();
    if (c === '-') {
      i++;
      const f = factor();
      return f && lin(-f.a, -f.b);
    }
    if (c === '+') {
      i++;
      return factor();
    }
    if (c === '(') {
      i++;
      const e = expr();
      if (peek() !== ')') return null;
      i++;
      return e;
    }
    if (c === 'x') {
      i++;
      return lin(1, 0);
    }
    const m = /^[0-9]*\.?[0-9]+/.exec(s.slice(i)) ?? /^[0-9]+\.?/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return lin(0, Number.parseFloat(m[0]));
  }

  const result = expr();
  return result && i === s.length && Number.isFinite(result.a) && Number.isFinite(result.b) ? result : null;
}

function parseNumber(raw: string): number | null {
  const v = parseAffine(raw);
  return v && Math.abs(v.a) < EPS ? v.b : null;
}

// ─── Formes canoniques par type de champ ────────────────────────────────────

/** `+inf`, `-inf`, `n:<nombre>`, `none` ou `raw:<texte normalisé>`. */
function canonLimit(raw: string): string {
  let s = normalizeMath(raw).replace(/\(|\)/g, '');
  s = s.replace(/l'?infini/g, 'inf').replace(/infini/g, 'inf').replace(/∞/g, 'inf').replace(/plus/g, '+').replace(/moins/g, '-');
  if (/^(pasdelimite|nexistepas|aucune)/.test(s)) return 'none';
  if (/^\+?inf$/.test(s)) return '+inf';
  if (/^-inf$/.test(s)) return '-inf';
  const n = parseNumber(s);
  return n !== null ? `n:${round(n)}` : `raw:${s}`;
}

function round(n: number): string {
  return String(Math.round(n * 1e9) / 1e9);
}

/** `x=1`, `y=2` → `x=1` ; accepte `1=x`. */
function canonEquation(raw: string): string {
  const s = normalizeMath(raw);
  const parts = s.split('=');
  if (parts.length !== 2) return `raw:${s}`;
  const [l, r] = parts as [string, string];
  const [variable, value] = /^[xy]$/.test(l) ? [l, r] : /^[xy]$/.test(r) ? [r, l] : ['', ''];
  const n = variable ? parseNumber(value) : null;
  return variable && n !== null ? `${variable}=${round(n)}` : `raw:${s}`;
}

/** `y=-3x-1`, `-1-3x`, `y = −3x − 1` → `a=-3;b=-1`. */
function canonLinear(raw: string): string {
  let s = normalizeMath(raw);
  if (s.startsWith('y=')) s = s.slice(2);
  else if (s.includes('=')) return `raw:${s}`;
  const v = parseAffine(s);
  return v ? `a=${round(v.a)};b=${round(v.b)}` : `raw:${s}`;
}

function canon(kind: AnswerKind, raw: string): string {
  switch (kind) {
    case 'number': {
      const n = parseNumber(raw);
      return n !== null ? `n:${round(n)}` : `raw:${normalizeMath(raw)}`;
    }
    case 'limit':
      return canonLimit(raw);
    case 'equation':
      return canonEquation(raw);
    case 'linear':
      return canonLinear(raw);
    default:
      return `raw:${normalizeMath(raw).replace(/[^a-z0-9àâçéèêëîïôûùüÿœ+\-*/=<>.]/g, '')}`;
  }
}

export function evaluateAnswer(check: AnswerCheck, raw: string): AnswerVerdict {
  const given = canon(check.kind, raw);
  if (!raw.trim()) {
    return { ok: false, empty: true, targeted: false, feedback: 'Écris ta réponse avant de vérifier.' };
  }
  if (check.accept.some((a) => canon(check.kind, a) === given)) {
    return { ok: true, empty: false, targeted: false, feedback: check.success ?? 'Bonne réponse.' };
  }
  const rule = check.rules?.find((r) => r.when.some((w) => canon(check.kind, w) === given));
  if (rule) return { ok: false, empty: false, targeted: true, feedback: rule.feedback };
  const unreadable = given.startsWith('raw:') && check.kind !== 'text';
  return {
    ok: false,
    empty: false,
    targeted: false,
    feedback: unreadable
      ? 'Je ne reconnais pas cette écriture. ' + (check.fallback ?? 'Relis la consigne et écris la réponse sous la forme demandée.')
      : (check.fallback ?? 'Ce n’est pas la bonne réponse : reprends ton raisonnement étape par étape.'),
  };
}
