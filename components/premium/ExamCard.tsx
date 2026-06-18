'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { fmtTND, fmtGroup, fmtHoursWeek, fmtDiscount, fmtPrice } from './format';

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
  /** Campaign badge label */
  campaignBadge?: string;
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
    originalPrice,
    discountPct,
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
    campaignBadge,
    depositDeductible,
  } = props;
  const ctaHref = 'ctaHref' in props ? props.ctaHref : undefined;
  const ctaAction = 'onCta' in props ? props.onCta : undefined;
  const hideCta = 'hideCta' in props && props.hideCta;
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl transition-all duration-300 ${
        featured
          ? 'ring-2 ring-lux-gold lux-shadow-hover'
          : 'border border-lux-line lux-shadow hover:lux-shadow-hover hover:-translate-y-0.5'
      } bg-lux-white`}
    >
      {/* Filigrane monogramme N — discret */}
      <div
        className="pointer-events-none absolute right-4 top-4 select-none text-[120px] font-fraunces font-light leading-none opacity-[0.03]"
        aria-hidden="true"
      >
        N
      </div>

      {/* Tab eyebrow + campaign badge */}
      <div className="relative border-b border-lux-line px-6 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <span className="lux-eyebrow">{eyebrow}</span>
          {campaignBadge && (
            <span className="rounded-full bg-lux-evergreen px-3 py-0.5 text-[0.65rem] font-semibold text-white">
              {campaignBadge}
            </span>
          )}
        </div>

        {/* Title + gold filet */}
        <h3 className="mt-2 text-xl font-fraunces">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-sm text-lux-slate">{subtitle}</p>
        )}
        <div className="lux-filet-gold mt-3 w-16" />
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-lux-line/50 px-6 py-4">
        {hoursPerWeek != null && (
          <div>
            <p className="text-[0.65rem] font-medium uppercase tracking-wider text-lux-slate">
              Volume
            </p>
            <p className="font-dm-sans text-sm font-semibold text-lux-ink">
              {fmtHoursWeek(hoursPerWeek)}
            </p>
          </div>
        )}
        {totalHours != null && (
          <div>
            <p className="text-[0.65rem] font-medium uppercase tracking-wider text-lux-slate">
              Total
            </p>
            <p className="font-dm-sans text-sm font-semibold text-lux-ink">
              {totalHours}h / an
            </p>
          </div>
        )}
        {effectifType !== 'none' && (
          <div>
            <p className="text-[0.65rem] font-medium uppercase tracking-wider text-lux-slate">
              {effectifType === 'individuel' ? 'Format' : 'Groupe'}
            </p>
            <p className="font-dm-sans text-sm font-semibold text-lux-ink">
              {effectifType === 'individuel' ? 'Individuel' : fmtGroup(groupMax, groupMinOpen)}
            </p>
          </div>
        )}
      </div>

      {/* Pricing — tabular */}
      <div className="bg-lux-paper/60 px-6 py-5">
        <div className="flex items-baseline gap-3">
          <span className="lux-price text-2xl text-lux-ink">
            {fmtTND(price)}
          </span>
          {originalPrice != null && originalPrice > price && (
            <>
              <span className="text-sm text-lux-slate line-through">
                {fmtTND(originalPrice)}
              </span>
              {discountPct != null && (
                <span className="rounded bg-lux-evergreen/10 px-2 py-0.5 text-xs font-semibold text-lux-evergreen">
                  {fmtDiscount(discountPct)}
                </span>
              )}
            </>
          )}
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
          <div className="space-y-1.5 font-dm-sans text-sm">
            <div className="flex justify-between">
              <span className="text-lux-slate">Acompte</span>
              <span className="lux-price font-semibold text-lux-ink">
                {fmtTND(payment.deposit)}
              </span>
            </div>
            {payment.installments && payment.installments.length > 0 && (
              <div className="flex justify-between">
                <span className="text-lux-slate">
                  {payment.installments.length} mensualité{payment.installments.length > 1 ? 's' : ''}
                </span>
                <span className="lux-price font-semibold text-lux-ink">
                  {fmtTND(payment.installments[0])}
                  {payment.installments.length > 1 &&
                    payment.installments[payment.installments.length - 1] !== payment.installments[0] &&
                    ` → ${fmtTND(payment.installments[payment.installments.length - 1])}`}
                </span>
              </div>
            )}
            {payment.solde != null && payment.solde > 0 && (
              <div className="flex justify-between">
                <span className="text-lux-slate">Solde</span>
                <span className="lux-price font-semibold text-lux-ink">
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
                <span className="text-sm text-lux-ink/80">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* CTA */}
      {hideCta ? null : (
        <div className="mt-auto border-t border-lux-line/50 p-5">
          {ctaHref ? (
          <Link
            href={ctaHref}
            className={`flex w-full items-center justify-center rounded-lg py-3 text-sm font-semibold transition-all lux-focus ${
              featured ? 'lux-cta-reserve' : 'lux-cta-primary'
            }`}
          >
            {ctaText}
          </Link>
          ) : ctaAction ? (
          <button
            onClick={ctaAction}
            className={`w-full rounded-lg py-3 text-sm font-semibold transition-all lux-focus ${
              featured
                ? 'lux-cta-reserve'
                : 'lux-cta-primary'
            }`}
          >
            {ctaText}
          </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
