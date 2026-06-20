import { fmtTND } from '@/components/premium/format';

/**
 * Displays either the formatted price or "Sur devis" depending on validation status.
 * Pure component — no data fetching, testable in isolation.
 */
export function StagePriceLabel({ price }: { price: number | null }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-lux-gold-wash">
      {price != null ? fmtTND(price) : 'Sur devis'}
    </span>
  );
}
