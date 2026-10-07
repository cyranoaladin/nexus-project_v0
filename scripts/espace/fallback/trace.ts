/**
 * Trace APPEL / RETOUR du plan de secours : même modèle (`lib/espace/recursion-trace.ts`) et mêmes textes que la figure
 * de la plateforme, rendus en HTML statique (les boutons sont gérés par délégation d'événements dans runtime.ts).
 */
import type { CallTraceSpec } from '../../../lib/espace/lesson-types';
import {
  buildTrace,
  callLabel,
  callStats,
  clampArgs,
  eventText,
  PHASE_TEXT,
  phaseAfter,
  stackAfter,
  stepMessage,
  TRACE_LIMITS,
} from '../../../lib/espace/recursion-trace';

export interface TraceState {
  args: number[];
  /** Nombre d'événements déjà montrés. */
  k: number;
}

export function initialTrace(spec: CallTraceSpec): TraceState {
  return { args: clampArgs(spec.fn, spec.args), k: 0 };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function traceMarkup(spec: CallTraceSpec, st: TraceState): string {
  const events = buildTrace(spec.fn, st.args);
  const stack = stackAfter(spec.fn, events, st.k);
  const phase = phaseAfter(events, st.k);
  const shown = events.slice(0, st.k);
  const last = st.k > 0 ? events[st.k - 1]! : null;
  const stats = callStats(events);
  const inputs = TRACE_LIMITS[spec.fn]
    .map((lim, i) => `<label>${esc(lim.name)} = <input type="number" inputmode="numeric" data-trace-arg="${i}" min="${lim.min}" max="${lim.max}" value="${st.args[i]}" aria-label="Valeur de ${esc(lim.name)} (de ${lim.min} à ${lim.max})"></label>`)
    .join('');
  const items = shown.length
    ? shown
        .map((e, i) => `<li data-event="${e.kind}" class="tr-${e.kind}${i === shown.length - 1 ? ' tr-last' : ''}" style="padding-left:${e.depth * 14}px">${esc(eventText(e))}</li>`)
        .join('')
    : '<li class="sim-empty">Aucun événement pour l’instant.</li>';
  const frames = stack.length
    ? stack.map((f, i) => `<li class="${i === 0 ? 'hl' : ''}">${esc(f.label)}<span class="sim-tag">attend : ${esc(f.waiting)}</span>${i === 0 ? '<span class="sim-tag">← sommet</span>' : ''}</li>`).join('')
    : '<li class="sim-empty">La pile est vide.</li>';
  const repeated =
    spec.fn === 'fibonacci' && stats.repeated.length
      ? `<p data-testid="trace-repeated">Calculs répétés : ${esc(stats.repeated.map((r) => `${r.label} ×${r.times}`).join(', '))}.</p>`
      : '';
  return `<figcaption>${esc(spec.caption ?? `Trace de ${callLabel(spec.fn, st.args)}`)}</figcaption>
<div class="sim-controls">${inputs}<button type="button" data-trace="prev"${st.k === 0 ? ' disabled' : ''}>Étape précédente</button><button type="button" data-trace="next"${st.k >= events.length ? ' disabled' : ''}>Étape suivante</button><button type="button" data-trace="reset"${st.k === 0 ? ' disabled' : ''}>Recommencer</button></div>
<p data-testid="trace-phase"><strong>${esc(PHASE_TEXT[phase])}</strong> Appel étudié : <code>${esc(callLabel(spec.fn, st.args))}</code> — ${events.length / 2} appels au total, jusqu’à ${stats.maxDepth} appels empilés en même temps.</p>
<div class="tr-grid"><div><p class="tr-title">Ce qui s’est passé</p><ol class="tr-events" aria-label="Événements déjà exécutés" data-testid="trace-events">${items}</ol></div>
<div><p class="tr-title">Pile d’appels (le sommet est en haut)</p><ol class="sim-items pile" aria-label="Pile d’appels (sommet en premier)" data-testid="trace-stack">${frames}</ol></div></div>
<p role="status" aria-live="polite" class="sim-message" data-testid="trace-message">${esc(stepMessage(last))}</p>${repeated}`;
}

/** Nouvel état après une action (`prev`, `next`, `reset`) ou un changement de paramètre. */
export function traceReduce(spec: CallTraceSpec, st: TraceState, action: { type: 'prev' | 'next' | 'reset' } | { type: 'arg'; index: number; value: number }): TraceState {
  const total = buildTrace(spec.fn, st.args).length;
  switch (action.type) {
    case 'prev':
      return { ...st, k: Math.max(0, st.k - 1) };
    case 'next':
      return { ...st, k: Math.min(total, st.k + 1) };
    case 'reset':
      return { ...st, k: 0 };
    case 'arg': {
      const args = [...st.args];
      args[action.index] = action.value;
      return { args: clampArgs(spec.fn, args), k: 0 };
    }
  }
}
