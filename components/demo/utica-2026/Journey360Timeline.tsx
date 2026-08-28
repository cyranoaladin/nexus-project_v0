/**
 * Vue 360° — "Parcours vers le Bac" (§10). Composant dédié à la démo, PAS
 * une réutilisation de `components/dashboard/TrajectoireTimeline.tsx` :
 * ce dernier est présentationnel mais embarque des CTA en dur vers
 * `/dashboard/trajectoire` (surface authentifiée réelle) — les afficher dans
 * la démo publique redirigerait un visiteur vers l'écran de connexion réel.
 * Reprend le même langage visuel (pastille + trait vertical, statuts
 * Validé/En cours/À venir) sans modifier le composant de production
 * (amendement A4/§11 du gate P1A).
 *
 * Distingue explicitement (§10) :
 * - "Jalons Nexus" — étapes internes d'accompagnement (provenance ETAPE_NEXUS).
 * - "Repères officiels" — dérivés du référentiel réglementaire réel, jamais
 *   une date inventée (voir lib/demo/utica-2026/regulatory.ts).
 */
import { Check, Circle, ShieldCheck } from 'lucide-react';
import type { DemoJourneyMilestone, MilestoneStatus } from '@/lib/demo/utica-2026/types';
import type { RegulatoryMilestone } from '@/lib/demo/utica-2026/regulatory';

const TIMING_LABEL: Record<RegulatoryMilestone['timing'], string> = {
  fin_premiere: 'Fin de Première',
  fin_terminale: 'Fin de Terminale',
};

function MilestoneNode({ status }: { status: MilestoneStatus }) {
  if (status === 'DONE') {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/50 bg-emerald-500/20">
        <Check className="h-3 w-3 text-emerald-400" aria-hidden="true" />
      </div>
    );
  }
  if (status === 'CURRENT') {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-brand-primary bg-brand-primary/20 ring-2 ring-brand-primary/20">
        <Circle className="h-2.5 w-2.5 fill-brand-primary text-brand-primary" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-neutral-700 bg-neutral-800">
      <Circle className="h-2.5 w-2.5 text-neutral-600" aria-hidden="true" />
    </div>
  );
}

const STATUS_LABEL: Record<MilestoneStatus, string> = { DONE: 'Validé', CURRENT: 'En cours', UPCOMING: 'À venir' };

export function Journey360Timeline({
  milestones,
  regulatoryMilestones,
  sourceLabel,
  nextMilestoneLabel,
}: {
  milestones: DemoJourneyMilestone[];
  regulatoryMilestones: RegulatoryMilestone[];
  sourceLabel: string;
  /** P1B §5 — enrichissement léger : prochain jalon Nexus à venir. */
  nextMilestoneLabel?: string;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-surface-card p-5 lg:col-span-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Parcours vers le Bac — jalons Nexus
        </h2>
        {nextMilestoneLabel && (
          <p className="mt-0.5 text-xs text-neutral-500">Prochain jalon : {nextMilestoneLabel}</p>
        )}
        <div className="mt-4 flex flex-col gap-0 sm:flex-row sm:items-start sm:gap-2">
          {milestones.map((m, i) => (
            <div key={m.id} className="flex flex-1 sm:flex-col sm:items-center">
              <div className="flex items-center gap-3 sm:flex-col sm:gap-1.5">
                <MilestoneNode status={m.status} />
                {i < milestones.length - 1 && (
                  <div
                    className={`sm:h-px sm:w-full sm:flex-1 h-8 w-px ${
                      m.status === 'DONE' ? 'bg-emerald-500/30' : 'bg-neutral-800'
                    }`}
                  />
                )}
              </div>
              <div className="pb-3 pl-1 sm:pb-0 sm:pl-0 sm:pt-1.5 sm:text-center">
                <p
                  className={`text-xs font-medium ${
                    m.status === 'CURRENT' ? 'text-neutral-100' : m.status === 'DONE' ? 'text-neutral-500' : 'text-neutral-500'
                  }`}
                >
                  {m.label}
                </p>
                <p className="text-[10px] text-neutral-600">{STATUS_LABEL[m.status]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Repères officiels
        </h2>
        <ul className="mt-3 space-y-2.5">
          {regulatoryMilestones.map((m) => (
            <li key={m.timing} className="rounded-lg border border-white/5 bg-surface-darker/40 p-3">
              <p className="text-xs font-semibold text-brand-accent">{TIMING_LABEL[m.timing]}</p>
              <p className="mt-0.5 text-xs text-neutral-400">{m.label}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-neutral-600">Source : {sourceLabel}</p>
      </div>
    </div>
  );
}
