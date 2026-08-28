/**
 * "Ma maîtrise" (P1C §1) — 4 à 7 compétences représentatives, jamais un
 * tableur. Le statut n'est jamais encodé uniquement par la couleur (pastille
 * + libellé textuel systématiques). Réutilisé tel quel par Parent et Élève
 * (mêmes props, densité différente selon le contexte d'appel).
 */
import type { CompetencyLevel } from '@/lib/demo/utica-2026/types';
import type { CompetencyView } from '@/lib/demo/utica-2026/selectors';

const LEVEL_DOT: Record<CompetencyLevel, string> = {
  Maîtrisé: 'bg-emerald-400',
  'À consolider': 'bg-amber-400',
  Fragile: 'bg-orange-400',
  'Très fragile': 'bg-red-400',
  'Non encore vu': 'bg-neutral-600',
};

export function MasteryCard({
  subjectLabel,
  nextStep,
  competencies,
}: {
  subjectLabel: string;
  nextStep: string;
  competencies: CompetencyView[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Ma maîtrise — {subjectLabel}</h2>
      <p className="mt-0.5 text-xs text-neutral-500">Prochaine étape : {nextStep}</p>

      <ul className="mt-4 space-y-3">
        {competencies.map((c) => (
          <li key={c.id} className="rounded-lg border border-white/5 bg-surface-darker/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-neutral-200">{c.label}</span>
              <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-neutral-400">
                <span className={`h-1.5 w-1.5 rounded-full ${LEVEL_DOT[c.level]}`} aria-hidden="true" />
                {c.levelLabel}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-neutral-600">
              {c.lastEvidence
                ? `Dernière preuve : ${c.lastEvidence.dateLabel} — ${c.lastEvidence.label} (${c.lastEvidence.resultLabel})`
                : 'Aucune preuve enregistrée pour le moment.'}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
