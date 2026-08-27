'use client';

/**
 * "Ton parcours autonome" (brief §24/§25) — objectif actuel, pourquoi cet
 * objectif, étape suivante. Dérivé du même PedagogicalFocus que les cartes
 * Parent/Élève (amendement A3). Le CTA "Commencer mon activité" ouvre un
 * aperçu local — aucun appel au vrai moteur ARIA (amendement A6).
 *
 * `evidenceReference` (P1C §8) ancre "pourquoi cette activité" à une preuve
 * réelle du scénario (date + libellé) — jamais une formulation laissant
 * croire à une analyse automatique réelle ("ARIA a analysé...").
 */
import { useState } from 'react';
import { Play, Sparkles } from 'lucide-react';
import type { AriaFocusDescription } from '@/lib/demo/utica-2026/selectors';
import type { PedagogicalFocus } from '@/lib/demo/utica-2026/types';

export function AriaObjectiveCard({
  focus,
  description,
  evidenceReference,
}: {
  focus: PedagogicalFocus;
  description: AriaFocusDescription;
  evidenceReference?: { dateLabel: string; label: string } | null;
}) {
  const [started, setStarted] = useState(false);

  return (
    <div className="rounded-2xl border border-brand-primary/25 bg-brand-primary/10 p-6">
      <p className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-surface-darker/60 px-2.5 py-1 text-[11px] font-medium text-neutral-400">
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        Parcours ARIA — autonomie accompagnée
      </p>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-accent">Objectif actuel</p>
      <p className="mt-1 text-lg font-medium text-neutral-50">{focus.fragileCompetency}</p>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
        {description.title}
      </p>
      <p className="mt-1 text-sm text-neutral-300">{description.text}</p>
      {evidenceReference && (
        <p className="mt-1 text-[11px] text-neutral-500">
          Preuve utilisée : {evidenceReference.dateLabel} — {evidenceReference.label}
        </p>
      )}

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">Étape suivante</p>
      <p className="mt-1 text-sm text-neutral-200">
        {description.activityLabel} — {description.activityMinutes} min
      </p>

      <button
        type="button"
        onClick={() => setStarted(true)}
        disabled={started}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-primary/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-primary disabled:cursor-default disabled:bg-emerald-600/80"
      >
        <Play className="h-3.5 w-3.5" aria-hidden="true" />
        {started ? 'Activité démarrée — étape 3 du cycle' : 'Commencer mon activité'}
      </button>
    </div>
  );
}
