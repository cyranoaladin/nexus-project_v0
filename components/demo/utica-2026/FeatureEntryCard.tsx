/**
 * Entrées de la landing démo (brief §3 / §34) : "Je suis parent", "Je suis
 * élève", "Découvrir ARIA", "Vue 360°". Un CTA désactivé (Vue 360°, P1) est
 * annoncé proprement, jamais un bouton mort qui ne fait rien (brief §48).
 */
import Link from 'next/link';
import { ArrowRight, type LucideIcon } from 'lucide-react';

interface FeatureEntryCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href?: string;
  ctaLabel: string;
  disabledNote?: string;
  /** Traitement visuel distinct pour l'entrée présentée comme la synthèse (Vue 360°, §12). */
  highlight?: boolean;
}

export function FeatureEntryCard({ icon: Icon, title, description, href, ctaLabel, disabledNote, highlight }: FeatureEntryCardProps) {
  const content = (
    <>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-primary/15 text-brand-accent">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-neutral-50">{title}</h2>
      <p className="mt-1.5 text-sm text-neutral-400">{description}</p>
      <span
        className={`mt-4 inline-flex items-center gap-1.5 text-sm font-medium ${
          href ? 'text-brand-accent' : 'text-neutral-600'
        }`}
      >
        {ctaLabel}
        {href && <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
      </span>
      {disabledNote && <p className="mt-2 text-[11px] text-neutral-600">{disabledNote}</p>}
    </>
  );

  if (!href) {
    return (
      <div
        aria-disabled="true"
        className="rounded-2xl border border-white/5 bg-surface-card/40 p-6 opacity-70"
      >
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`group rounded-2xl border p-6 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl ${
        highlight
          ? 'border-brand-primary/40 bg-gradient-to-br from-brand-primary/10 to-surface-card hover:border-brand-primary/60'
          : 'border-white/10 bg-surface-card hover:border-brand-primary/30'
      }`}
    >
      {content}
    </Link>
  );
}
