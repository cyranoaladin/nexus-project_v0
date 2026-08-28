/**
 * Vue 360° — "Priorité actuelle" (§5.2). Élément visuellement dominant du
 * fold : même PedagogicalFocus que Parent/Élève/ARIA, projeté une fois de
 * plus (amendement A3, cf. getJourneyPriority()).
 */
import { Target } from 'lucide-react';
import type { JourneyPriority } from '@/lib/demo/utica-2026/selectors';

export function JourneyPriorityHero({
  priority,
  activeResourceTitle,
}: {
  priority: JourneyPriority;
  /** P3 §26 : une seule donnée supplémentaire, jamais une bibliothèque sur cette vue. */
  activeResourceTitle?: string;
}) {
  return (
    <section className="rounded-2xl border border-brand-primary/25 bg-gradient-to-br from-brand-primary/15 to-brand-primary/5 p-6 sm:p-7">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-accent">
        <Target className="h-4 w-4" aria-hidden="true" />
        Priorité actuelle
      </div>
      <p className="mt-2 text-2xl font-semibold text-neutral-50 sm:text-3xl">
        {priority.subjectLabel} — {priority.fragileCompetency}
      </p>
      <p className="mt-3 text-sm text-neutral-300">
        Prochaine action : {priority.nextActionLabel} ({priority.nextActionMinutes} min)
      </p>
      {priority.nextSession && (
        <p className="mt-1 text-xs text-neutral-500">
          Reprise avec {priority.nextSession.teacherFirstName} — {priority.nextSession.dayLabel}{' '}
          {priority.nextSession.timeLabel}
        </p>
      )}
      {activeResourceTitle && (
        <p className="mt-1 text-xs text-neutral-500">Ressource active : {activeResourceTitle}</p>
      )}
    </section>
  );
}
