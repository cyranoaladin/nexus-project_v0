"use client";

import { useCallback, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  BarChart3,
  BookOpen,
  Check,
  GraduationCap,
  Search,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import {
  type CategoryFilter,
  type Level,
  type Offer,
  CATEGORY_FILTERS,
  getOffersByLevel,
} from "../_data/offers";
import OfferAccordionCard from "./OfferAccordionCard";
import ComparisonStrip from "./ComparisonStrip";
import StageReservationModal from "./StageReservationModal";
import WhiteExamsSidebar from "./WhiteExamsSidebar";

const LEVELS: { id: Level; label: string }[] = [
  { id: "premiere", label: "Première" },
  { id: "terminale", label: "Terminale" },
];

const CATEGORY_META: Record<
  CategoryFilter,
  { icon: React.ElementType; color: string; desc: string }
> = {
  all: { icon: Sparkles, color: "bg-slate-500", desc: "Toutes les formules" },
  mono: { icon: BookOpen, color: "bg-blue-500", desc: "1 matière" },
  duo: { icon: Users, color: "bg-violet-500", desc: "2 matières" },
  trio: { icon: GraduationCap, color: "bg-emerald-500", desc: "Parcours complet" },
};

const REASSURANCE_ITEMS = [
  { icon: Users, label: "Ouverture à partir de 2 ou 3 élèves — groupes limités à 6" },
  { icon: BadgeCheck, label: "Cadre structuré et suivi clair" },
  { icon: BarChart3, label: "Formules progressives et lisibles" },
  { icon: Wallet, label: "Parcours combinés plus avantageux" },
] as const;

export default function OffersSection() {
  const [level, setLevel] = useState<Level>("premiere");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [openOfferId, setOpenOfferId] = useState<string | null>("p-mono-maths");

  const DEFAULT_OPEN: Record<Level, Record<CategoryFilter, string>> = {
    premiere: {
      all: "p-mono-maths",
      mono: "p-mono-maths",
      duo: "p-duo-fr-maths",
      trio: "p-trio-fr-maths-nsi",
    },
    terminale: {
      all: "t-mono-maths",
      mono: "t-mono-maths",
      duo: "t-duo-maths-nsi",
      trio: "t-trio-maths-nsi-go",
    },
  };

  const baseOffers = useMemo(() => getOffersByLevel(level), [level]);

  const filteredOffers = useMemo(() => {
    let list = baseOffers;
    if (category !== "all") {
      list =
        category === "trio"
          ? list.filter((o) => o.category === "trio" || o.category === "complement")
          : list.filter((o) => o.category === category);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((o) => {
        const hay = [o.title, o.badge, o.accrocheCourte, o.subjectKey, o.intro].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [baseOffers, category, query]);

  const handleLevelChange = useCallback(
    (newLevel: Level) => {
      setLevel(newLevel);
      setCategory("all");
      setQuery("");
      setOpenOfferId(DEFAULT_OPEN[newLevel].all);
    },
    []
  );

  const handleCategoryChange = useCallback(
    (newCat: CategoryFilter) => {
      setCategory(newCat);
      const preferred = DEFAULT_OPEN[level][newCat];
      const allOffers = getOffersByLevel(level);
      const filtered =
        newCat === "all"
          ? allOffers
          : newCat === "trio"
          ? allOffers.filter((o) => o.category === "trio" || o.category === "complement")
          : allOffers.filter((o) => o.category === newCat);
      const hasPreferred = filtered.some((o) => o.id === preferred);
      setOpenOfferId(hasPreferred ? preferred : filtered[0]?.id ?? null);
    },
    [level]
  );

  const handleToggle = useCallback((id: string) => {
    setOpenOfferId((prev) => (prev === id ? null : id));
  }, []);

  // ── Reservation modal ──
  const [reservationOffer, setReservationOffer] = useState<Offer | null>(null);
  const [reservationOpen, setReservationOpen] = useState(false);

  const handleReserve = useCallback((offer: Offer) => {
    setReservationOffer(offer);
    setReservationOpen(true);
  }, []);

  return (
    <section id="offres" className="bg-[#0B1018] px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* ── Header ── */}
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
            Formules de préparation
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">
            Choisissez la formule la plus adaptée
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">
            Des formules claires, structurées et plus avantageuses lorsque
            plusieurs matières sont préparées ensemble.
          </p>
        </div>

        {/* ── Filters card ── */}
        <div className="mt-10 rounded-3xl border border-white/10 bg-[#111826] p-6 shadow-xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            {/* Level tabs */}
            <div className="inline-flex rounded-2xl bg-white/[0.04] p-1.5">
              {LEVELS.map((l) => {
                const active = l.id === level;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleLevelChange(l.id)}
                    className={`relative rounded-xl px-6 py-2.5 text-sm font-bold transition-all duration-300 ${
                      active
                        ? "bg-white text-slate-900 shadow-md"
                        : "text-slate-300 hover:text-white"
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="levelIndicator"
                        className="absolute inset-0 rounded-xl bg-white shadow-md"
                        transition={{ type: "spring", stiffness: 300 }}
                      />
                    )}
                    <span className="relative z-10">{l.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher une matière ou formule..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-500 focus:border-emerald-500/40 focus:outline-none"
              />
            </div>
          </div>

          {/* Category pills */}
          <div className="mt-5 flex flex-wrap gap-2">
            {CATEGORY_FILTERS.map((f) => {
              const active = f.id === category;
              const meta = CATEGORY_META[f.id];
              const Icon = meta.icon;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleCategoryChange(f.id)}
                  className={`group relative inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                    active
                      ? "border-transparent text-white"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/15 hover:bg-white/[0.06]"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="categoryIndicator"
                      className={`absolute inset-0 rounded-full ${meta.color}`}
                      transition={{ type: "spring", stiffness: 300 }}
                    />
                  )}
                  <Icon
                    className={`relative z-10 h-4 w-4 ${
                      active ? "text-white" : "text-slate-400"
                    }`}
                  />
                  <span className="relative z-10">{f.label}</span>
                </button>
              );
            })}
          </div>

          {/* Comparison strip */}
          <div className="mt-6">
            <ComparisonStrip />
          </div>
        </div>

        {/* ── Main grid ── */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* Left: offers */}
          <div className="space-y-4">
            {filteredOffers.map((offer) => (
              <OfferAccordionCard
                key={offer.id}
                offer={offer}
                isOpen={openOfferId === offer.id}
                onToggle={() => handleToggle(offer.id)}
                onReserve={handleReserve}
              />
            ))}

            {filteredOffers.length === 0 && (
              <div className="rounded-3xl border border-white/10 bg-[#111826] p-10 text-center text-slate-400">
                Aucune formule ne correspond à votre recherche.
              </div>
            )}
          </div>

          {/* Right: sidebar */}
          <div className="space-y-6">
            <WhiteExamsSidebar level={level} />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="rounded-3xl border border-white/10 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-6"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 shadow-lg">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white">
                Pourquoi choisir un pack ?
              </h3>
              <ul className="mt-4 space-y-3">
                {[
                  "Un seul cadre organisé",
                  "Progression cohérente",
                  "Tarif avantageux",
                  "Suivi global",
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-200">
                    <Check className="h-4 w-4 text-amber-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="rounded-3xl border border-white/10 bg-[#111826] p-6"
            >
              <h3 className="text-lg font-bold text-white">Nos engagements</h3>
              <div className="mt-4 space-y-4">
                {REASSURANCE_ITEMS.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.06]">
                      <Icon className="h-4 w-4 text-emerald-400" />
                    </div>
                    <span className="text-sm text-slate-300">{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── Bottom marketing block ── */}
        <div className="mt-10 rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.05] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="shrink-0 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
              <Sparkles className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-white">
                Pourquoi le pack est plus intéressant ?
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-300">
                Un seul cadre, un seul rythme, une seule organisation de
                travail. Les parcours combinés permettent d&apos;avancer avec plus
                de cohérence, tout en restant plus avantageux que plusieurs
                inscriptions séparées.
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Moins de logistique pour la famille, plus de lisibilité pour
                l&apos;élève.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Reservation modal */}
      <StageReservationModal
        offer={reservationOffer}
        open={reservationOpen}
        setOpen={setReservationOpen}
      />
    </section>
  );
}
