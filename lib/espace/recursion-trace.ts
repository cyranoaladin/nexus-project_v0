/**
 * Modèle de la trace d'un calcul récursif (APPEL / RETOUR) et de la pile d'appels associée.
 *
 * Pur, sans React ni DOM : il alimente la figure interactive `call-trace` de la leçon « Récursivité ».
 * La pile d'appels sert à COMPRENDRE l'exécution ; ce n'est pas une structure que l'élève programme.
 */
export type TraceFn = 'somme' | 'factorielle' | 'puissance' | 'fibonacci';

export interface TraceEvent {
  kind: 'call' | 'return';
  /** Profondeur de l'appel (0 pour l'appel initial). */
  depth: number;
  /** Identifiant de l'appel, partagé par son événement APPEL et son événement RETOUR. */
  callId: number;
  /** Écriture de l'appel, ex. `somme(3)`. */
  label: string;
  /** Valeur retournée (événements RETOUR). */
  value?: number;
  /** Calcul effectué au retour, ex. `3 + 3 = 6`, ou « cas de base ». */
  detail?: string;
}

export interface ArgLimit {
  name: string;
  min: number;
  max: number;
}

/** Bornes des paramètres modifiables (la trace doit rester lisible : au plus ~50 événements). */
export const TRACE_LIMITS: Record<TraceFn, ArgLimit[]> = {
  somme: [{ name: 'n', min: 0, max: 8 }],
  factorielle: [{ name: 'n', min: 0, max: 7 }],
  puissance: [
    { name: 'a', min: 1, max: 9 },
    { name: 'n', min: 0, max: 6 },
  ],
  fibonacci: [{ name: 'n', min: 0, max: 6 }],
};

/** Ramène les paramètres dans les bornes (entiers). */
export function clampArgs(fn: TraceFn, args: number[]): number[] {
  return TRACE_LIMITS[fn].map((lim, i) => {
    const raw = Math.trunc(Number(args[i]));
    const v = Number.isFinite(raw) ? raw : lim.min;
    return Math.min(lim.max, Math.max(lim.min, v));
  });
}

export function callLabel(fn: TraceFn, args: number[]): string {
  return `${fn}(${args.join(', ')})`;
}

/** Séquence complète des événements pour `fn(...args)` (paramètres ramenés dans les bornes). */
export function buildTrace(fn: TraceFn, rawArgs: number[]): TraceEvent[] {
  const args = clampArgs(fn, rawArgs);
  const events: TraceEvent[] = [];
  let nextId = 0;

  const visit = (a: number[], depth: number): number => {
    const callId = nextId++;
    const label = callLabel(fn, a);
    events.push({ kind: 'call', depth, callId, label });
    let value: number;
    let detail: string;
    switch (fn) {
      case 'somme': {
        const [n] = a as [number];
        if (n === 0) {
          value = 0;
          detail = 'cas de base';
        } else {
          const sub = visit([n - 1], depth + 1);
          value = n + sub;
          detail = `${n} + ${sub} = ${value}`;
        }
        break;
      }
      case 'factorielle': {
        const [n] = a as [number];
        if (n === 0) {
          value = 1;
          detail = 'cas de base';
        } else {
          const sub = visit([n - 1], depth + 1);
          value = n * sub;
          detail = `${n} × ${sub} = ${value}`;
        }
        break;
      }
      case 'puissance': {
        const [base, n] = a as [number, number];
        if (n === 0) {
          value = 1;
          detail = 'cas de base';
        } else {
          const sub = visit([base, n - 1], depth + 1);
          value = base * sub;
          detail = `${base} × ${sub} = ${value}`;
        }
        break;
      }
      case 'fibonacci': {
        const [n] = a as [number];
        if (n <= 1) {
          value = n;
          detail = 'cas de base';
        } else {
          const x = visit([n - 1], depth + 1);
          const y = visit([n - 2], depth + 1);
          value = x + y;
          detail = `${x} + ${y} = ${value}`;
        }
        break;
      }
    }
    events.push({ kind: 'return', depth, callId, label, value, detail });
    return value;
  };

  visit(args, 0);
  return events;
}

export interface Frame {
  callId: number;
  label: string;
  depth: number;
  /** Ce que cet appel attend encore, ex. `3 + somme(2)`. */
  waiting: string;
}

/** Ce qu'attend un appel non terminé. */
export function waitingFor(fn: TraceFn, label: string): string {
  const nums = (label.match(/-?\d+/g) ?? []).map(Number);
  switch (fn) {
    case 'somme': {
      const n = nums[0]!;
      return n === 0 ? '0 (cas de base)' : `${n} + somme(${n - 1})`;
    }
    case 'factorielle': {
      const n = nums[0]!;
      return n === 0 ? '1 (cas de base)' : `${n} × factorielle(${n - 1})`;
    }
    case 'puissance': {
      const [a, n] = nums as [number, number];
      return n === 0 ? '1 (cas de base)' : `${a} × puissance(${a}, ${n - 1})`;
    }
    case 'fibonacci': {
      const n = nums[0]!;
      return n <= 1 ? `${n} (cas de base)` : `fibonacci(${n - 1}) + fibonacci(${n - 2})`;
    }
  }
}

/** Pile d'appels après les `k` premiers événements : sommet en PREMIER. */
export function stackAfter(fn: TraceFn, events: TraceEvent[], k: number): Frame[] {
  const open: Frame[] = [];
  for (const e of events.slice(0, Math.max(0, Math.min(k, events.length)))) {
    if (e.kind === 'call') open.push({ callId: e.callId, label: e.label, depth: e.depth, waiting: waitingFor(fn, e.label) });
    else open.pop();
  }
  return open.reverse();
}

/** Nombre d'appels total, et nombre de fois où chaque appel identique est recalculé (utile pour fibonacci). */
export function callStats(events: TraceEvent[]): { calls: number; maxDepth: number; repeated: { label: string; times: number }[] } {
  const counts = new Map<string, number>();
  let maxDepth = 0;
  for (const e of events) {
    if (e.kind !== 'call') continue;
    counts.set(e.label, (counts.get(e.label) ?? 0) + 1);
    maxDepth = Math.max(maxDepth, e.depth + 1);
  }
  const calls = [...counts.values()].reduce((a, b) => a + b, 0);
  const repeated = [...counts.entries()].filter(([, t]) => t > 1).map(([label, times]) => ({ label, times }));
  return { calls, maxDepth, repeated };
}

/** Phase pédagogique après `k` événements. */
export function phaseAfter(events: TraceEvent[], k: number): 'avant' | 'descente' | 'remontee' | 'fin' {
  if (k <= 0) return 'avant';
  if (k >= events.length) return 'fin';
  return events[k - 1]!.kind === 'call' ? 'descente' : 'remontee';
}
