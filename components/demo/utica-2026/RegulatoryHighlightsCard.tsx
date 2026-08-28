/**
 * Rappel réglementaire (amendement A5) : coefficients réellement dérivés du
 * référentiel officiel session 2027 (data/exams/bac-general-2027.json via
 * lib/exams/catalog.ts) — jamais une valeur inventée pour la démonstration.
 */
import { ShieldCheck } from 'lucide-react';
import type { RegulatoryHighlight } from '@/lib/demo/utica-2026/regulatory';

export function RegulatoryHighlightsCard({
  highlights,
  sourceLabel,
}: {
  highlights: RegulatoryHighlight[];
  sourceLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        Repères réglementaires — session 2027
      </h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {highlights.map((h) => (
          <li
            key={h.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-surface-darker/40 px-3 py-2 text-sm"
          >
            <span className="text-neutral-300">{h.label}</span>
            <span className="shrink-0 text-neutral-500">coef. {h.coefficient}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-neutral-600">Source : {sourceLabel}</p>
    </div>
  );
}
