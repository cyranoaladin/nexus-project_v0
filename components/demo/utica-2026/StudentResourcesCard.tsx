'use client';

/**
 * "Mes ressources" (P1B §6, enrichi P1C §4). La ressource recommandée
 * explique "Pourquoi ?" avec le même focus pédagogique que Parent/ARIA/360°
 * (amendement A3) — pas son propre texte statique. Le CTA "Aperçu" ouvre un
 * panneau local (§4.2) plutôt que d'être un bouton mort ou un faux
 * téléchargement.
 */
import { useState } from 'react';
import { BookOpen, CheckCircle2, Eye, FileText, Sparkles, Video } from 'lucide-react';
import { SUBJECT_LABELS } from '@/lib/demo/utica-2026/selectors';
import type { DemoResource, ResourceType } from '@/lib/demo/utica-2026/types';

const TYPE_META: Record<ResourceType, { label: string; icon: typeof FileText }> = {
  FICHE: { label: 'Fiche', icon: FileText },
  EXERCICE: { label: 'Exercice', icon: BookOpen },
  VIDEO: { label: 'Vidéo', icon: Video },
  QCM: { label: 'QCM', icon: CheckCircle2 },
};

export function StudentResourcesCard({
  resources,
  recommended,
  whyRecommended,
}: {
  resources: DemoResource[];
  recommended: DemoResource | null;
  /** Justification dérivée du focus pédagogique central — jamais un texte propre à la ressource. */
  whyRecommended: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Mes ressources</h2>

      {recommended && (
        <div className="mt-3 rounded-xl border border-brand-primary/25 bg-brand-primary/10 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-accent">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Recommandé pour toi
          </p>
          <p className="mt-1 text-sm text-neutral-100">{recommended.title}</p>
          <p className="mt-1 text-xs text-neutral-500">Pourquoi ? {whyRecommended}</p>

          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            aria-expanded={previewOpen}
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-accent hover:text-brand-accent/80"
          >
            <Eye className="h-3 w-3" aria-hidden="true" />
            {previewOpen ? "Masquer l'aperçu" : 'Aperçu'}
          </button>
          {previewOpen && (
            <p className="mt-2 rounded-lg border border-white/10 bg-surface-darker/60 p-2.5 text-xs text-neutral-400">
              {recommended.recommendedBecause ?? 'Contenu recommandé en lien avec ton objectif du moment.'}
            </p>
          )}
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {resources.map((resource) => {
          const meta = TYPE_META[resource.type];
          const Icon = meta.icon;
          return (
            <li key={resource.id} className="flex items-center gap-2.5 text-sm">
              <Icon className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
              <span className="text-neutral-200">{resource.title}</span>
              <span className="text-[11px] text-neutral-600">
                — {SUBJECT_LABELS[resource.subject]} · {meta.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
