/**
 * Vue de détail d'une ressource UTICA (P3 §10). Server component pur —
 * reçoit une `CatalogResource` déjà résolue via allowlist stricte
 * (getResourceBySlug), jamais un chemin de fichier depuis l'URL.
 */
import Link from 'next/link';
import { ArrowUpRight, Clock, ExternalLink, Sparkles } from 'lucide-react';
import type { CatalogResource } from '@/lib/demo/utica-2026/resources';
import { QcmInteractive } from './QcmInteractive';
import { ChecklistInteractive } from './ChecklistInteractive';
import { GuidedExerciseInteractive } from './GuidedExerciseInteractive';

const SUBJECT_LABEL: Record<CatalogResource['subject'], string> = {
  MATHEMATIQUES: 'Mathématiques',
  NSI: 'NSI',
  FRANCAIS: 'Français',
  METHODE: 'Méthode',
};

const TYPE_LABEL: Record<CatalogResource['type'], string> = {
  COURSE: 'Cours',
  METHOD: 'Méthode',
  EXERCISE: 'Exercice',
  QCM: 'QCM',
  CHECKLIST: 'Checklist',
  INTERACTIVE: 'Interactif',
  EXTERNAL_PLATFORM: 'Plateforme',
};

export function ResourceDetailView({ resource }: { resource: CatalogResource }) {
  const isExternal = resource.type === 'EXTERNAL_PLATFORM';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/demo/utica-2026/eleve" className="text-xs text-neutral-500 hover:text-neutral-300">
        ← Retour à mes ressources
      </Link>

      <div className="rounded-2xl border border-white/10 bg-surface-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
            {SUBJECT_LABEL[resource.subject]}
          </span>
          <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
            {TYPE_LABEL[resource.type]}
          </span>
          {resource.durationMinutes && (
            <span className="inline-flex items-center gap-1 text-[11px] text-neutral-500">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {resource.durationMinutes} min
            </span>
          )}
        </div>

        <h1 className="mt-3 text-2xl font-semibold text-neutral-50">{resource.title}</h1>
        <p className="mt-2 text-sm text-neutral-400">{resource.description}</p>

        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-brand-primary/20 bg-brand-primary/5 p-3 text-xs text-neutral-300">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-accent" aria-hidden="true" />
          <span>
            <span className="font-semibold text-brand-accent">Pourquoi cette ressource ? </span>
            {resource.preview}
          </span>
        </p>

        {resource.focusId && (
          <div className="mt-4">
            <Link
              href={`/demo/utica-2026/aria?resource=${encodeURIComponent(resource.id)}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-neutral-300 transition-colors hover:bg-white/5"
            >
              Travailler avec ARIA
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>

      {resource.sections?.map((section) => (
        <details key={section.heading} className="group rounded-2xl border border-white/10 bg-surface-card p-5" open>
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-neutral-400">
            {section.heading}
          </summary>
          <div className="mt-3 space-y-1.5">
            {section.paragraphs.map((p, i) => (
              <p key={i} className="text-sm text-neutral-300">
                {p}
              </p>
            ))}
          </div>
        </details>
      ))}

      {resource.exercise && (
        <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Mini-exercice guidé</h2>
          <div className="mt-3">
            <GuidedExerciseInteractive exercise={resource.exercise} />
          </div>
        </div>
      )}

      {resource.qcm && (
        <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">QCM</h2>
          <div className="mt-3">
            <QcmInteractive questions={resource.qcm} />
          </div>
        </div>
      )}

      {resource.checklist && (
        <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Checklist</h2>
          <div className="mt-3">
            <ChecklistInteractive items={resource.checklist} />
          </div>
        </div>
      )}

      {isExternal && resource.externalUrl && (
        <div className="rounded-2xl border border-brand-primary/25 bg-brand-primary/10 p-5">
          <a
            href={resource.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-primary/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-primary"
          >
            {resource.cta}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          <p className="mt-2 text-[11px] text-neutral-500">
            Ouvre une plateforme Nexus Réussite séparée, dans un nouvel onglet.
          </p>
        </div>
      )}

      <p className="text-[11px] text-neutral-600">Source : {resource.sourceLabel}</p>
    </div>
  );
}
