/**
 * Vue 360° — les 4 dimensions du parcours (§5.3). Vocabulaire qualitatif
 * uniquement (jamais un score/pourcentage inventé — amendement du gate P1A §4).
 */
import type { DimensionState, JourneyDimension } from '@/lib/demo/utica-2026/selectors';

const STATE_DOT: Record<DimensionState, string> = {
  SOUS_CONTROLE: 'bg-emerald-400',
  A_JOUR: 'bg-emerald-400',
  ACTIVE: 'bg-emerald-400',
  EN_PROGRESSION: 'bg-blue-400',
  ACTION_REQUISE: 'bg-amber-400',
};

export function JourneyDimensionsGrid({ dimensions }: { dimensions: JourneyDimension[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {dimensions.map((dim) => (
        <div key={dim.key} className="rounded-xl border border-white/10 bg-surface-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{dim.label}</p>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-neutral-100">
            <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[dim.state]}`} aria-hidden="true" />
            {dim.stateLabel}
          </p>
          <ul className="mt-2.5 space-y-1">
            {dim.bullets.map((bullet) => (
              <li key={bullet} className="text-xs text-neutral-500">
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
