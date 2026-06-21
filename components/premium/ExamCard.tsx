'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { fmtTND, fmtGroup, fmtHoursWeek, fmtPrice } from './format';
import { buildWhatsAppUrl } from '@/lib/whatsapp';

interface ExamCardPayment {
  deposit: number;
  installments?: number[];
  solde?: number;
  n_installments?: number;
  full_at_booking?: boolean;
}

interface ExamCardBaseProps {
  /** Tab eyebrow — e.g. "Terminale · Spécialité simple" */
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Annual or total price */
  price: number;
  /** Original price before campaign (show "au lieu de") */
  originalPrice?: number;
  /** Discount percentage to display as badge */
  discountPct?: number;
  /** Payment schedule */
  payment?: ExamCardPayment;
  /** "X TND / mois" display */
  monthlyDisplay?: number;
  /** "Xh / semaine" */
  hoursPerWeek?: number;
  /** Total hours */
  totalHours?: number;
  /** Effectif display type: groupe → "5 max, dès 3" ; individuel → "individuel" ; none → hidden */
  effectifType?: 'groupe' | 'individuel' | 'none';
  /** Group max (always 5) */
  groupMax?: number;
  /** Group min to open */
  groupMinOpen?: number;
  /** Features / included items */
  features?: string[];
  /** Places left — only show if present */
  placesLeft?: number;
  /** CTA text */
  ctaText?: string;
  /** Highlighted / featured */
  featured?: boolean;
  /** Acompte deductible */
  depositDeductible?: boolean;
}

type ExamCardActionProps =
  | {
      ctaHref: string;
      onCta?: never;
      hideCta?: never;
    }
  | {
      onCta: () => void;
      ctaHref?: never;
      hideCta?: never;
    }
  | {
      hideCta: true;
      ctaHref?: never;
      onCta?: never;
    };

export type ExamCardProps = ExamCardBaseProps & ExamCardActionProps;

