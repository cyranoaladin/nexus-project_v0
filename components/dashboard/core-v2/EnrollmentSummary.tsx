'use client';

import type { EnrollmentDetail, PlanningSeriesSummary } from './api';
import { displayName } from './api';

export const ENROLLMENT_LABEL: Record<EnrollmentDetail['status'], string> = {
  PENDING: 'En attente de validation',
  ACTIVE: 'Inscription active',
  COMPLETED: 'Année terminée',
  WITHDRAWN: 'Inscription retirée',
};

export const ACCOUNT_LABEL: Record<'PENDING_ACTIVATION' | 'ACTIVE' | 'SUSPENDED' | 'DISABLED', string> = {
  PENDING_ACTIVATION: 'à activer',
  ACTIVE: 'actif',
  SUSPENDED: 'suspendu',
  DISABLED: 'désactivé',
};

const WEEKDAY: Record<string, string> = { MO: 'lundi', TU: 'mardi', WE: 'mercredi', TH: 'jeudi', FR: 'vendredi', SA: 'samedi', SU: 'dimanche' };

export function describeRule(rule: string): string {
  const day = /BYDAY=([A-Z]{2})/.exec(rule)?.[1];
  return day ? `chaque ${WEEKDAY[day] ?? day}` : 'chaque semaine';
}

export function yearLabel(year: { startYear: number }): string {
  return `${year.startYear}-${year.startYear + 1}`;
}

/** Active weekly slots of an assignment, one line each. */
export function ActiveSeries({ series }: { series: PlanningSeriesSummary[] }) {
  return (
    <>
      {series
        .filter((s) => s.status === 'ACTIVE')
        .map((s) => (
          <span key={s.id} className="block text-xs text-neutral-400">
            {describeRule(s.recurrenceRule)} {s.localStartTime}–{s.localEndTime} ({s.timezone})
          </span>
        ))}
    </>
  );
}

/** Read-only view of one annual enrollment, as a family or the student sees it. */
export function EnrollmentSection({ enrollment }: { enrollment: EnrollmentDetail }) {
  const active = enrollment.assignments.filter((a) => a.status === 'ACTIVE');
  return (
    <section aria-label={`Année ${yearLabel(enrollment.academicYear)}`} className="rounded-md border border-white/10 p-3">
      <p className="font-medium text-neutral-100">
        {yearLabel(enrollment.academicYear)} · {ENROLLMENT_LABEL[enrollment.status]}
      </p>
      <p className="text-sm text-neutral-400">
        {enrollment.gradeLevel} · {enrollment.academicTrack}
        {enrollment.stmgPathway && ` · ${enrollment.stmgPathway}`}
      </p>
      <div className="mt-2 text-sm text-neutral-200">
        <span className="text-neutral-400">Cours : </span>
        {enrollment.courses.length === 0 ? 'aucun cours explicite' : enrollment.courses.map((c) => c.courseKey).join(', ')}
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {active.length === 0 && <li className="text-neutral-400">Aucun coach affecté pour l’instant.</li>}
        {active.map((a) => (
          <li key={a.id} className="text-neutral-100">
            {a.courseKey} — {displayName(a.coach.user)}
            <ActiveSeries series={a.planningSeries} />
          </li>
        ))}
      </ul>
    </section>
  );
}
