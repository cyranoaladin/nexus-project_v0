/**
 * Nexus Pulse (§6-8) — "Qu'a concrètement fait Nexus cette semaine ?".
 * Chaque puce est dérivée de getNexusPulse() (lib/demo/utica-2026/selectors.ts) ;
 * aucune formulation marketing invérifiable (§15 du gate P1A).
 */
import { Activity, ArrowRight } from 'lucide-react';
import type { NexusPulse } from '@/lib/demo/utica-2026/selectors';

function formatHours(hours: number): string {
  const wholeHours = Math.floor(hours);
  const minutes = Math.round((hours - wholeHours) * 60);
  if (minutes === 0) return `${wholeHours} h`;
  return `${wholeHours} h ${minutes}`;
}

export function NexusPulseCard({ pulse }: { pulse: NexusPulse }) {
  const bullets = [
    `${pulse.sessionsOrganizedCount} séance${pulse.sessionsOrganizedCount > 1 ? 's' : ''} Nexus organisée${pulse.sessionsOrganizedCount > 1 ? 's' : ''} (${formatHours(pulse.sessionsHours)})`,
    pulse.resultsAnalyzedCount > 0 &&
      `${pulse.resultsAnalyzedCount} résultat${pulse.resultsAnalyzedCount > 1 ? 's' : ''} pédagogique${pulse.resultsAnalyzedCount > 1 ? 's' : ''} analysé${pulse.resultsAnalyzedCount > 1 ? 's' : ''}`,
    `${pulse.prioritiesIdentifiedCount} priorité de consolidation identifiée`,
    pulse.resourcesRecommendedCount > 0 &&
      `${pulse.resourcesRecommendedCount} ressource${pulse.resourcesRecommendedCount > 1 ? 's' : ''} ciblée${pulse.resourcesRecommendedCount > 1 ? 's' : ''} proposée${pulse.resourcesRecommendedCount > 1 ? 's' : ''}`,
    pulse.planUpdated && 'Plan de travail mis à jour',
    pulse.reportsAddedCount > 0 &&
      `${pulse.reportsAddedCount} compte${pulse.reportsAddedCount > 1 ? 's' : ''} rendu${pulse.reportsAddedCount > 1 ? 's' : ''} ajouté${pulse.reportsAddedCount > 1 ? 's' : ''} au dossier`,
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        <Activity className="h-4 w-4" aria-hidden="true" />
        Nexus Pulse — cette semaine Nexus a…
      </h2>
      <ul className="mt-3 space-y-1.5">
        {bullets.map((bullet) => (
          <li key={bullet} className="text-sm text-neutral-200">
            {bullet}
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-lg border border-brand-primary/20 bg-brand-primary/10 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-accent">
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
          Prochaine action Nexus
        </p>
        <p className="mt-1 text-sm text-neutral-200">{pulse.nextNexusAction}</p>
      </div>
    </div>
  );
}