export function ExamCard(props: ExamCardProps) {
  const {
    eyebrow,
    title,
    subtitle,
    price,
    payment,
    monthlyDisplay,
    hoursPerWeek,
    totalHours,
    effectifType = 'groupe',
    groupMax = 5,
    groupMinOpen = 3,
    features,
    placesLeft,
    ctaText = 'Réserver ma place',
    featured = false,
    depositDeductible,
  } = props;
  const ctaHref = 'ctaHref' in props ? props.ctaHref : undefined;
  const ctaAction = 'onCta' in props ? props.onCta : undefined;
  const hideCta = 'hideCta' in props && props.hideCta;
  return (
    <div
      className={`@container relative flex flex-col overflow-hidden rounded-2xl transition-all duration-300 ${
        featured
          ? 'ring-2 ring-lux-gold shadow-xl shadow-lux-gold/10 scale-[1.02]'
          : 'border border-lux-line/60 shadow-md shadow-lux-ink/5 hover:shadow-lg hover:shadow-lux-ink/10 hover:-translate-y-1'
      } bg-lux-white`}
    >
      {/* Filigrane monogramme N — discret */}
      <div
        className="pointer-events-none absolute right-4 top-4 select-none text-[120px] font-fraunces font-light leading-none opacity-[0.03]"
        aria-hidden="true"
      >
        N
      </div>

      {/* Featured badge */}
      {featured && (
        <div className="bg-lux-gold px-4 py-1.5 text-center">
          <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-lux-ink">
            Meilleure valeur
          </span>
        </div>
      )}

      {/* Tab eyebrow */}
      <div className={`relative border-b border-lux-line/40 px-6 pb-4 ${featured ? 'pt-4' : 'pt-5'}`}>
        <div className="flex items-start justify-between gap-3">
          <span className="lux-eyebrow">{eyebrow}</span>
        </div>

        {/* Title + gold filet */}
        <h3 className="mt-2 text-xl font-fraunces">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-sm text-lux-slate">{subtitle}</p>
        )}
        <div className="lux-filet-gold mt-3 w-16" />
      </div>

      {/* Key metrics — container query: stacked on narrow cards, 2-col on wide */}
      <div className="border-b border-lux-line/40 bg-lux-paper/70 px-6 py-3 text-sm">
        {/* Volume + Total: side-by-side when card is wide enough */}
        {(hoursPerWeek != null || totalHours != null) && (
          <div className="grid grid-cols-1 @[22rem]:grid-cols-2 gap-x-6 gap-y-1.5">
            {hoursPerWeek != null && (
              <div data-testid="metric-volume">
                <span className="text-[0.6rem] font-medium uppercase tracking-wider text-lux-slate">Volume</span>
                <p data-testid="metric-volume-value" className="mt-0.5 font-dm-sans text-sm font-semibold text-lux-ink">{fmtHoursWeek(hoursPerWeek)}</p>
              </div>
            )}
            {totalHours != null && (
              <div data-testid="metric-total">
                <span className="text-[0.6rem] font-medium uppercase tracking-wider text-lux-slate">Total</span>
                <p data-testid="metric-total-value" className="mt-0.5 font-dm-sans text-sm font-semibold text-lux-ink">{totalHours}h&nbsp;/&nbsp;an</p>
              </div>
            )}
          </div>
        )}
        {/* Groupe: always full width */}
        {effectifType !== 'none' && (
          <div data-testid="metric-groupe" className="mt-1.5 flex justify-between gap-3">
            <span className="text-[0.6rem] font-medium uppercase tracking-wider text-lux-slate">
              {effectifType === 'individuel' ? 'Format' : 'Groupe'}
            </span>
            <span data-testid="metric-groupe-value" className="font-dm-sans text-sm font-semibold text-lux-ink text-right">
              {effectifType === 'individuel' ? 'Individuel' : fmtGroup(groupMax, groupMinOpen)}
            </span>
          </div>
        )}
      </div>

      {/* Pricing — tabular */}
      <div className={`px-6 py-5 ${featured ? 'bg-lux-ink/[0.03]' : 'bg-lux-paper/60'}`}>
        <div className="flex items-baseline gap-3">
          <span className="lux-price text-2xl font-bold text-lux-ink">
            {fmtTND(price)}
          </span>
        </div>
        {monthlyDisplay != null && (
          <p className="mt-1 text-sm text-lux-slate">
            soit {fmtPrice(monthlyDisplay)}&nbsp;TND&nbsp;/&nbsp;mois
          </p>
        )}
      </div>

      {/* Places left — only if data present */}
      {placesLeft != null && (
        <div className="flex items-center gap-2 border-t border-lux-line/50 px-6 py-3">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lux-gold opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-lux-gold" />
          </span>
          <span className="text-xs font-semibold text-lux-ink">
            {placesLeft} place{placesLeft !== 1 ? 's' : ''} restante{placesLeft !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Échéancier — style grand livre */}
      {payment && !payment.full_at_booking && (
        <div className="border-t border-lux-line/50 px-6 py-4">
          <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wider text-lux-slate">
            Échéancier
          </p>
          <div className="space-y-2 font-dm-sans text-sm">
            <div data-testid="echeancier-acompte" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
              <span className="text-lux-slate">Acompte</span>
              <span data-testid="echeancier-acompte-value" className="lux-price font-semibold text-lux-ink whitespace-nowrap">
                {fmtTND(payment.deposit)}
              </span>
            </div>
            {payment.installments && payment.installments.length > 0 && (
              <div data-testid="echeancier-mensualites" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="text-lux-slate whitespace-nowrap">
                  {payment.installments.length}&nbsp;mensualité{payment.installments.length > 1 ? 's' : ''}
                </span>
                <span data-testid="echeancier-mensualites-value" className="lux-price font-semibold text-lux-ink whitespace-nowrap">
                  {fmtTND(payment.installments[0])}
                  {payment.installments.length > 1 &&
                    payment.installments[payment.installments.length - 1] !== payment.installments[0] &&
                    <>&nbsp;→&nbsp;{fmtTND(payment.installments[payment.installments.length - 1])}</>}
                </span>
              </div>
            )}
            {payment.solde != null && payment.solde > 0 && (
              <div data-testid="echeancier-solde" className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                <span className="text-lux-slate">Solde</span>
                <span data-testid="echeancier-solde-value" className="lux-price font-semibold text-lux-ink whitespace-nowrap">
                  {fmtTND(payment.solde)}
                </span>
              </div>
            )}
          </div>
          {depositDeductible && (
            <p className="mt-2 text-xs text-lux-evergreen">
              Acompte déductible du parcours annuel
            </p>
          )}
        </div>
      )}

      {/* Features */}
      {features && features.length > 0 && (
        <div className="flex-grow border-t border-lux-line/50 px-6 py-4">
          <ul className="space-y-2">
            {features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-lux-gold" />
                <span className="text-sm text-lux-slate">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA — featured: or plein (lux-cta-reserve) / standard: navy contour */}
      {hideCta ? null : (
        <div className="mt-auto border-t border-lux-line/50 p-5">
          {ctaHref ? (
            <Link
              href={ctaHref}
              className={`flex w-full items-center justify-center rounded-lg py-3 text-sm font-semibold transition-all min-h-[44px] lux-focus ${
                featured
                  ? 'lux-cta-reserve'
                  : 'border-[1.5px] border-lux-ink bg-transparent text-lux-ink hover:bg-lux-ink hover:text-lux-ivory'
              }`}
            >
              {ctaText}
            </Link>
          ) : ctaAction ? (
            <button
              onClick={ctaAction}
              className={`w-full rounded-lg py-3 text-sm font-semibold transition-all min-h-[44px] lux-focus ${
                featured
                  ? 'lux-cta-reserve'
                  : 'border-[1.5px] border-lux-ink bg-transparent text-lux-ink hover:bg-lux-ink hover:text-lux-ivory'
              }`}
            >
              {ctaText}
            </button>
          ) : null}
          {(ctaHref || ctaAction) && (
            <a
              href={buildWhatsAppUrl(`l’offre ${title}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-lg border border-lux-line px-4 py-2 text-sm font-semibold text-lux-ink transition hover:border-lux-gold/70"
            >
              Poser une question
            </a>
          )}
        </div>
      )}
    </div>
  );
}
