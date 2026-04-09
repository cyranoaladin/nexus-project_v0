import CTAButton from "@/components/sections/homepage/CTAButton";
import CountdownChip from "@/components/sections/homepage/CountdownChip";
import { BookOpen, CalendarRange, Check, Lightbulb, Sparkles } from "lucide-react";
import {
  COMPARISON_ROWS,
  EAF_EXAM_DATE,
  EAF_URL,
  STAGES_URL,
  STAGE_START_DATE,
} from "@/components/sections/homepage/content";

const stageFeatures = [
  "Maths, Français, NSI, Grand Oral",
  "6 élèves max — enseignants agrégés & certifiés",
  "Épreuves blanches + bilan individualisé inclus",
  "À partir de 550 TND (25 TND/h — 38% moins cher que le marché)",
];

const stagePills = [
  "Première (EAF + Maths)",
  "Terminale Maths",
  "Terminale NSI",
  "Grand Oral",
];

const eafFeatures = [
  "Simulation orale notée /2 /8 /2 /8 au barème officiel",
  "Correction écrite en 3 min — feedback critérié",
  "Sources certifiées : BO 2026, Eduscol, rapports de jury",
  "Freemium illimité — 0 TND pour commencer, sans carte bancaire",
];

const eafPills = [
  "Première (système français)",
  "Réseau AEFE",
  "Candidats libres",
  "Parents (suivi)",
];

function OfferCard({
  theme,
  children,
}: {
  theme: "stage" | "eaf";
  children: React.ReactNode;
}) {
  const themeClasses =
    theme === "stage"
      ? "border-nexus-green/20 bg-nexus-green/[0.03] shadow-[0_20px_60px_rgba(16,185,129,0.08)]"
      : "border-nexus-purple/20 bg-nexus-purple/[0.03] shadow-[0_20px_60px_rgba(167,139,250,0.08)]";

  return (
    <article
      className={`flex h-full flex-col rounded-[28px] border p-7 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl ${themeClasses}`}
    >
      {children}
    </article>
  );
}

export default function FlagshipOffers() {
  return (
    <section id="offres" className="bg-nexus-bg-alt px-6 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/45">
            En ce moment chez Nexus Réussite
          </p>
          <h2 className="mt-4 font-display text-h2 font-bold text-white">
            En ce moment chez Nexus Réussite
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/55">
            Deux solutions conçues pour les épreuves de mai et juin 2026. Complémentaires ou indépendantes.
          </p>
        </div>

        <div className="mt-10 grid items-stretch gap-6 lg:grid-cols-2">
          <OfferCard theme="stage">
            <div className="flex items-start justify-between gap-4">
              <span className="rounded-full bg-nexus-green/12 px-3 py-1 text-xs font-mono uppercase tracking-[0.16em] text-nexus-green">
                <span className="inline-flex items-center gap-2">
                  <CalendarRange className="h-3.5 w-3.5" aria-hidden="true" />
                  Stages
                </span>
              </span>
              <CountdownChip targetDate={STAGE_START_DATE} label="avant le début" tone="stage" />
            </div>

            <h3 className="mt-6 font-display text-3xl font-bold text-white">
              <span className="inline-flex items-center gap-3">
                <CalendarRange className="h-8 w-8 text-nexus-green" aria-hidden="true" />
                Stages de Printemps 2026
              </span>
            </h3>
            <p className="mt-2 font-mono text-sm uppercase tracking-[0.14em] text-white/45">
              18 Avril — 02 Mai • Première & Terminale
            </p>
            <p className="mt-5 text-lg text-white/80">
              La dernière ligne droite vers la mention. On ne révise plus, on valide.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-white/70">
              {stageFeatures.map((feature) => (
                <li key={feature} className="flex gap-3">
                  <Check className="mt-0.5 h-4 w-4 text-nexus-green" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap gap-2">
              {stagePills.map((pill) => (
                <span
                  key={pill}
                  className="rounded-full bg-nexus-green/8 px-3 py-1 text-xs text-nexus-green"
                >
                  {pill}
                </span>
              ))}
            </div>

            <div className="mt-auto pt-8">
              <CTAButton href={STAGES_URL} variant="stage" fullWidth>
                Découvrir les Stages et Réserver →
              </CTAButton>
              <p className="mt-3 text-sm text-white/45">
                Places limitées à 6 par groupe. Consultation gratuite sur WhatsApp.
              </p>
            </div>
          </OfferCard>

          <OfferCard theme="eaf">
            <div className="flex items-start justify-between gap-4">
              <span className="rounded-full bg-nexus-purple/12 px-3 py-1 text-xs font-mono uppercase tracking-[0.16em] text-nexus-purple">
                <span className="inline-flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  Plateforme EAF
                </span>
              </span>
              <CountdownChip targetDate={EAF_EXAM_DATE} label="avant l'épreuve EAF" tone="eaf" />
            </div>

            <h3 className="mt-6 font-display text-3xl font-bold text-white">
              <span className="inline-flex items-center gap-3">
                <Sparkles className="h-8 w-8 text-nexus-purple" aria-hidden="true" />
                Nexus Réussite — Préparation EAF
              </span>
            </h3>
            <p className="mt-2 font-mono text-sm uppercase tracking-[0.14em] text-white/45">
              Bac de Français 2026 • Oral + Écrit + Langue
            </p>
            <p className="mt-5 text-lg text-white/80">
              L'IA qui t'entraîne sans jamais rédiger à ta place. Anti-copie par design.
            </p>

            <ul className="mt-6 space-y-3 text-sm text-white/70">
              {eafFeatures.map((feature) => (
                <li key={feature} className="flex gap-3">
                  <Check className="mt-0.5 h-4 w-4 text-nexus-purple" aria-hidden="true" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 flex flex-wrap gap-2">
              {eafPills.map((pill) => (
                <span
                  key={pill}
                  className="rounded-full bg-nexus-purple/8 px-3 py-1 text-xs text-nexus-purple"
                >
                  {pill}
                </span>
              ))}
            </div>

            <div className="mt-auto pt-8">
              <CTAButton href={EAF_URL} variant="eaf" fullWidth>
                Commencer gratuitement — 3 min →
              </CTAButton>
              <p className="mt-3 text-sm text-white/45">
                Pas de carte bancaire. Freemium illimité en temps.
              </p>
            </div>
          </OfferCard>
        </div>

        <div className="mt-8 rounded-[24px] border border-white/8 bg-white/[0.015] p-5 hidden lg:block">
          <table className="w-full table-fixed border-separate border-spacing-y-2 text-left text-sm text-white/70">
            <thead>
              <tr className="text-xs uppercase tracking-[0.16em] text-white/35">
                <th className="pb-3"> </th>
                <th className="pb-3">Stages Printemps</th>
                <th className="pb-3">Plateforme EAF</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.label} className="border-t border-white/5">
                  <td className="py-2 font-mono text-xs uppercase tracking-[0.12em] text-white/40">
                    {row.label}
                  </td>
                  <td className="py-2 text-white/78">{row.stages}</td>
                  <td className="py-2 text-white/78">{row.eaf}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-5 text-sm text-white/60">
          <span className="inline-flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-nexus-amber" aria-hidden="true" />
            Les deux se complètent parfaitement : le stage pour la structure et l'intensif, la plateforme pour l'entraînement quotidien.
          </span>
        </p>
      </div>
    </section>
  );
}
