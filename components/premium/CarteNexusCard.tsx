'use client';

import Link from 'next/link';
import { Check, CreditCard } from 'lucide-react';
import { fmtTND } from './format';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import type { CarteNexus } from '@/lib/pricing';

interface CarteNexusCardProps {
  carte: CarteNexus;
  onCta?: () => void;
  ctaHref?: string;
  ctaText?: string;
}

export function CarteNexusCard({ carte, onCta, ctaHref, ctaText = 'Prendre la Carte Nexus' }: CarteNexusCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-lux-gold bg-gradient-to-br from-lux-ink to-lux-ink-700 p-6 text-lux-ivory lux-shadow-hover">
      {/* Filigrane */}
      <div
        className="pointer-events-none absolute right-4 top-4 select-none font-fraunces text-[100px] font-light leading-none opacity-[0.05]"
        aria-hidden="true"
      >
        N
      </div>

      <div className="flex items-center gap-3 mb-4">
        <CreditCard className="h-6 w-6 text-lux-gold" />
        <h3 className="font-fraunces text-xl font-medium text-lux-ivory">
          {carte.title}
        </h3>
      </div>

      <div className="mb-5">
        <span className="lux-price text-3xl text-lux-gold">
          {fmtTND(carte.price_annual)}
        </span>
        <span className="ml-2 text-sm text-lux-on-dark-muted">/&nbsp;an</span>
      </div>

      <ul className="mb-6 space-y-2.5">
        {carte.includes.map((benefit, i) => (
          <li key={i} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-lux-gold" />
            <span className="text-sm text-lux-on-dark-muted">{benefit}</span>
          </li>
        ))}
      </ul>

      <p className="mb-4 text-xs text-lux-on-dark-subtle">
        Remise −{carte.discount_pct}% sur stages & coaching unitaires (hors Pass).
        Non cumulable. Plancher {fmtTND(carte.member_floor_per_student_hour)}/h.
      </p>

      {ctaHref ? (
        <Link
          href={ctaHref}
          className="flex w-full items-center justify-center rounded-lg bg-lux-gold py-3 text-sm font-semibold text-lux-ink transition-all hover:bg-lux-gold-bright lux-focus"
        >
          {ctaText}
        </Link>
      ) : onCta ? (
        <button
          onClick={onCta}
          className="w-full rounded-lg bg-lux-gold py-3 text-sm font-semibold text-lux-ink transition-all hover:bg-lux-gold-bright lux-focus"
        >
          {ctaText}
        </button>
      ) : null}
      {(ctaHref || onCta) && (
        <a
          href={buildWhatsAppUrl(`l’offre ${carte.title}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-lux-ivory transition hover:border-lux-gold/70"
        >
          Poser une question
        </a>
      )}
    </div>
  );
}
