'use client';

/**
 * Panneau Ressources.
 *
 * Les ressources proviennent EXCLUSIVEMENT du Hub élève. Aucun second
 * catalogue de documents n'est créé. La catégorie `RAG_REFERENCE` reste vide
 * tant que les sources consultées par ARIA ne sont pas persistées.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AriaCockpitDTO } from '@/lib/aria/contracts';
import { EmptyState } from './EmptyState';

const CATEGORY_LABELS: Record<string, string> = {
  INTERACTIVE_PROGRAM: 'Programmes interactifs',
  OFFICIAL_PROGRAM: 'Programmes officiels',
  OFFICIAL_AUTOMATISMES: 'Automatismes officiels',
  OFFICIAL_SUJET: 'Sujets officiels',
  COACH_RESOURCE: 'Ressources de ton coach',
  USER_DOCUMENT: 'Tes documents',
  STAGE_BILAN: 'Bilans de stage',
  RAG_REFERENCE: 'Sources consultées par ARIA',
};

const CATEGORY_ORDER = [
  'INTERACTIVE_PROGRAM',
  'OFFICIAL_PROGRAM',
  'OFFICIAL_AUTOMATISMES',
  'OFFICIAL_SUJET',
  'COACH_RESOURCE',
  'STAGE_BILAN',
  'USER_DOCUMENT',
];

export function AriaResourcesPanel({ cockpit }: { cockpit: AriaCockpitDTO }) {
  const grouped = new Map<string, AriaCockpitDTO['resources'][number][]>();
  for (const resource of cockpit.resources) {
    const bucket = grouped.get(resource.category) ?? [];
    bucket.push(resource);
    grouped.set(resource.category, bucket);
  }

  const categories = CATEGORY_ORDER.filter((category) => (grouped.get(category)?.length ?? 0) > 0);

  return (
    <section id="aria-resources" aria-labelledby="aria-resources-title" className="space-y-4">
      <div>
        <h2 id="aria-resources-title" className="text-lg font-semibold text-neutral-100">
          Ressources
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          Tout ce qui t’est réellement accessible, rassemblé depuis ton espace Nexus.
        </p>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          title="Aucune ressource disponible"
          body="Les ressources apparaîtront ici dès que ton coach en déposera ou que tu accéderas à un programme interactif."
        />
      ) : (
        categories.map((category) => (
          <Card key={category} className="border-white/10 bg-surface-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-neutral-200">
                {CATEGORY_LABELS[category] ?? category}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {(grouped.get(category) ?? []).map((resource) => (
                  <li key={resource.id}>
                    <a
                      href={resource.href ?? '#'}
                      className="block rounded-lg border border-white/10 bg-white/5 p-3 transition-colors hover:border-brand-accent/40"
                    >
                      <span className="block text-sm text-neutral-100">{resource.title}</span>
                      {resource.subtitle && (
                        <span className="block text-xs text-neutral-500">{resource.subtitle}</span>
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}

      <p className="text-xs text-neutral-500">
        Les sources documentaires consultées par ARIA ne sont pas encore
        enregistrées&nbsp;: cette rubrique restera vide tant que ce ne sera pas le cas.
      </p>
    </section>
  );
}
