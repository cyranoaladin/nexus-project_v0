import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import { AriaPreviewWorkspace } from '@/components/aria-preview/AriaPreviewWorkspace';
import { buildAriaPreviewData } from '@/lib/aria-preview/view-model';

export const metadata = {
  title: 'Aperçu ARIA (admin) | Nexus Réussite',
  description: 'Aperçu produit interne, non commercial, de la plateforme ARIA.',
};

/**
 * Aperçu produit ARIA — ADMIN uniquement.
 *
 * Présentation pure : aucune écriture DB, aucun appel modèle, aucun appel RAG.
 * Toutes les données viennent des autorités versionnées du dépôt
 * (`lib/curriculum/catalog`, `lib/aria/manifests/course-capabilities`,
 * `lib/aria/curriculum/skill-graph`). Voir `__tests__/architecture/aria-preview-no-runtime-imports.test.ts`.
 */
export default async function AriaAdminPreviewPage() {
  const sessionOrResponse = await requireAnyRole([UserRole.ADMIN]);
  if (isErrorResponse(sessionOrResponse)) {
    redirect('/dashboard');
  }

  const data = buildAriaPreviewData();

  return <AriaPreviewWorkspace data={data} />;
}
