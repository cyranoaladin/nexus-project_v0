/**
 * Bandeau supérieur Parent/Élève (brief §4.1) : identité, statut, session,
 * parcours, spécialités, statut global — rassurant, pas anxiogène.
 * Composant pur, alimenté par le DemoStudentProfile du scénario.
 */
import { GraduationCap } from 'lucide-react';
import { SUBJECT_LABELS } from '@/lib/demo/utica-2026/selectors';
import type { DemoStudentProfile } from '@/lib/demo/utica-2026/types';

export function StatusBanner({
  student,
  centralLine,
  subtitle,
}: {
  student: DemoStudentProfile;
  centralLine: string;
  /** Optionnel — phrase secondaire sous la phrase centrale (utilisé par la Vue 360°). */
  subtitle?: string;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-surface-card to-surface-card/60 p-5 shadow-md sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-primary/15 text-brand-accent">
            <GraduationCap className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-neutral-50 sm:text-2xl">
              {student.firstName} {student.lastNameInitial}
            </h1>
            <p className="mt-0.5 text-sm text-neutral-400">
              {student.status} · Session {student.examSession} · {student.level}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              Spécialités : {student.specialites.map((s) => SUBJECT_LABELS[s]).join(', ')} · Langues :{' '}
              {SUBJECT_LABELS[student.langueA]} / {SUBJECT_LABELS[student.langueB]}
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {student.globalStatusLabel}
        </span>
      </div>

      <p className="mt-4 text-sm font-medium text-neutral-200">{centralLine}</p>
      {subtitle && <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>}
    </section>
  );
}
