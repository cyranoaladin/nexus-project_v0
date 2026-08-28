/**
 * Prochains événements (brief §11 / §15) — séances, devoirs, QCM fusionnés
 * et triés, une seule fois, dans getUpcomingEvents().
 */
import { Calendar, CheckCircle2, FileText } from 'lucide-react';
import { SUBJECT_LABELS } from '@/lib/demo/utica-2026/selectors';
import type { UpcomingEvent } from '@/lib/demo/utica-2026/selectors';

const KIND_ICON = { SEANCE: Calendar, DEVOIR: FileText, QCM: CheckCircle2 } as const;

export function UpcomingEventsList({ title, events }: { title: string; events: UpcomingEvent[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">{title}</h2>
      <ul className="mt-3 space-y-2.5">
        {events.map((event) => {
          const Icon = KIND_ICON[event.kind];
          return (
            <li key={event.id} className="flex items-start gap-2.5 text-sm">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-neutral-200">{event.label}</p>
                <p className="text-[11px] text-neutral-600">
                  {SUBJECT_LABELS[event.subject]} · {event.dayLabel}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
