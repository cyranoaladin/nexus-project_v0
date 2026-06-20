import type { Offer } from "../_data/offers";

type OfferPriceBlockProps = {
  offer: Offer;
  compact?: boolean;
};

/** Deterministic price formatting — avoids SSR/client locale mismatch */
function formatPrice(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
}

export default function OfferPriceBlock({ offer, compact = false }: OfferPriceBlockProps) {
  if (compact) {
    return (
      <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
        <span className="font-display text-xl font-extrabold text-white">
          {formatPrice(offer.price)}&nbsp;TND
        </span>
      </span>
    );
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-3xl font-extrabold leading-none text-white">
            {formatPrice(offer.price)}&nbsp;TND
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/30">
            Volume
          </p>
          <p className="mt-0.5 font-display text-lg font-bold text-white/90">
            {offer.hours}h
          </p>
        </div>
      </div>
    </div>
  );
}
