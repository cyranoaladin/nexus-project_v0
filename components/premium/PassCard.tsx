import Link from 'next/link';
import { Check, Zap } from 'lucide-react';
import { fmtTND } from './format';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import type { Pack } from '@/lib/pricing';

interface PassCardProps {
  pack: Pack;
  /** Resolved component labels */
  componentLabels: string[];
  onCta?: () => void;
  ctaHref?: string;
  ctaText?: string;
  highlighted?: boolean;
}

export function PassCard({ pack, componentLabels, onCta, ctaHref, ctaText = 'Réserver ce Pass', highlighted = false }: PassCardProps) {
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
              <span className="text-lux-slate">{label}</span>
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
        </div>
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
        {ctaHref ? (
          <Link
            href={ctaHref}
            className={`flex w-full items-center justify-center rounded-lg py-3 text-sm font-semibold transition-all lux-focus ${
              highlighted ? 'lux-cta-reserve' : 'lux-cta-primary'
            }`}
          >
            {ctaText}
          </Link>
        ) : onCta ? (
          <button
            onClick={onCta}
            className={`w-full rounded-lg py-3 text-sm font-semibold transition-all lux-focus ${
              highlighted ? 'lux-cta-reserve' : 'lux-cta-primary'
            }`}
          >
            {ctaText}
          </button>
        ) : null}
        {(ctaHref || onCta) && (
          <a
            href={buildWhatsAppUrl(`l’offre ${pack.title}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg border border-lux-line px-4 py-2 text-sm font-semibold text-lux-ink transition hover:border-lux-gold/70"
          >
            Poser une question
          </a>
        )}
      </div>
    </div>
  );
}
