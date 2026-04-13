"use client";

import { useCallback, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

import {
  type CategoryFilter,
  type Level,
  CATEGORY_FILTERS,
  getOffersByLevel,
} from "../_data/offers";
import OfferAccordionCard from "./OfferAccordionCard";
import ComparisonStrip from "./ComparisonStrip";

const LEVELS: { id: Level; label: string }[] = [
  { id: "premiere", label: "Première" },
  { id: "terminale", label: "Terminale" },
];

export default function OffersSection() {
  const [level, setLevel] = useState<Level>("premiere");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [openOfferId, setOpenOfferId] = useState<string | null>(null);

  const offers = useMemo(() => {
    const all = getOffersByLevel(level);
    if (category === "all") return all;
    if (category === "trio")
      return all.filter((o) => o.category === "trio" || o.category === "complement");
    return all.filter((o) => o.category === category);
  }, [level, category]);

  // Auto-open best-seller when switching tab/filter
  const bestSellerId = useMemo(() => {
    const best = offers.find((o) => o.emphasis === "maximale");
    return best?.id ?? null;
  }, [offers]);

  // When level or category changes, auto-open best-seller
  const handleLevelChange = useCallback(
    (newLevel: Level) => {
      setLevel(newLevel);
      setCategory("all");
      const allOffers = getOffersByLevel(newLevel);
      const best = allOffers.find((o) => o.emphasis === "maximale");
      setOpenOfferId(best?.id ?? null);
    },
    []
  );

  const handleCategoryChange = useCallback(
    (newCat: CategoryFilter) => {
      setCategory(newCat);
      // Reset opened card — the best one in the filtered set will be opened
      const allOffers = getOffersByLevel(level);
      const filtered =
        newCat === "all"
          ? allOffers
          : newCat === "trio"
          ? allOffers.filter((o) => o.category === "trio" || o.category === "complement")
          : allOffers.filter((o) => o.category === newCat);
      const best = filtered.find((o) => o.emphasis === "maximale");
      setOpenOfferId(best?.id ?? null);
    },
    [level]
  );

  const handleToggle = useCallback(
    (id: string) => {
      setOpenOfferId((prev) => (prev === id ? null : id));
    },
    []
  );

  // On first render, auto-open best-seller
  const effectiveOpenId = openOfferId ?? bestSellerId;

  return (
    <section id="offres" className="bg-nexus-bg-alt px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        {/* ── Section header ── */}
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/42">
            Formules de préparation
          </p>
          <h2 className="mt-3 font-display text-h2 font-bold text-white">
            Choisissez la formule adaptée à votre niveau
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-white/54">
            Des parcours lisibles, structurés et dégressifs quand vous combinez
            plusieurs matières.
          </p>
        </div>

        {/* ── Level tabs ── */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
            {LEVELS.map((l) => {
              const isActive = l.id === level;
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => handleLevelChange(l.id)}
                  className={`rounded-full px-6 py-2.5 font-display text-sm font-bold tracking-wide transition-all duration-150 ${
                    isActive
                      ? "bg-nexus-green/15 text-white shadow-sm"
                      : "text-white/50 hover:text-white"
                  }`}
                  aria-pressed={isActive}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Category filter (segmented control) ── */}
        <div className="mt-6 flex justify-center">
          <div className="flex flex-wrap justify-center gap-2">
            {CATEGORY_FILTERS.map((f) => {
              const isActive = f.id === category;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleCategoryChange(f.id)}
                  className={`rounded-full border px-4 py-2 text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? "border-nexus-green/35 bg-nexus-green/12 text-white"
                      : "border-white/10 bg-white/[0.04] text-white/50 hover:border-white/18 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Comparison strip ── */}
        <div className="mt-8">
          <ComparisonStrip />
        </div>

        {/* ── Offer cards (accordion) ── */}
        <div className="mt-8 space-y-3">
          {offers.map((offer) => (
            <OfferAccordionCard
              key={offer.id}
              offer={offer}
              isOpen={effectiveOpenId === offer.id}
              onToggle={() => handleToggle(offer.id)}
            />
          ))}

          {offers.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-8 text-center text-sm text-white/40">
              Aucune formule dans cette catégorie pour ce niveau.
            </div>
          ) : null}
        </div>

        {/* ── Marketing block ── */}
        <div className="mt-10 rounded-[24px] border border-nexus-green/15 bg-nexus-green/[0.04] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-xl border border-nexus-green/20 bg-nexus-green/10 p-3">
              <Sparkles className="h-5 w-5 text-nexus-green" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">
                Pourquoi le pack est plus intéressant ?
              </h3>
              <p className="mt-2 text-sm leading-7 text-white/58">
                Un seul cadre, un seul rythme, une seule logique de travail. Au
                lieu de multiplier les inscriptions séparées, choisissez une
                formule plus lisible et plus avantageuse — pour l'élève comme
                pour la famille.
              </p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-white/45">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  Tarif dégressif automatique
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  Progression cohérente
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                  Un seul interlocuteur
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── On-request note ── */}
        <p className="mt-6 text-center text-xs text-white/30">
          D'autres combinaisons sont possibles sur demande.
          Contactez-nous pour une formule personnalisée.
        </p>
      </div>
    </section>
  );
}
