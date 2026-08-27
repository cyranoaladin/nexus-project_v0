/**
 * "Mon équipe Nexus" (brief §12 / §21). Profils fictifs, prochaine séance
 * dérivée des mêmes séances que le planning — pas de duplication.
 */
import { Users } from 'lucide-react';
import type { TeacherView } from '@/lib/demo/utica-2026/selectors';

export function TeacherTeamCard({ teachers }: { teachers: TeacherView[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        <Users className="h-4 w-4" aria-hidden="true" />
        Mon équipe Nexus
      </h2>
      <ul className="mt-3 space-y-3">
        {teachers.map((teacher) => (
          <li key={teacher.id} className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-primary/15 text-xs font-semibold text-brand-accent">
              {teacher.firstName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-neutral-200">
                {teacher.firstName} <span className="text-neutral-500">— {teacher.subjectLabel}</span>
              </p>
              <p className="truncate text-[11px] text-neutral-600">{teacher.role}</p>
            </div>
            {teacher.nextSession && (
              <span className="shrink-0 whitespace-nowrap text-[11px] text-neutral-500">
                {teacher.nextSession.dayLabel} · {teacher.nextSession.timeLabel}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
