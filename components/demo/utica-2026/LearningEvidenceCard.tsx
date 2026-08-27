/**
 * "Mes preuves de progression" / "Preuves d'apprentissage" (P1C §2). Une
 * compétence ne doit jamais apparaître fragile ou maîtrisée sans que le
 * visiteur comprenne d'où vient l'information. 3-4 preuves suffisent.
 */
import { CheckCircle2, ClipboardList, Eye, FileEdit, PenLine, Sparkles } from 'lucide-react';
import type { DemoLearningEvidence, LearningEvidenceKind } from '@/lib/demo/utica-2026/types';

const KIND_META: Record<LearningEvidenceKind, { label: string; icon: typeof ClipboardList }> = {
  QCM: { label: 'QCM', icon: CheckCircle2 },
  EXERCICE_GUIDE: { label: 'Exercice guidé', icon: PenLine },
  DEVOIR: { label: 'Devoir', icon: FileEdit },
  MINI_EVALUATION: { label: 'Mini-évaluation', icon: ClipboardList },
  OBSERVATION_ENSEIGNANT: { label: 'Observation enseignant', icon: Eye },
  ACTIVITE_ARIA: { label: 'Activité ARIA', icon: Sparkles },
};

export function LearningEvidenceCard({ title, evidence }: { title: string; evidence: DemoLearningEvidence[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">{title}</h2>
      <ul className="mt-3 space-y-3">
        {evidence.map((e) => {
          const meta = KIND_META[e.kind];
          const Icon = meta.icon;
          return (
            <li key={e.id} className="flex items-start gap-2.5">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[11px] text-neutral-500">
                  {e.dateLabel} · {meta.label}
                </p>
                <p className="text-sm text-neutral-200">
                  {e.label} <span className="text-neutral-500">— {e.resultLabel}</span>
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">{e.consequenceLabel}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
