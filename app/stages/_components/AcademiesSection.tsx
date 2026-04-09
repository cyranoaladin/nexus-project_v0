"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Filter } from "lucide-react";

import { PACKS } from "../_data/packs";
import AcademyCard from "./AcademyCard";

type FilterId = "all" | "premiere" | "terminale" | "packs";

const filters: { id: FilterId; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "premiere", label: "Première" },
  { id: "terminale", label: "Terminale" },
  { id: "packs", label: "Packs" },
];

export default function AcademiesSection() {
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");

  const visiblePacks = useMemo(() => {
    switch (activeFilter) {
      case "premiere":
        return PACKS.filter((pack) => pack.subtitle.startsWith("PREMIÈRE"));
      case "terminale":
        return PACKS.filter((pack) => pack.subtitle.startsWith("TERMINALE"));
      case "packs":
        return PACKS.filter(
          (pack) =>
            pack.highlight ||
            pack.isAddOn ||
            pack.id.includes("combo") ||
            pack.id.includes("fullstack")
        );
      default:
        return PACKS;
    }
  }, [activeFilter]);

  return (
    <section id="academies" className="bg-nexus-bg-alt px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div className="max-w-3xl">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/42">
              Nos Académies de Printemps
            </p>
            <h2 className="mt-3 font-display text-h2 font-bold text-white">
              Choisir le bon stage doit prendre moins d'une minute.
            </h2>
            <p className="mt-4 text-base leading-8 text-white/58">
              Comparer les formules, voir les places, réserver sans friction. Les programmes sont
              déjà structurés pour mai et juin, il ne reste qu'à choisir le bon niveau d'intensité.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/8 bg-white/[0.03] p-5 text-sm leading-7 text-white/60">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/56">
              <Filter className="h-3.5 w-3.5 text-nexus-green" aria-hidden="true" />
              Filtrer rapidement
            </div>
            <p className="mt-4">
              Si vous hésitez, commencez par la classe. Si vous comparez deux options proches,
              regardez d'abord le volume horaire, puis le nombre de places et enfin l'écart avec le
              prix marché.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-nexus-green">
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              Les packs en surbrillance sont ceux qui convertissent le mieux en résultats.
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {filters.map((filter) => {
            const isActive = filter.id === activeFilter;

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? "border-nexus-green/35 bg-nexus-green/14 text-white"
                    : "border-white/10 bg-white/5 text-white/64 hover:border-white/20 hover:text-white"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className="mt-10 grid items-stretch gap-6 md:grid-cols-2 xl:grid-cols-3">
          {visiblePacks.map((pack) => (
            <AcademyCard key={pack.id} pack={pack} />
          ))}
        </div>
      </div>
    </section>
  );
}
