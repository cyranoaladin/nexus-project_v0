/**
 * "Ma progression" (P1C §3) — timeline qualitative, jamais une tendance ou
 * un score calculés. Montre l'évolution : preuves dans l'ordre
 * chronologique → activité ciblée → situation actuelle.
 */
import { ArrowDown } from 'lucide-react';
import type { AssessmentTrajectoryStep } from '@/lib/demo/utica-2026/selectors';

export function AssessmentTrajectoryCard({ steps }: { steps: AssessmentTrajectoryStep[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Ma progression</h2>
      <ol className="mt-3 space-y-1">
        {steps.map((step, i) => (
          <li key={step.label}>
            {i > 0 && <ArrowDown className="my-1 h-3 w-3 text-neutral-700" aria-hidden="true" />}
            <p className="text-xs font-medium text-brand-accent">{step.label}</p>
            <p className="text-sm text-neutral-300">{step.detail}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
