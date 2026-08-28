/**
 * Cockpit ARIA enrichi et contextualisé (P3 §14-§16). Reçoit une
 * `CatalogResource` déjà résolue par allowlist (jamais un id arbitraire).
 * Reste 100 % local et scénarisé : aucun appel réseau, aucun moteur de
 * recommandation réel (P3 §17 : UTICA_ARIA_EXTERNAL_CALLS=0).
 */
import Link from 'next/link';
import { ArrowRight, BookOpen, ExternalLink, MessageCircle, Sparkles } from 'lucide-react';
import type { CatalogResource } from '@/lib/demo/utica-2026/resources';
import { QcmInteractive } from './QcmInteractive';
import { ChecklistInteractive } from './ChecklistInteractive';
import { GuidedExerciseInteractive } from './GuidedExerciseInteractive';

const DIALOGUE: Record<string, { student: string; aria: string[] }> = {
  MATHEMATIQUES: {
    student: 'Je sais calculer f\' mais je bloque ensuite.',
    aria: [
      'On va d\'abord relier le signe de f\' au sens de variation de f.',
      'Une fois ce réflexe posé, on l\'applique sur un exemple guidé.',
    ],
  },
  NSI: {
    student: 'Je confonds l\'ordre de sortie d\'une pile et d\'une file.',
    aria: ['On reprend d\'abord la différence LIFO / FIFO avec un exemple concret.', 'Ensuite, une fiche courte pour fixer le repère.'],
  },
};

function sourcesDeTravail(resource: CatalogResource): string[] {
  const items: string[] = [];
  if (resource.sections?.length) items.push(`Chapitre — ${resource.title}`);
  if (resource.exercise) items.push('Exercice guidé');
  if (resource.qcm) items.push('QCM ciblé');
  if (resource.checklist) items.push('Checklist Bac');
  return items;
}

export function AriaResourceCockpit({
  resource,
  alternatives,
}: {
  resource: CatalogResource;
  /** Autres parcours proposés dans cet exemple (P3 §15), changement local uniquement. */
  alternatives: CatalogResource[];
}) {
  const dialogue = DIALOGUE[resource.subject];
  const sources = sourcesDeTravail(resource);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-brand-primary/25 bg-brand-primary/10 p-5">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-accent">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          Ressource active
        </p>
        <p className="mt-1 text-base font-medium text-neutral-50">{resource.title}</p>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-neutral-400">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-accent" aria-hidden="true" />
          <span>
            <span className="font-semibold text-brand-accent">Pourquoi cette ressource ? </span>
            {resource.preview}
          </span>
        </p>

        {sources.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Sources de travail</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {sources.map((s) => (
                <li key={s} className="rounded-full border border-white/10 bg-surface-darker/50 px-2.5 py-0.5 text-[11px] text-neutral-400">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link
          href={`/demo/utica-2026/ressources/${resource.slug}`}
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-accent hover:text-brand-accent/80"
        >
          Ouvrir la ressource complète
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      {dialogue && (
        <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
          <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            Aperçu — parcours proposé dans cet exemple
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <p className="rounded-lg bg-surface-darker/50 px-3 py-2 text-neutral-300">
              <span className="font-semibold text-neutral-100">Élève — </span>
              {dialogue.student}
            </p>
            {dialogue.aria.map((line, i) => (
              <p key={i} className="rounded-lg border border-brand-primary/20 bg-brand-primary/5 px-3 py-2 text-neutral-300">
                <span className="font-semibold text-brand-accent">ARIA — </span>
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {resource.exercise && (
        <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Activité courante — mini-exercice</h2>
          <div className="mt-3">
            <GuidedExerciseInteractive exercise={resource.exercise} />
          </div>
        </div>
      )}
      {resource.qcm && (
        <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Activité courante — QCM</h2>
          <div className="mt-3">
            <QcmInteractive questions={resource.qcm} />
          </div>
        </div>
      )}
      {resource.checklist && !resource.exercise && !resource.qcm && (
        <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Activité courante — checklist</h2>
          <div className="mt-3">
            <ChecklistInteractive items={resource.checklist} />
          </div>
        </div>
      )}

      {alternatives.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Autres parcours proposés dans cet exemple</h2>
          <ul className="mt-3 space-y-1.5">
            {alternatives.map((alt) => (
              <li key={alt.id}>
                <Link
                  href={`/demo/utica-2026/aria?resource=${encodeURIComponent(alt.id)}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-neutral-300 transition-colors hover:bg-white/5"
                >
                  <span>{alt.title}</span>
                  {alt.type === 'EXTERNAL_PLATFORM' ? (
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
