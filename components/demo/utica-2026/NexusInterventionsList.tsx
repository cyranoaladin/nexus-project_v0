/**
 * "Ce que Nexus a fait" / journal (brief §30 / §52 / §27). Même selector
 * filtré par canal — utilisé tel quel côté Parent (équipe) et côté ARIA
 * (journal d'apprentissage) pour éviter deux listes dupliquées.
 */
import { History } from 'lucide-react';
import type { DemoIntervention } from '@/lib/demo/utica-2026/types';

export function NexusInterventionsList({
  title,
  interventions,
}: {
  title: string;
  interventions: DemoIntervention[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        <History className="h-4 w-4" aria-hidden="true" />
        {title}
      </h2>
      <ol className="mt-3 space-y-3 border-l border-white/10 pl-4">
        {interventions.map((item) => (
          <li key={item.id} className="relative text-sm">
            <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-brand-accent" aria-hidden="true" />
            <p className="text-[11px] font-medium text-neutral-500">{item.dateLabel}</p>
            <p className="text-neutral-200">{item.label}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
