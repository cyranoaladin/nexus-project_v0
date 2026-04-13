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
  const hasSaving = !!(offer.priceReference && offer.saving);

  if (compact) {
    return (
      <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
        <span className="font-display text-xl font-extrabold text-white">
          {formatPrice(offer.price)}&nbsp;TND
        </span>
        {hasSaving ? (
          <span className="text-[11px] text-white/35 line-through">
            {formatPrice(offer.priceReference!)}&nbsp;TND
          </span>
        ) : null}
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
          {hasSaving ? (
            <>
              <p className="mt-1.5 text-[11px] text-white/30">
                <span className="line-through">
                  {formatPrice(offer.priceReference!)}&nbsp;TND
                </span>
                <span className="ml-1 text-white/22">si achat séparé</span>
              </p>
              <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-nexus-green/8 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-nexus-green/80">
                −{offer.saving}&nbsp;TND d'économie
              </p>
            </>
          ) : null}
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
