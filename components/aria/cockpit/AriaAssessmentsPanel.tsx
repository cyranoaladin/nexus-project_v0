'use client';

/**
 * Panneau Évaluations & bilans.
 *
 * Uniquement des bilans RÉELS. Aucun score inventé, aucun test adaptatif
 * simulé, aucune évaluation « à venir » fabriquée.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AriaAssessmentDTO, AriaCockpitDTO } from '@/lib/aria/contracts';
import { EmptyState } from './EmptyState';

const STATE_LABELS: Record<AriaAssessmentDTO['state'], string> = {
  A_FAIRE: 'À faire',
  RECENT: 'Récent',
  TERMINE: 'Terminé',
};

const STATE_TONE: Record<AriaAssessmentDTO['state'], string> = {
  A_FAIRE: 'bg-amber-500/10 text-amber-200',
  RECENT: 'bg-emerald-500/10 text-emerald-200',
  TERMINE: 'bg-white/5 text-neutral-300',
};

const ORDER: AriaAssessmentDTO['state'][] = ['A_FAIRE', 'RECENT', 'TERMINE'];

export function AriaAssessmentsPanel({ cockpit }: { cockpit: AriaCockpitDTO }) {
  const grouped = new Map<AriaAssessmentDTO['state'], AriaAssessmentDTO[]>();
  for (const assessment of cockpit.assessments) {
    const bucket = grouped.get(assessment.state) ?? [];
    bucket.push(assessment);
    grouped.set(assessment.state, bucket);
  }

  const sections = ORDER.filter((state) => (grouped.get(state)?.length ?? 0) > 0);

  return (
    <section id="aria-assessments" aria-labelledby="aria-assessments-title" className="space-y-4">
      <div>
        <h2 id="aria-assessments-title" className="text-lg font-semibold text-neutral-100">
          Évaluations &amp; bilans
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          Tes bilans Nexus réellement enregistrés.
        </p>
      </div>

      {sections.length === 0 ? (
        <EmptyState
          title="Aucun bilan pour l’instant"
          body="Tes bilans apparaîtront ici dès qu’un diagnostic ou un stage aura été analysé."
        />
      ) : (
        sections.map((state) => (
          <Card key={state} className="border-white/10 bg-surface-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-neutral-200">
                <span className={`rounded-micro px-2 py-0.5 text-[11px] ${STATE_TONE[state]}`}>
                  {STATE_LABELS[state]}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(grouped.get(state) ?? []).map((assessment) => (
                  <li key={assessment.id}>
                    <a
                      href={assessment.href ?? '#'}
                      className="flex flex-col gap-1 rounded-lg border border-white/10 bg-white/5 p-3 transition-colors hover:border-brand-accent/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-sm text-neutral-100">{assessment.title}</span>
                      <span className="text-xs text-neutral-500">
                        {assessment.date
                          ? new Date(assessment.date).toLocaleDateString('fr-FR')
                          : 'Date inconnue'}
                        {assessment.globalScore !== null
                          ? ` · score ${assessment.globalScore}/100`
                          : ''}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}
    </section>
  );
}
