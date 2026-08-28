'use client';

/**
 * Panneau Parcours (trajectoire).
 *
 * ARIA ne crée pas de second modèle de trajectoire : ce panneau affiche la
 * trajectoire stratégique existante (`lib/trajectory.ts`) et le contexte
 * d'examen issu du catalogue réglementaire, rien de plus.
 */

import { Flag, Milestone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AriaCockpitDTO } from '@/lib/aria/contracts';
import { EmptyState } from './EmptyState';

export function AriaTrajectoryPanel({ cockpit }: { cockpit: AriaCockpitDTO }) {
  const { trajectory, examContext } = cockpit;

  return (
    <section id="aria-trajectory" aria-labelledby="aria-trajectory-title" className="space-y-4">
      <h2 id="aria-trajectory-title" className="text-lg font-semibold text-neutral-100">
        Mon parcours
      </h2>

      <Card className="border-white/10 bg-surface-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-neutral-200">
            <Flag className="h-4 w-4 text-brand-accent" aria-hidden="true" />
            Trajectoire
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!trajectory ? (
            <EmptyState
              title="Aucune trajectoire active"
              body="Une trajectoire est définie avec ton coach lors d’un point d’étape."
            />
          ) : (
            <div className="space-y-3">
              <p className="font-medium text-neutral-100">{trajectory.title}</p>
              <div>
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>
                    {trajectory.completedMilestoneCount}/{trajectory.milestoneCount} jalons
                  </span>
                  <span>{trajectory.progress}%</span>
                </div>
                <div
                  className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-valuenow={trajectory.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Progression de la trajectoire"
                >
                  <div
                    className="h-full rounded-full bg-brand-accent"
                    style={{ width: `${Math.min(100, Math.max(0, trajectory.progress))}%` }}
                  />
                </div>
              </div>
              {trajectory.nextMilestone && (
                <p className="flex items-center gap-2 text-sm text-neutral-300">
                  <Milestone className="h-4 w-4 text-brand-accent" aria-hidden="true" />
                  Prochain jalon&nbsp;: {trajectory.nextMilestone.title}
                  {trajectory.nextMilestone.targetDate
                    ? ` (${new Date(trajectory.nextMilestone.targetDate).toLocaleDateString('fr-FR')})`
                    : ''}
                </p>
              )}
              {trajectory.daysRemaining !== null && (
                <p className="text-xs text-neutral-500">
                  {trajectory.daysRemaining} jours restants sur l’horizon défini.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {examContext && (
        <Card className="border-white/10 bg-surface-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-neutral-200">
              Session d’examen visée&nbsp;: {examContext.targetSession}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!examContext.supported ? (
              <p className="text-sm text-neutral-400">
                Le référentiel réglementaire de cette session n’est pas encore disponible.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {examContext.epreuves.map((epreuve) => (
                  <li
                    key={epreuve.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  >
                    <span className="text-neutral-200">{epreuve.label}</span>
                    <span className="text-xs text-neutral-500">
                      {epreuve.type}
                      {epreuve.coefficient !== null ? ` · coef. ${epreuve.coefficient}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
