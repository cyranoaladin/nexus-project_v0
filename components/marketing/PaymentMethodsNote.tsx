import { CreditCard, ShieldCheck } from 'lucide-react';
import { CGV_POLICY } from '@/lib/cgv-policy';

type PaymentMethodsNoteProps = {
  tone?: 'light' | 'dark';
  compact?: boolean;
};

export function PaymentMethodsNote({ tone = 'light', compact = false }: PaymentMethodsNoteProps) {
  const isDark = tone === 'dark';

  return (
    <div
      className={
        isDark
          ? 'rounded-2xl border border-lux-line/30 bg-white/5 p-4 text-lux-on-dark-muted'
          : 'rounded-2xl border border-lux-line bg-lux-paper/70 p-4 text-lux-slate'
      }
      data-testid="payment-methods-note"
    >
      <div className="flex items-start gap-3">
        <CreditCard className={isDark ? 'mt-0.5 h-5 w-5 text-lux-gold-wash' : 'mt-0.5 h-5 w-5 text-lux-gold-deep'} aria-hidden="true" />
        <div className="min-w-0">
          <p className={isDark ? 'text-sm font-semibold text-lux-ivory' : 'text-sm font-semibold text-lux-ink'}>
            Paiement par carte via {CGV_POLICY.payment.provider} ({CGV_POLICY.payment.bank})
          </p>
          <p className="mt-1 text-sm">{CGV_POLICY.payment.acceptedCards}</p>
          {!compact && (
            <div className="mt-3 flex items-start gap-2 text-xs">
              <ShieldCheck className={isDark ? 'mt-0.5 h-4 w-4 text-lux-gold-wash' : 'mt-0.5 h-4 w-4 text-lux-evergreen'} aria-hidden="true" />
              <div className="space-y-1">
                <p>{CGV_POLICY.payment.cardFee}</p>
                <p>{CGV_POLICY.payment.security} {CGV_POLICY.payment.cvvStorage}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
