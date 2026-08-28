/**
 * "Ressource recommandée cette semaine" (P3 §25) — information sobre pour
 * le Parent, jamais une bibliothèque. Titre + matière + objectif, sans CTA
 * détaillé : le Parent reste un cockpit de pilotage.
 */
import { BookOpen } from 'lucide-react';
import type { CatalogResource } from '@/lib/demo/utica-2026/resources';

const SUBJECT_LABEL: Record<CatalogResource['subject'], string> = {
  MATHEMATIQUES: 'Mathématiques',
  NSI: 'NSI',
  FRANCAIS: 'Français',
  METHODE: 'Méthode',
};

export function RecommendedResourceNote({ resource }: { resource: CatalogResource }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border border-white/10 bg-surface-card px-4 py-3 text-xs text-neutral-400">
      <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-accent" aria-hidden="true" />
      <span>
        <span className="font-semibold text-neutral-300">Ressource recommandée cette semaine — </span>
        {resource.title}
        <span className="text-neutral-600"> · {SUBJECT_LABEL[resource.subject]} · {resource.preview}</span>
      </span>
    </p>
  );
}
