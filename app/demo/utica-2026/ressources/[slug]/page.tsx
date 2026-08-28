/**
 * Vue de détail d'une ressource UTICA (P3 §10). Résolution stricte par
 * allowlist via getResourceBySlug — jamais de lecture arbitraire de fichier
 * depuis un paramètre d'URL (pas de fs.readFile(pathFromUserInput)).
 * Slug inconnu → notFound().
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getResourceBySlug } from '@/lib/demo/utica-2026/resources';
import { ResourceDetailView } from '@/components/demo/utica-2026/ResourceDetailView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ressource | Nexus Réussite',
  robots: { index: false, follow: false, nocache: true },
};

export default async function UticaResourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const resource = getResourceBySlug(slug);

  if (!resource) {
    notFound();
  }

  return <ResourceDetailView resource={resource} />;
}
