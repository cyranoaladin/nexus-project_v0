"use client";

import { useMemo, useState } from "react";

import { PACKS } from "../_data/packs";
import AcademyCard from "./AcademyCard";

type FilterId = "all" | "premiere" | "terminale" | "oral";

const filters: { id: FilterId; label: string }[] = [
  { id: "all", label: "Toutes les formules" },
  { id: "premiere", label: "Première" },
  { id: "terminale", label: "Terminale" },
  { id: "oral", label: "Grand Oral" },
];

export default function AcademiesSection() {
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");

  const visiblePacks = useMemo(() => {
    switch (activeFilter) {
      case "premiere":
        return PACKS.filter((p) => p.subtitle.startsWith("PREMIÈRE"));
      case "terminale":
        return PACKS.filter(
          (p) => p.subtitle.startsWith("TERMINALE") && p.id !== "grand-oral"
        );
      case "oral":
        return PACKS.filter((p) => p.id === "grand-oral");
      default:
        return PACKS;
    }
  }, [activeFilter]);

  return (
    <section id="offres" className="bg-nexus-bg-alt px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Intro */}
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/42">
            Les formules disponibles
          </p>
          <h2 className="mt-3 font-display text-h2 font-bold text-white">
            Choisir le bon stage doit prendre moins d'une minute.
          </h2>
          <p className="mt-4 text-base leading-8 text-white/54">
            Comparez les formules, vérifiez les places disponibles, réservez sans friction.
          </p>
        </div>

        {/* Filtres */}
        <div className="mt-8 flex flex-wrap gap-2.5">
          {filters.map((filter) => {
            const isActive = filter.id === activeFilter;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "border-nexus-green/35 bg-nexus-green/12 text-white"
                    : "border-white/10 bg-white/[0.04] text-white/55 hover:border-white/18 hover:text-white"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {/* Grille */}
        <div className="mt-10 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visiblePacks.map((pack) => (
            <AcademyCard key={pack.id} pack={pack} />
          ))}
        </div>
      </div>
    </section>
  );
}
