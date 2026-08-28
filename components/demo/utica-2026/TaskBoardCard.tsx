/**
 * "Mon plan de travail" (brief §16) — Élève. Groupes Aujourd'hui / Cette
 * semaine / Terminé, alimentés par getStudentTasks().
 */
import { Badge } from '@/components/ui/badge';
import { SUBJECT_LABELS } from '@/lib/demo/utica-2026/selectors';
import type { DemoTask, TaskPriority } from '@/lib/demo/utica-2026/types';

const TYPE_LABEL: Record<DemoTask['type'], string> = {
  DEVOIR: 'Devoir',
  FICHE: 'Fiche',
  EXERCICE: 'Exercice',
  QCM: 'QCM',
  REVISION: 'Révision',
};

const PRIORITY_VARIANT: Record<TaskPriority, 'destructive' | 'default' | 'outline'> = {
  HAUTE: 'destructive',
  MOYENNE: 'default',
  BASSE: 'outline',
};

function TaskRow({ task }: { task: DemoTask }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-surface-darker/40 p-3">
      <div className="min-w-0">
        <p className={`text-sm ${task.status === 'TERMINE' ? 'text-neutral-500 line-through' : 'text-neutral-200'}`}>
          {task.label}
        </p>
        <p className="mt-0.5 text-[11px] text-neutral-600">
          {SUBJECT_LABELS[task.subject]} · {TYPE_LABEL[task.type]} · {task.estimatedMinutes} min · {task.dueLabel}
        </p>
      </div>
      {task.status === 'A_FAIRE' && (
        <Badge variant={PRIORITY_VARIANT[task.priority]} className="shrink-0">
          {task.priority === 'HAUTE' ? 'Priorité' : task.priority === 'MOYENNE' ? 'À faire' : 'Optionnel'}
        </Badge>
      )}
    </li>
  );
}

export function TaskBoardCard({
  today,
  thisWeek,
  completed,
}: {
  today: DemoTask[];
  thisWeek: DemoTask[];
  completed: DemoTask[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Mon plan de travail</h2>

      {today.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-accent">Aujourd&apos;hui</p>
          <ul className="space-y-2">
            {today.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </div>
      )}

      {thisWeek.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Cette semaine</p>
          <ul className="space-y-2">
            {thisWeek.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </div>
      )}

      {completed.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">Terminé</p>
          <ul className="space-y-2">
            {completed.map((t) => (
              <TaskRow key={t.id} task={t} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
