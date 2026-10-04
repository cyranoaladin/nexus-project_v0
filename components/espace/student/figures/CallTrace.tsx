'use client';

import { useId, useMemo, useState } from 'react';

import {
  buildTrace,
  callLabel,
  callStats,
  clampArgs,
  phaseAfter,
  stackAfter,
  TRACE_LIMITS,
  type TraceEvent,
} from '@/lib/espace/recursion-trace';
import type { CallTraceSpec } from '@/lib/espace/lesson-types';

const BTN =
  'inline-flex h-10 items-center rounded-lg border border-white/20 px-4 text-sm text-neutral-100 hover:bg-white/5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent';
const INPUT =
  'h-10 w-20 rounded-lg border border-white/15 bg-white/5 px-3 text-neutral-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent';

const PHASE_TEXT = {
  avant: 'Rien n’a encore été appelé. Clique sur « Étape suivante ».',
  descente: 'Descente : chaque appel en crée un nouveau, sur un problème plus petit.',
  remontee: 'Remontée : les appels se terminent, du dernier créé au premier.',
  fin: 'Terminé : l’appel initial a retourné sa valeur et la pile est vide.',
} as const;

function eventText(e: TraceEvent): string {
  return e.kind === 'call' ? `APPEL ${e.label}` : `RETOUR ${e.value}${e.detail && e.detail !== 'cas de base' ? ` (${e.detail})` : e.detail ? ' (cas de base)' : ''} — ${e.label}`;
}

export function CallTrace({ spec }: { spec: CallTraceSpec }) {
  const uid = useId();
  const [args, setArgs] = useState<number[]>(() => clampArgs(spec.fn, spec.args));
  const [k, setK] = useState(0);
  const events = useMemo(() => buildTrace(spec.fn, args), [spec.fn, args]);
  const stack = stackAfter(spec.fn, events, k);
  const phase = phaseAfter(events, k);
  const shown = events.slice(0, k);
  const last = k > 0 ? events[k - 1]! : null;
  const stats = useMemo(() => callStats(events), [events]);

  const setArg = (i: number, raw: string) => {
    const next = [...args];
    next[i] = Number(raw);
    setArgs(clampArgs(spec.fn, next));
    setK(0);
  };

  return (
    <figure className="my-4 rounded-xl border border-white/10 bg-white/5 p-4" data-testid={`trace-${spec.id}`}>
      <figcaption className="mb-3 text-sm font-medium text-neutral-100">{spec.caption ?? `Trace de ${callLabel(spec.fn, args)}`}</figcaption>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        {TRACE_LIMITS[spec.fn].map((lim, i) => (
          <div key={lim.name} className="flex items-center gap-2">
            <label htmlFor={`${uid}-${lim.name}`} className="text-sm text-neutral-200">
              {lim.name} =
            </label>
            <input
              id={`${uid}-${lim.name}`}
              type="number"
              inputMode="numeric"
              className={INPUT}
              min={lim.min}
              max={lim.max}
              value={args[i]}
              onChange={(e) => setArg(i, e.target.value)}
              aria-label={`Valeur de ${lim.name} (de ${lim.min} à ${lim.max})`}
            />
          </div>
        ))}
        <button type="button" className={BTN} onClick={() => setK((v) => Math.max(0, v - 1))} disabled={k === 0}>
          Étape précédente
        </button>
        <button type="button" className={BTN} onClick={() => setK((v) => Math.min(events.length, v + 1))} disabled={k >= events.length}>
          Étape suivante
        </button>
        <button type="button" className={BTN} onClick={() => setK(0)} disabled={k === 0}>
          Recommencer
        </button>
      </div>

      <p className="mb-3 text-sm text-neutral-200" data-testid="trace-phase">
        <strong>{PHASE_TEXT[phase]}</strong> Appel étudié : <code className="rounded bg-white/10 px-1">{callLabel(spec.fn, args)}</code> — {events.length / 2} appels au total, jusqu’à {stats.maxDepth} appels empilés en même temps.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 text-sm font-medium text-neutral-100">Ce qui s’est passé</p>
          <ol aria-label="Événements déjà exécutés" className="max-h-72 space-y-1 overflow-y-auto font-mono text-sm" data-testid="trace-events">
            {shown.length === 0 && <li className="list-none italic text-neutral-300">Aucun événement pour l’instant.</li>}
            {shown.map((e, i) => (
              <li
                key={i}
                style={{ paddingLeft: `${e.depth * 14}px` }}
                className={`list-none ${e.kind === 'call' ? 'text-sky-200' : 'text-emerald-200'} ${i === shown.length - 1 ? 'font-semibold' : ''}`}
                data-event={e.kind}
              >
                {eventText(e)}
              </li>
            ))}
          </ol>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-neutral-100">Pile d’appels (le sommet est en haut)</p>
          <ol aria-label="Pile d’appels (sommet en premier)" className="flex min-h-16 flex-col items-start gap-1" data-testid="trace-stack">
            {stack.length === 0 && <li className="list-none text-sm italic text-neutral-300">La pile est vide.</li>}
            {stack.map((f, i) => (
              <li
                key={f.callId}
                className={`list-none rounded-md border px-3 py-1 font-mono text-sm text-neutral-50 ${i === 0 ? 'border-brand-accent bg-brand-accent/15' : 'border-white/25 bg-white/5'}`}
              >
                {f.label}
                <span className="ml-2 text-xs text-neutral-300">attend : {f.waiting}</span>
                {i === 0 && <span className="ml-2 text-xs text-neutral-300">← sommet</span>}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p role="status" aria-live="polite" className="mt-3 min-h-6 text-sm text-neutral-100" data-testid="trace-message">
        {last
          ? last.kind === 'call'
            ? `On appelle ${last.label}${last.depth > 0 ? ' : un problème plus petit que l’appel précédent' : ''}.`
            : `${last.label} se termine et retourne ${last.value}${last.detail === 'cas de base' ? ' (cas de base : aucun nouvel appel)' : ` (${last.detail})`}. Le dernier appel créé est le premier terminé : c’est le comportement d’une pile (LIFO).`
          : ''}
      </p>
      {spec.fn === 'fibonacci' && stats.repeated.length > 0 && (
        <p className="mt-2 text-sm text-neutral-100" data-testid="trace-repeated">
          Calculs répétés : {stats.repeated.map((r) => `${r.label} ×${r.times}`).join(', ')}.
        </p>
      )}
    </figure>
  );
}
