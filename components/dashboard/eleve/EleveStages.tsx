'use client';

import { ExternalLink, GraduationCap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EleveStageItem, EleveStageReservationStatus } from './types';

type EleveStagesProps = {
  upcomingStages: EleveStageItem[];
  pastStages: EleveStageItem[];
};

const STATUS_BADGE: Record<EleveStageReservationStatus, { label: string; className: string }> = {
  PENDING:    { label: 'En attente',  className: 'bg-amber-500/15 text-amber-300 border-amber-500/20' },
  CONFIRMED:  { label: 'Confirmé',    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20' },
  WAITLISTED: { label: 'Liste d\'attente', className: 'bg-blue-500/15 text-blue-300 border-blue-500/20' },
  CANCELLED:  { label: 'Annulé',      className: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/20' },
  COMPLETED:  { label: 'Terminé',     className: 'bg-brand-accent/15 text-brand-accent border-brand-accent/20' },
};

function StageCard({ stage }: { stage: EleveStageItem }) {
  const badge = STATUS_BADGE[stage.reservationStatus];
  const start = new Date(stage.startDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const end   = new Date(stage.endDate).toLocaleDateString('fr-FR',   { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-neutral-100">{stage.title}</p>
          <p className="text-xs text-neutral-500">
            {start} – {end}
            {stage.location ? ` · ${stage.location}` : ''}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>
      {stage.hasBilan && stage.bilanUrl && (
        <a
          href={stage.bilanUrl}
          className="inline-flex items-center gap-1 text-xs text-brand-accent hover:underline"
          aria-label={`Voir le bilan du stage ${stage.title}`}
        >
          Voir le bilan de stage
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      )}
    </article>
  );
}

export function EleveStages({ upcomingStages, pastStages }: EleveStagesProps) {
  const hasAny = upcomingStages.length > 0 || pastStages.length > 0;

  return (
    <section id="stages" aria-labelledby="eleve-stages-title">
      <Card className="border-white/10 bg-surface-card">
        <CardHeader>
          <CardTitle id="eleve-stages-title" className="flex items-center gap-2 text-white">
            <GraduationCap className="h-5 w-5 text-brand-accent" aria-hidden="true" />
            Stages intensifs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasAny ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <GraduationCap className="h-10 w-10 text-neutral-500" aria-hidden="true" />
              <p className="text-sm text-neutral-400">Aucun stage réservé pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingStages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    À venir
                  </p>
                  {upcomingStages.map((s) => (
                    <StageCard key={s.reservationId} stage={s} />
                  ))}
                </div>
              )}
              {pastStages.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    Passés
                  </p>
                  {pastStages.map((s) => (
                    <StageCard key={s.reservationId} stage={s} />
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
