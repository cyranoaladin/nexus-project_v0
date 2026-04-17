import Link from 'next/link';
import { ArrowRight, CalendarDays, MapPin, Users, Video } from 'lucide-react';

import type { PublicStage } from '@/lib/stages/public';
import {
  formatStageDateRange,
  formatStagePrice,
  getLevelLabel,
  isOnlineLocation,
  subjectLabels,
} from '@/lib/stages/public';

export function PublicStageCard({ stage }: { stage: PublicStage }) {
  const online = isOnlineLocation(stage.location);
  const seatsLabel = stage.availablePlaces > 0
    ? `${stage.availablePlaces} place${stage.availablePlaces > 1 ? 's' : ''} disponible${stage.availablePlaces > 1 ? 's' : ''}`
    : "Complet — Liste d'attente";

  return (
    <article className="group rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all hover:border-brand-accent/40 hover:bg-white/[0.08]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex rounded-full border border-brand-accent/35 bg-brand-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
          {stage.typeLabel}
        </span>
        {stage.subject.slice(0, 3).map((subject) => (
          <span
            key={subject}
            className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-200"
          >
            {subjectLabels[subject]}
          </span>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <Link href={`/stages/${stage.slug}`} className="transition-colors hover:text-brand-accent">
            <h2 className="text-2xl font-semibold tracking-tight text-white">{stage.title}</h2>
          </Link>
          {stage.subtitle ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-300">{stage.subtitle}</p>
          ) : null}
        </div>

        <div className="grid gap-3 text-sm text-neutral-200 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-brand-accent" />
            <span>{formatStageDateRange(stage.startDate, stage.endDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            {online ? <Video className="h-4 w-4 text-brand-accent" /> : <MapPin className="h-4 w-4 text-brand-accent" />}
            <span>{stage.location || 'Centre Nexus Réussite'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-brand-accent" />
            <span>{seatsLabel}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stage.level.map((level) => (
              <span
                key={level}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-200"
              >
                {getLevelLabel(level)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Tarif</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {formatStagePrice(stage.priceAmount, stage.priceCurrency)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Link
            href={`/stages/${stage.slug}`}
            className="text-sm font-medium text-neutral-300 transition-colors hover:text-white"
          >
            Voir le détail
          </Link>
          {stage.isOpen ? (
            <Link
              href={`/stages/${stage.slug}/inscription`}
              className="inline-flex items-center gap-2 rounded-full bg-brand-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
            >
              S&apos;inscrire
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-neutral-500">
              Stage terminé
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
