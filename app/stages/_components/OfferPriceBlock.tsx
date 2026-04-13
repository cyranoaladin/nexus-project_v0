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
          <span className="text-xs text-white/40 line-through">
            {formatPrice(offer.priceReference!)}&nbsp;TND
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-3xl font-extrabold leading-none text-white">
            {formatPrice(offer.price)}&nbsp;TND
          </p>
          {hasSaving ? (
            <>
              <p className="mt-1.5 text-xs text-white/40">
                <span className="line-through">
                  {formatPrice(offer.priceReference!)}&nbsp;TND
                </span>
                <span className="ml-1.5 text-white/30">si achat séparé</span>
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-nexus-green/12 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-nexus-green">
                −{offer.saving}&nbsp;TND d'économie
              </p>
            </>
          ) : null}
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/35">
            Volume
          </p>
          <p className="mt-0.5 font-display text-lg font-bold text-white">
            {offer.hours}h
          </p>
        </div>
      </div>
    </div>
  );
}
