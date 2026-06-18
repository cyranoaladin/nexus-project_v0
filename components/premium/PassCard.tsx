'use client';

import { Check, Zap } from 'lucide-react';
import { fmtTND, fmtDiscount } from './format';
import type { Pack } from '@/lib/pricing';

interface PassCardProps {
  pack: Pack;
  /** Resolved component labels */
  componentLabels: string[];
  onCta?: () => void;
  highlighted?: boolean;
}

export function PassCard({ pack, componentLabels, onCta, highlighted = false }: PassCardProps) {
  const hasDiscount = pack.value > pack.price;

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl transition-all duration-300 bg-lux-white ${
        highlighted
          ? 'ring-2 ring-lux-gold lux-shadow-hover'
          : 'border border-lux-line lux-shadow hover:lux-shadow-hover hover:-translate-y-0.5'
      }`}
    >
      {/* Header */}
      <div className="border-b border-lux-line px-6 pb-4 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="lux-eyebrow">{pack.public || pack.title}</span>
            <h3 className="mt-1 text-lg font-fraunces">{pack.title}</h3>
          </div>
          {highlighted && (
            <div className="flex items-center gap-1 text-lux-evergreen">
              <Zap className="h-4 w-4" />
              <span className="text-[0.65rem] font-bold uppercase">
                Meilleure valeur
              </span>
            </div>
          )}
        </div>
        <div className="lux-filet-gold mt-3 w-12" />
      </div>

      {/* Composition — what's included */}
      <div className="border-b border-lux-line/50 px-6 py-4">
        <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wider text-lux-slate">
          Composition
        </p>
        <ul className="space-y-1.5">
          {componentLabels.map((label, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-lux-gold" />
              <span className="text-lux-ink/80">{label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pricing with "au lieu de" */}
      <div className="bg-lux-paper/60 px-6 py-5">
        <div className="flex items-baseline gap-3">
          <span className="lux-price text-2xl text-lux-ink">
            {fmtTND(pack.price)}
          </span>
          {hasDiscount && (
            <>
              <span className="text-sm text-lux-slate line-through">
                {fmtTND(pack.value)}
              </span>
              <span className="rounded bg-lux-evergreen/10 px-2 py-0.5 text-xs font-semibold text-lux-evergreen">
                {fmtDiscount(pack.discount_pct)}
              </span>
            </>
          )}
        </div>
        {hasDiscount && (
          <p className="mt-1 text-xs text-lux-slate">
            au lieu de {fmtTND(pack.value)} (somme des prestations unitaires)
          </p>
        )}
      </div>

      {/* Schedule */}
      <div className="border-t border-lux-line/50 px-6 py-4">
        <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wider text-lux-slate">
          Échéancier
        </p>
        <div className="space-y-1.5 font-dm-sans text-sm">
          <div className="flex justify-between">
            <span className="text-lux-slate">Acompte</span>
            <span className="lux-price font-semibold text-lux-ink">
              {fmtTND(pack.payment.deposit)}
            </span>
          </div>
          {pack.payment.solde_schedule.map((amount, i) => (
            <div key={i} className="flex justify-between">
              <span className="text-lux-slate">
                Solde {i + 1}
              </span>
              <span className="lux-price font-semibold text-lux-ink">
                {fmtTND(amount)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1">
          {pack.deposit_deductible_to_annual && (
            <p className="text-xs text-lux-evergreen">
              Acompte déductible du parcours annuel
            </p>
          )}
          {pack.deposit_carryover && (
            <p className="text-xs text-lux-evergreen">
              Solde avant chaque prestation
            </p>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-auto border-t border-lux-line/50 p-5">
        <button
          onClick={onCta}
          className={`w-full rounded-lg py-3 text-sm font-semibold transition-all lux-focus ${
            highlighted ? 'lux-cta-reserve' : 'lux-cta-primary'
          }`}
        >
          Réserver ce Pass
        </button>
      </div>
    </div>
  );
}
