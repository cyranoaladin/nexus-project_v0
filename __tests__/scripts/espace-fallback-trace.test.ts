import { initialTrace, traceMarkup, traceReduce, type TraceState } from '@/scripts/espace/fallback/trace';
import type { CallTraceSpec } from '@/lib/espace/lesson-types';

const spec: CallTraceSpec = { type: 'call-trace', id: 't', fn: 'somme', args: [4] };
const run = (actions: Parameters<typeof traceReduce>[2][], s: CallTraceSpec = spec): TraceState => actions.reduce((st, a) => traceReduce(s, st, a), initialTrace(s));
const text = (html: string, testid: string) => new RegExp(`data-testid="${testid}"[^>]*>([\\s\\S]*?)</(?:ol|p)>`).exec(html)?.[1] ?? '';

describe('trace hors ligne (mêmes textes que la plateforme)', () => {
  it('état initial : rien appelé, pile vide, précédent désactivé', () => {
    const html = traceMarkup(spec, initialTrace(spec));
    expect(text(html, 'trace-phase')).toContain('Rien n’a encore été appelé');
    expect(html).toContain('La pile est vide.');
    expect(html).toMatch(/data-trace="prev" disabled/);
    expect(html).not.toMatch(/data-trace="next" disabled/);
  });

  it('descente puis remontée : APPEL empilés, RETOUR dans l’ordre inverse, LIFO annoncé', () => {
    const next = Array.from({ length: 5 }, () => ({ type: 'next' as const }));
    const down = traceMarkup(spec, run(next));
    expect(text(down, 'trace-phase')).toContain('Descente');
    expect(text(down, 'trace-stack')).toMatch(/^<li class="hl">somme\(0\)/);
    expect((down.match(/data-event="call"/g) ?? []).length).toBe(5);

    const done = traceMarkup(spec, run(Array.from({ length: 10 }, () => ({ type: 'next' as const }))));
    expect([...done.matchAll(/RETOUR (\d+)/g)].map((m) => m[1])).toEqual(['0', '1', '3', '6', '10']);
    expect(text(done, 'trace-phase')).toContain('Terminé');
    expect(done).toContain('La pile est vide.');
    expect(done).toMatch(/data-trace="next" disabled/);
    expect(text(done, 'trace-message')).toContain('Le dernier appel créé est le premier terminé');
  });

  it('précédent, recommencer et changement de paramètre', () => {
    expect(run([{ type: 'next' }, { type: 'next' }, { type: 'prev' }]).k).toBe(1);
    expect(run([{ type: 'next' }, { type: 'reset' }]).k).toBe(0);
    const changed = run([{ type: 'next' }, { type: 'arg', index: 0, value: 2 }]);
    expect(changed).toEqual({ args: [2], k: 0 });
    expect(traceMarkup(spec, changed)).toContain('3 appels au total');
    expect(run([{ type: 'arg', index: 0, value: 9999 }]).args).toEqual([8]);
    expect(run([{ type: 'arg', index: 0, value: Number.NaN }]).args).toEqual([0]);
  });

  it('aucun HTML injecté : le contenu est échappé et aucune URL n’apparaît', () => {
    const html = traceMarkup({ ...spec, caption: '<img src=x onerror=alert(1)>' }, initialTrace(spec));
    expect(html).not.toContain('<img');
    expect(html).not.toMatch(/https?:/);
  });

  it('fibonacci signale les calculs répétés', () => {
    const fib: CallTraceSpec = { type: 'call-trace', id: 'f', fn: 'fibonacci', args: [5] };
    expect(traceMarkup(fib, initialTrace(fib))).toContain('fibonacci(2) ×3');
  });
});
