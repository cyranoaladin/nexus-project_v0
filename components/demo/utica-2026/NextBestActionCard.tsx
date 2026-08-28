'use client';

/**
 * "Ma prochaine meilleure action" (brief §51) — même donnée sous-jacente
 * (PedagogicalFocus), trois formulations selon l'audience. Le CTA ouvre un
 * détail local (aucune écriture, aucun appel réseau) plutôt que d'être une
 * action morte (brief §48). La transparence sur la nature du profil affiché
 * est centralisée dans le menu Options du chrome (hotfix branding salon
 * §8) — plus répétée sous chaque carte.
 */
import { useState } from 'react';
import { ArrowRight, Target } from 'lucide-react';
import type { FocusDescription } from '@/lib/demo/utica-2026/selectors';

interface NextBestActionCardProps {
  description: FocusDescription;
  ctaLabel: string;
  expandedDetail: string;
}

export function NextBestActionCard({
  description,
  ctaLabel,
  expandedDetail,
}: NextBestActionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-brand-primary/25 bg-brand-primary/10 p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-accent">
        <Target className="h-3.5 w-3.5" aria-hidden="true" />
        {description.title}
      </div>
      <p className="mt-2 text-base font-medium text-neutral-50">{description.text}</p>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-primary/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-primary"
      >
        {expanded ? 'Masquer le détail' : ctaLabel}
        <ArrowRight className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} aria-hidden="true" />
      </button>

      {expanded && (
        <p className="mt-3 rounded-lg border border-white/10 bg-surface-darker/60 p-3 text-sm text-neutral-300">
          {expandedDetail}
        </p>
      )}
    </div>
  );
}
