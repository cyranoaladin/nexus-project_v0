"use client";

import { useMemo, useState } from "react";

import { PACKS } from "../_data/packs";
import AcademyCard from "./AcademyCard";

type Filter = "all" | "premiere" | "terminale" | "packs";

const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "premiere", label: "Première" },
  { id: "terminale", label: "Terminale" },
  { id: "packs", label: "Packs" },
];

export default function AcademiesSection() {
  const [activeFilter, setActiveFilter] = useState<Filter>("all");

  const visiblePacks = useMemo(() => {
    switch (activeFilter) {
      case "premiere":
        return PACKS.filter((pack) => pack.subtitle.startsWith("PREMIÈRE"));
      case "terminale":
        return PACKS.filter((pack) => pack.subtitle.startsWith("TERMINALE"));
      case "packs":
        return PACKS.filter(
          (pack) => pack.highlight || pack.isAddOn || pack.id.includes("combo") || pack.id.includes("fullstack")
        );
      default:
        return PACKS;
    }
  }, [activeFilter]);

  return (
    <section id="academies" className="bg-nexus-bg-alt px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/42">
            Nos Académies de Printemps
          </p>
          <h2 className="mt-3 font-display text-h2 font-bold text-white">
            Programmes millimétrés pour mai et juin. Solo, combo ou full pack.
          </h2>
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
