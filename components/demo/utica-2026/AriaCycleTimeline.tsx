/**
 * Cycle ARIA (brief §23) : Diagnostiquer → Planifier → Apprendre →
 * S'entraîner → Vérifier → Ajuster. Illustration structurelle, aucune
 * capacité algorithmique réelle n'est invoquée ici (amendement A6).
 */
const STEPS = [
  { label: 'Diagnostiquer', detail: 'Identifier ce qui est acquis et ce qui reste fragile.' },
  { label: 'Planifier', detail: 'Choisir une activité ciblée sur le besoin identifié.' },
  { label: 'Apprendre', detail: 'Revoir la notion avec un support adapté.' },
  { label: "S'entraîner", detail: 'Pratiquer sur un exercice guidé.' },
  { label: 'Vérifier', detail: 'Mesurer la progression sur la compétence visée.' },
  { label: 'Ajuster', detail: 'Adapter la prochaine étape selon le résultat.' },
];

export function AriaCycleTimeline({ activeIndex = 1 }: { activeIndex?: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Le cycle ARIA — accompagnement de l&apos;autonomie
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STEPS.map((step, i) => {
          const isActive = i === activeIndex;
          return (
            <div
              key={step.label}
              className={`rounded-xl border p-3 text-left transition-colors ${
                isActive
                  ? 'border-brand-primary/40 bg-brand-primary/10'
                  : 'border-white/5 bg-surface-darker/40'
              }`}
            >
              <p
                className={`text-[10px] font-semibold uppercase tracking-wide ${
                  isActive ? 'text-brand-accent' : 'text-neutral-600'
                }`}
              >
                {i + 1}. {step.label}
              </p>
              <p className="mt-1 text-xs text-neutral-400">{step.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
