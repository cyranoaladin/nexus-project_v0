'use client';

import { useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Check, ShieldCheck } from 'lucide-react';
import { WhatsAppLogo, WHATSAPP_BRAND_GREEN } from '@/components/ui/whatsapp-logo';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { fmtTND } from '@/components/premium/format';

// ── Types ──

/** Unified offer detail payload — built from the canonical loader. */
export interface OfferDetail {
  id: string;
  title: string;
  eyebrow: string;
  /** Présentiel Mutuelleville / en ligne / mixte */
  format?: string;
  /** ≤ 5 always */
  groupMax?: number;
  groupMinOpen?: number;
  /** Display price (campaign or public) */
  price: number;
  /** Original (public) price if different */
  originalPrice?: number;
  discountPct?: number;
  /** Canonical payment schedule — the SINGLE source of truth */
  payment?: {
    deposit: number;
    installments?: number[];
    solde?: number;
    solde_schedule?: number[];
    full_at_booking?: boolean;
    depositPct?: number;
  };
  /** "Included" items list */
  included: string[];
  /** Places-based availability note */
  availabilityNote?: string;
}

interface OfferDetailDialogProps {
  offer: OfferDetail | null;
  onClose: () => void;
}

// ── Component ──

export function OfferDetailDialog({ offer, onClose }: OfferDetailDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap + scroll lock + Escape
  useEffect(() => {
    if (!offer) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';

    // Focus the dialog
    requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      // Focus trap
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, [offer, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  if (!offer) return null;

  const bilanHref = `/bilan-gratuit?offer=${encodeURIComponent(offer.id)}`;
  const whatsappHref = buildWhatsAppUrl(`l\u2019offre ${offer.title}`);
  const firstInstallment = offer.payment?.installments?.[0];
  const lastInstallment = offer.payment?.installments?.[offer.payment.installments.length - 1];
  const hasInstallments =
    offer.payment != null &&
    !offer.payment.full_at_booking &&
    firstInstallment != null &&
    offer.payment.installments != null &&
    offer.payment.installments.length > 0;
  const depositPctLabel = offer.payment?.depositPct != null ? ` (${offer.payment.depositPct}\u00A0%)` : '';
  const lastInstallmentLabel =
    lastInstallment != null && lastInstallment !== firstInstallment
      ? `, dernière à ${fmtTND(lastInstallment)}`
      : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      role="presentation"
      onClick={handleOverlayClick}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 motion-safe:animate-[fadeIn_200ms_ease-out]"
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="offer-dialog-title"
        aria-describedby="offer-dialog-desc"
        tabIndex={-1}
        className={
          'relative flex max-h-[85vh] w-full flex-col overflow-hidden bg-lux-white ' +
          // Mobile: full-width bottom sheet
          'rounded-t-2xl ' +
          // Desktop: centered modal
          'md:mx-auto md:max-w-2xl md:rounded-2xl ' +
          'lux-shadow-hover motion-safe:animate-[slideUp_300ms_ease-out] md:motion-safe:animate-[fadeIn_200ms_ease-out]'
        }
      >
        {/* ─── Header (sticky) ─── */}
        <div className="flex items-start justify-between border-b border-lux-line px-6 pb-4 pt-5">
          <div>
            <span className="lux-eyebrow">{offer.eyebrow}</span>
            <h2
              id="offer-dialog-title"
              className="mt-1 text-xl font-fraunces text-lux-ink"
            >
              {offer.title}
            </h2>
            {offer.format && (
              <p id="offer-dialog-desc" className="mt-1 text-sm text-lux-slate">
                {offer.format}
                {offer.groupMax != null &&
                  ` · ${offer.groupMax} élèves max, ouverture dès ${offer.groupMinOpen ?? 3}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-lux-slate transition hover:bg-lux-paper lux-focus"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ─── Scrollable body ─── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {/* Price */}
          <div className="mb-6">
            {hasInstallments ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="lux-price text-2xl text-lux-ink">
                    {fmtTND(firstInstallment)}
                  </span>
                  <span className="text-sm font-medium text-lux-slate">/ mois hors acompte</span>
                </div>
                <p className="mt-1 text-sm text-lux-slate">
                  Acompte {fmtTND(offer.payment!.deposit)}{depositPctLabel}, puis {offer.payment!.installments!.length} mensualité{offer.payment!.installments!.length > 1 ? 's' : ''} ({fmtTND(firstInstallment)}{lastInstallmentLabel}). Total {fmtTND(offer.price)} / an.
                </p>
              </>
            ) : (
              <div className="flex items-baseline gap-3">
                <span className="lux-price text-2xl text-lux-ink">
                  {fmtTND(offer.price)}
                </span>
              </div>
            )}
            {!hasInstallments && offer.payment?.full_at_booking !== true && (
              <p className="mt-1 text-sm text-lux-slate">
                Prix catalogue selon la source canonique.
              </p>
            )}
          </div>

          {/* Échéancier — canonical, not recomputed */}
          {offer.payment && !offer.payment.full_at_booking && (
            <div className="mb-6 rounded-xl border border-lux-line bg-lux-paper p-4" data-testid="echeancier">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-lux-gold-deep">
                Échéancier
              </p>
              <div className="space-y-2 font-dm-sans text-sm">
                <Row label="Acompte" value={fmtTND(offer.payment.deposit)} />
                {offer.payment.installments &&
                  offer.payment.installments.length > 0 && (
                    <Row
                      label={`${offer.payment.installments.length} mensualité${offer.payment.installments.length > 1 ? 's' : ''}`}
                      value={
                        offer.payment.installments.length === 1
                          ? fmtTND(offer.payment.installments[0])
                          : offer.payment.installments.every(
                                (v) => v === offer.payment!.installments![0],
                              )
                            ? fmtTND(offer.payment.installments[0])
                            : `${fmtTND(offer.payment.installments[0])} → ${fmtTND(offer.payment.installments[offer.payment.installments.length - 1])}`
                      }
                    />
                  )}
                {offer.payment.solde != null && offer.payment.solde > 0 && (
                  <Row label="Solde" value={fmtTND(offer.payment.solde)} />
                )}
                {offer.payment.solde_schedule &&
                  offer.payment.solde_schedule.map((amount, i) => (
                    <Row
                      key={i}
                      label={`Solde ${i + 1}`}
                      value={fmtTND(amount)}
                    />
                  ))}
              </div>
              <p className="mt-3 text-xs text-lux-slate">
                Solde réglé avant chaque prestation.
              </p>
            </div>
          )}

          {offer.payment?.full_at_booking && (
            <div className="mb-6 rounded-xl border border-lux-line bg-lux-paper p-4">
              <p className="text-sm text-lux-ink">
                Règlement intégral à la réservation&nbsp;: {fmtTND(offer.price)}
              </p>
            </div>
          )}

          {/* Included */}
          {offer.included.length > 0 && (
            <div className="mb-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-lux-gold-deep">
                Inclus dans cette offre
              </p>
              <ul className="space-y-2">
                {offer.included.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-lux-evergreen" />
                    <span className="text-lux-ink">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Availability */}
          {offer.availabilityNote && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-lux-gold/10 px-4 py-3 text-sm text-lux-ink">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-lux-gold-deep" />
              <span>{offer.availabilityNote}</span>
            </div>
          )}
        </div>

        {/* ─── Footer CTAs (sticky) ─── */}
        <div className="flex items-center gap-3 border-t border-lux-line bg-lux-white px-6 py-4">
          <Link
            href={bilanHref}
            className="lux-cta-reserve flex-1 rounded-lg px-4 py-3 text-center text-sm font-semibold lux-focus"
          >
            Réserver ma place
          </Link>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] items-center gap-2 rounded-lg border border-lux-line px-4 py-3 text-sm font-semibold text-lux-ink transition hover:border-lux-gold/70 lux-focus"
          >
            <WhatsAppLogo className="h-4 w-4" style={{ color: WHATSAPP_BRAND_GREEN }} aria-hidden="true" />
            Poser une question
          </a>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ──

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-lux-slate">{label}</span>
      <span className="lux-price font-semibold text-lux-ink">{value}</span>
    </div>
  );
}

// Keyframes (added via globals.css or inline)
// fadeIn: from { opacity: 0 } to { opacity: 1 }
// slideUp: from { transform: translateY(100%) } to { transform: translateY(0) }
