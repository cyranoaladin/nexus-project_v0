const STEPS = [
  'Créer ou sélectionner le foyer',
  'Ajouter ou sélectionner l’enfant',
  'Choisir la matière',
  'Saisir les réponses',
  'Valider',
] as const;

export function PaperEntryWorkflowSteps({ currentStep }: Readonly<{ currentStep: 1 | 2 | 3 | 4 | 5 }>) {
  return (
    <nav className="mt-8" aria-label="Étapes de la saisie papier">
      <ol
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
        aria-label="Progression de la saisie papier"
      >
        {STEPS.map((label, index) => {
          const number = (index + 1) as 1 | 2 | 3 | 4 | 5;
          const current = number === currentStep;
          const complete = number < currentStep;
          return (
            <li
              key={label}
              aria-current={current ? 'step' : undefined}
              className={`rounded-xl border px-3 py-3 text-sm ${
                current
                  ? 'border-amber-300 bg-amber-300/15 text-amber-100'
                  : complete
                    ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
                    : 'border-white/10 bg-white/[0.04] text-slate-400'
              }`}
            >
              <span className="mr-2 font-mono text-xs" aria-hidden="true">{number}</span>
              <span className="font-semibold">{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
