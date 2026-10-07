import type { EspaceWorkStatus } from '@prisma/client';

import { statusLabelForStudent, statusLabelForTeacher } from '@/lib/espace/work-state';

type Status = EspaceWorkStatus | 'NOT_STARTED';

const TONE: Record<Status, string> = {
  NOT_STARTED: 'border-white/15 text-neutral-300',
  DRAFT: 'border-white/15 text-neutral-300',
  IN_PROGRESS: 'border-sky-400/40 text-sky-200',
  SUBMITTED: 'border-amber-400/50 text-amber-200',
  CORRECTED: 'border-emerald-400/40 text-emerald-200',
  REOPENED: 'border-orange-400/50 text-orange-200',
  DONE: 'border-emerald-400/40 text-emerald-200',
};

/** Le libellé porte le sens ; la couleur n'est qu'un renfort. */
export function StatusBadge({ status, audience }: { status: Status; audience: 'student' | 'teacher' }) {
  const label = status === 'NOT_STARTED' ? 'Pas commencé' : audience === 'student' ? statusLabelForStudent(status) : statusLabelForTeacher(status);
  return (
    <span data-testid="status-badge" data-status={status} className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONE[status]}`}>
      {label}
    </span>
  );
}
