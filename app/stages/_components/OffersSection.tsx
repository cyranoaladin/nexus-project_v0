"use client";

import { useCallback, useMemo, useState } from "react";
import { BadgeCheck, BarChart3, Sparkles, Users, Wallet } from "lucide-react";

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

const REASSURANCE_ITEMS = [
  { icon: Users, label: "Groupes limités à 3 élèves" },
  { icon: BadgeCheck, label: "Cadre structuré et suivi clair" },
  { icon: BarChart3, label: "Formules progressives et lisibles" },
  { icon: Wallet, label: "Tarifs plus avantageux sur les parcours combinés" },
] as const;

export default function OffersSection() {
  const [level, setLevel] = useState<Level>("premiere");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [openOfferId, setOpenOfferId] = useState<string | null>(
    "p-duo-fr-maths"
  );

  const offers = useMemo(() => {
    const all = getOffersByLevel(level);
    if (category === "all") return all;
    if (category === "trio")
      return all.filter((o) => o.category === "trio" || o.category === "complement");
    return all.filter((o) => o.category === category);
  }, [level, category]);

  const DEFAULT_OPEN: Record<Level, string> = {
    premiere: "p-duo-fr-maths",
    terminale: "t-duo-maths-nsi",
  };

  // When level changes, reset filter and open the flagship offer
  const handleLevelChange = useCallback(
    (newLevel: Level) => {
      setLevel(newLevel);
      setCategory("all");
      setOpenOfferId(DEFAULT_OPEN[newLevel]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // When category changes, open the flagship if it's in the filtered set, else first
  const handleCategoryChange = useCallback(
    (newCat: CategoryFilter) => {
      setCategory(newCat);
      const allOffers = getOffersByLevel(level);
      const filtered =
        newCat === "all"
          ? allOffers
          : newCat === "trio"
          ? allOffers.filter((o) => o.category === "trio" || o.category === "complement")
          : allOffers.filter((o) => o.category === newCat);
      const flagship = DEFAULT_OPEN[level];
      const hasFlag = filtered.some((o) => o.id === flagship);
      setOpenOfferId(hasFlag ? flagship : filtered[0]?.id ?? null);
    },
    [level]
  );

  // Single-open: clicking an open card closes it; clicking another opens it
  const handleToggle = useCallback(
    (id: string) => {
      setOpenOfferId((prev) => (prev === id ? null : id));
    },
    []
  );

  const effectiveOpenId = openOfferId;

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
          <div
            className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1"
            role="tablist"
            aria-label="Niveau scolaire"
          >
            {LEVELS.map((l) => {
              const isActive = l.id === level;
              return (
                <button
                  key={l.id}
                  type="button"
                  role="tab"
                  onClick={() => handleLevelChange(l.id)}
                  className={`rounded-full px-6 py-2.5 font-display text-sm font-bold tracking-wide transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-green/50 focus-visible:ring-offset-1 focus-visible:ring-offset-nexus-bg ${
                    isActive
                      ? "bg-nexus-green/15 text-white shadow-sm"
                      : "text-white/50 hover:text-white"
                  }`}
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Category filter (segmented control) ── */}
        <div className="mt-6 flex justify-center">
          <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Nombre de matières">
            {CATEGORY_FILTERS.map((f) => {
              const isActive = f.id === category;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleCategoryChange(f.id)}
                  className={`rounded-full border px-4 py-2 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-green/50 focus-visible:ring-offset-1 focus-visible:ring-offset-nexus-bg ${
                    isActive
                      ? "border-nexus-green/35 bg-nexus-green/12 text-white"
                      : "border-white/10 bg-white/[0.04] text-white/50 hover:border-white/18 hover:text-white"
                  }`}
                  aria-pressed={isActive}
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
              <p className="mt-2 text-sm leading-7 text-white/46">
                Les parcours combinés permettent d'avancer avec plus de
                cohérence et une meilleure visibilité.
              </p>
            </div>
          </div>
        </div>

        {/* ── Reassurance block ── */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {REASSURANCE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                  <Icon className="h-3.5 w-3.5 text-white/50" aria-hidden="true" />
                </span>
                <p className="text-xs leading-5 text-white/55">{item.label}</p>
              </div>
            );
          })}
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
