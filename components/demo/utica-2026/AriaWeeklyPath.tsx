/**
 * Parcours ARIA de la semaine (brief §26) — illustre la complémentarité
 * IA + autonomie + enseignant humain. Contenu de démonstration ; le jour
 * "Samedi" référence la vraie prochaine séance enseignant du scénario pour
 * garder la cohérence avec le planning (pas une date inventée séparément).
 */
import type { PedagogicalFocus } from '@/lib/demo/utica-2026/types';

interface AriaWeeklyPathProps {
  focus: PedagogicalFocus;
  teacherFirstName: string;
}

export function AriaWeeklyPath({ focus, teacherFirstName }: AriaWeeklyPathProps) {
  const days = [
    { day: 'Lundi', label: 'Diagnostic', detail: `Point sur ${focus.subjectLabel.toLowerCase()} — fonctions.` },
    { day: 'Mardi', label: 'Cours ciblé', detail: focus.fragileCompetency },
    { day: 'Mercredi', label: 'Exercices guidés', detail: focus.recommendedActivityLabel },
    { day: 'Jeudi', label: 'Entraînement autonome', detail: 'Consolidation par la pratique.' },
    { day: 'Vendredi', label: 'Mini-évaluation', detail: 'Vérification de la progression.' },
    { day: 'Samedi', label: 'Retour enseignant Nexus', detail: `Séance avec ${teacherFirstName}.` },
  ];

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Ton parcours de la semaine</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {days.map((d) => (
          <div key={d.day} className="rounded-xl border border-white/5 bg-surface-darker/40 p-3">
            <p className="text-[11px] font-semibold text-brand-accent">{d.day}</p>
            <p className="mt-0.5 text-sm text-neutral-200">{d.label}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{d.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
