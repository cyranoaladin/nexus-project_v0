/**
 * Mini-hub bibliothèque (P3 §9) — évolution de la simple liste "Mes
 * ressources" existante (StudentResourcesCard, inchangée) vers une vraie
 * bibliothèque catégorisée. 8 à 12 cartes maximum visibles d'un coup
 * (P3 §9) : le catalogue complet (9 entrées) tient sans "Voir toutes".
 */
import Link from 'next/link';
import { BookOpen, CheckSquare, Clock, ExternalLink, FileText, HelpCircle, Sparkles } from 'lucide-react';
import type { CatalogResource } from '@/lib/demo/utica-2026/resources';

const TYPE_META: Record<CatalogResource['type'], { label: string; icon: typeof FileText }> = {
  COURSE: { label: 'Cours', icon: BookOpen },
  METHOD: { label: 'Méthode', icon: FileText },
  EXERCISE: { label: 'Exercice', icon: FileText },
  QCM: { label: 'QCM', icon: HelpCircle },
  CHECKLIST: { label: 'Checklist', icon: CheckSquare },
  INTERACTIVE: { label: 'Interactif', icon: Sparkles },
  EXTERNAL_PLATFORM: { label: 'Plateforme', icon: ExternalLink },
};

const SUBJECT_LABEL: Record<CatalogResource['subject'], string> = {
  MATHEMATIQUES: 'Mathématiques',
  NSI: 'NSI',
  FRANCAIS: 'Français / EAF',
  METHODE: 'Méthode Bac',
};

const CATEGORY_ORDER: CatalogResource['subject'][] = ['MATHEMATIQUES', 'NSI', 'FRANCAIS', 'METHODE'];

function ResourceCard({ resource }: { resource: CatalogResource }) {
  const meta = TYPE_META[resource.type];
  const Icon = meta.icon;
  const isExternal = resource.type === 'EXTERNAL_PLATFORM';
  const href = isExternal ? `/demo/utica-2026/ressources/${resource.slug}` : `/demo/utica-2026/ressources/${resource.slug}`;

  return (
    <Link
      href={href}
      className="group flex flex-col rounded-xl border border-white/10 bg-surface-darker/40 p-4 transition-colors hover:border-brand-primary/30 hover:bg-white/5"
    >
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {meta.label}
        {resource.durationMinutes && (
          <span className="ml-auto inline-flex items-center gap-1 text-neutral-600">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {resource.durationMinutes} min
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-medium text-neutral-100 group-hover:text-white">{resource.title}</p>
      <p className="mt-1 text-xs text-neutral-500">{resource.description}</p>
    </Link>
  );
}

export function ResourceLibrarySection({ catalog }: { catalog: CatalogResource[] }) {
  const byCategory = CATEGORY_ORDER.map((subject) => ({
    subject,
    items: catalog.filter((r) => r.subject === subject),
  })).filter((c) => c.items.length > 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Bibliothèque</h2>
      <div className="mt-4 space-y-5">
        {byCategory.map(({ subject, items }) => (
          <div key={subject}>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{SUBJECT_LABEL[subject]}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
