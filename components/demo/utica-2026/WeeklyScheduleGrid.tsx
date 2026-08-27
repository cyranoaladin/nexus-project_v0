/**
 * Planning premium (P1B §3) — une seule primitive, réutilisée par Parent et
 * Élève avec un simple cadrage de titre différent (§3.4 : "ne duplique pas
 * le composant si une même primitive peut être utilisée avec une variante
 * contrôlée"). Source unique : getWeeklySchedule() (selectors.ts).
 */
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Sparkles,
} from 'lucide-react';
import { SUBJECT_LABELS } from '@/lib/demo/utica-2026/selectors';
import type { ScheduleEvent, ScheduleEventKind } from '@/lib/demo/utica-2026/selectors';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const KIND_META: Record<ScheduleEventKind, { label: string; className: string; icon: typeof Calendar }> = {
  COURS_NEXUS: { label: 'Cours Nexus', className: 'border-brand-primary/40 bg-brand-primary/15 text-brand-accent', icon: Calendar },
  TRAVAIL_PERSONNEL: { label: 'Travail personnel', className: 'border-neutral-600/50 bg-neutral-800/60 text-neutral-300', icon: BookOpen },
  ARIA: { label: 'ARIA', className: 'border-violet-500/40 bg-violet-500/15 text-violet-300', icon: Sparkles },
  DEVOIR: { label: 'Devoir', className: 'border-rose-500/40 bg-rose-500/15 text-rose-300', icon: ClipboardCheck },
  EVALUATION: { label: 'Évaluation', className: 'border-amber-500/40 bg-amber-500/15 text-amber-300', icon: CheckCircle2 },
};

function EventChip({ event }: { event: ScheduleEvent }) {
  const meta = KIND_META[event.kind];
  const Icon = meta.icon;
  return (
    <div className={`rounded-lg border px-2.5 py-2 text-left text-[11px] ${meta.className}`}>
      <div className="flex items-center gap-1.5 font-medium">
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{event.label}</span>
      </div>
      <p className="mt-0.5 text-[10px] opacity-75">
        {SUBJECT_LABELS[event.subject]}
        {event.timeLabel ? ` · ${event.timeLabel}` : ''}
      </p>
    </div>
  );
}

export function WeeklyScheduleGrid({
  events,
  heading,
  subheading,
}: {
  events: ScheduleEvent[];
  heading: string;
  subheading: string;
}) {
  const kindsPresent = [...new Set(events.map((e) => e.kind))];

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">{heading}</h2>
      <p className="mt-0.5 text-xs text-neutral-500">{subheading}</p>

      <div className="mt-3 flex flex-wrap gap-3">
        {kindsPresent.map((kind) => (
          <span key={kind} className="inline-flex items-center gap-1.5 text-[10px] text-neutral-500">
            <span className={`h-2 w-2 rounded-full border ${KIND_META[kind].className}`} aria-hidden="true" />
            {KIND_META[kind].label}
          </span>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {DAYS.map((day) => {
          const dayEvents = events.filter((e) => e.dayLabel === day);
          return (
            <div key={day} className="rounded-xl border border-white/5 bg-surface-darker/30 p-2">
              <p className="mb-2 text-center text-[11px] font-semibold text-neutral-400">{day}</p>
              <div className="space-y-1.5">
                {dayEvents.length === 0 ? (
                  <p className="px-1 text-center text-[10px] text-neutral-700">—</p>
                ) : (
                  dayEvents.map((event) => <EventChip key={event.id} event={event} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
