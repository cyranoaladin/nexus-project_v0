import { buildTrace, callStats, clampArgs, phaseAfter, stackAfter, TRACE_LIMITS, waitingFor } from '@/lib/espace/recursion-trace';

describe('buildTrace', () => {
  it('somme(4) : 5 APPEL puis 5 RETOUR dans l’ordre inverse (descente puis remontée)', () => {
    const ev = buildTrace('somme', [4]);
    expect(ev.map((e) => `${e.kind === 'call' ? 'APPEL' : 'RETOUR'} ${e.kind === 'call' ? e.label : e.value}`)).toEqual([
      'APPEL somme(4)', 'APPEL somme(3)', 'APPEL somme(2)', 'APPEL somme(1)', 'APPEL somme(0)',
      'RETOUR 0', 'RETOUR 1', 'RETOUR 3', 'RETOUR 6', 'RETOUR 10',
    ]);
  });

  it('le dernier appel créé est le premier terminé (LIFO) : l’ordre des RETOUR est l’inverse des APPEL', () => {
    const ev = buildTrace('puissance', [2, 4]);
    const calls = ev.filter((e) => e.kind === 'call').map((e) => e.callId);
    const returns = ev.filter((e) => e.kind === 'return').map((e) => e.callId);
    expect(returns).toEqual([...calls].reverse());
  });

  it('puissance(2, 4) retourne 1, 2, 4, 8, 16 avec le calcul détaillé', () => {
    const ret = buildTrace('puissance', [2, 4]).filter((e) => e.kind === 'return');
    expect(ret.map((e) => e.value)).toEqual([1, 2, 4, 8, 16]);
    expect(ret.map((e) => e.detail)).toEqual(['cas de base', '2 × 1 = 2', '2 × 2 = 4', '2 × 4 = 8', '2 × 8 = 16']);
  });

  it('factorielle(5) = 120 et factorielle(0) = 1 (cas de base direct)', () => {
    const ev = buildTrace('factorielle', [5]);
    expect(ev[ev.length - 1]).toMatchObject({ kind: 'return', value: 120, depth: 0 });
    expect(buildTrace('factorielle', [0]).map((e) => e.kind)).toEqual(['call', 'return']);
  });

  it('chaque RETOUR porte la profondeur de son APPEL', () => {
    const ev = buildTrace('somme', [3]);
    for (const e of ev.filter((x) => x.kind === 'return')) {
      expect(ev.find((c) => c.kind === 'call' && c.callId === e.callId)!.depth).toBe(e.depth);
    }
  });

  it('fibonacci(5) : bon résultat, 15 appels, des appels identiques recalculés', () => {
    const ev = buildTrace('fibonacci', [5]);
    expect(ev[ev.length - 1]!.value).toBe(5);
    const stats = callStats(ev);
    expect(stats.calls).toBe(15);
    expect(stats.repeated).toContainEqual({ label: 'fibonacci(2)', times: 3 });
    expect(stats.repeated).toContainEqual({ label: 'fibonacci(1)', times: 5 });
  });

  it('somme(4) : 5 appels, profondeur maximale 5, aucun appel répété', () => {
    expect(callStats(buildTrace('somme', [4]))).toEqual({ calls: 5, maxDepth: 5, repeated: [] });
  });
});

describe('bornes de sécurité', () => {
  it('ramène les paramètres dans les bornes et ignore les valeurs absurdes', () => {
    expect(clampArgs('somme', [999])).toEqual([TRACE_LIMITS.somme[0]!.max]);
    expect(clampArgs('somme', [-5])).toEqual([0]);
    expect(clampArgs('somme', [Number.NaN])).toEqual([0]);
    expect(clampArgs('somme', [2.9])).toEqual([2]);
    expect(clampArgs('puissance', [0, 99])).toEqual([1, 6]);
  });

  it('la trace reste de taille raisonnable même aux bornes maximales', () => {
    for (const fn of ['somme', 'factorielle', 'puissance', 'fibonacci'] as const) {
      const max = TRACE_LIMITS[fn].map((l) => l.max);
      expect(buildTrace(fn, max).length).toBeLessThanOrEqual(60);
      expect(buildTrace(fn, [1e9, 1e9]).length).toBeLessThanOrEqual(60);
    }
  });
});

describe('pile d’appels', () => {
  const ev = buildTrace('somme', [4]);

  it('le sommet est en premier ; la pile grandit pendant la descente', () => {
    expect(stackAfter('somme', ev, 0)).toEqual([]);
    expect(stackAfter('somme', ev, 1).map((f) => f.label)).toEqual(['somme(4)']);
    expect(stackAfter('somme', ev, 5).map((f) => f.label)).toEqual(['somme(0)', 'somme(1)', 'somme(2)', 'somme(3)', 'somme(4)']);
  });

  it('elle décroît pendant la remontée et se vide à la fin', () => {
    expect(stackAfter('somme', ev, 6).map((f) => f.label)).toEqual(['somme(1)', 'somme(2)', 'somme(3)', 'somme(4)']);
    expect(stackAfter('somme', ev, 10)).toEqual([]);
    expect(stackAfter('somme', ev, 99)).toEqual([]);
  });

  it('chaque appel en attente sait ce qu’il attend', () => {
    const stack = stackAfter('somme', ev, 5);
    expect(stack[0]!.waiting).toBe('0 (cas de base)');
    expect(stack[1]!.waiting).toBe('1 + somme(0)');
    expect(waitingFor('puissance', 'puissance(2, 3)')).toBe('2 × puissance(2, 2)');
    expect(waitingFor('factorielle', 'factorielle(4)')).toBe('4 × factorielle(3)');
    expect(waitingFor('fibonacci', 'fibonacci(4)')).toBe('fibonacci(3) + fibonacci(2)');
  });

  it('la phase distingue descente et remontée', () => {
    expect(phaseAfter(ev, 0)).toBe('avant');
    expect(phaseAfter(ev, 3)).toBe('descente');
    expect(phaseAfter(ev, 5)).toBe('descente');
    expect(phaseAfter(ev, 6)).toBe('remontee');
    expect(phaseAfter(ev, 10)).toBe('fin');
  });
});
