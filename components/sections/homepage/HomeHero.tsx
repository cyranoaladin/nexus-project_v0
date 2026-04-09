import CTAButton from "@/components/sections/homepage/CTAButton";
import {
  EAF_URL,
  STAGES_URL,
} from "@/components/sections/homepage/content";

const reassuranceItems = [
  "✓ 6 élèves max par groupe",
  "✓ Enseignants agrégés",
  "✓ Freemium sans carte bancaire",
  "✓ Sources BO 2026",
];

export default function HomeHero() {
  return (
    <section id="hero" className="relative overflow-hidden bg-nexus-bg px-6 pb-20 pt-28 sm:px-8 sm:pt-32 lg:px-12 lg:pb-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(167,139,250,0.14),transparent_30%)]" />
      <div className="absolute inset-0 opacity-[0.14]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "42px 42px" }} />

      <div className="relative mx-auto flex min-h-[calc(100vh-var(--promo-banner-offset,0px)-64px)] max-w-7xl items-center">
        <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] text-neutral-300">
            L'excellence pédagogique augmentée par l'Intelligence Artificielle
          </div>

          <h1 className="mt-6 font-display text-hero font-bold leading-[0.96] text-white">
            Nexus Réussite,
            <br />
            le déclic vers ta réussite !
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-white/55 sm:text-lg">
            Stages intensifs, plateforme IA, enseignants agrégés. Deux solutions complémentaires pour viser la mention au Bac — Première & Terminale.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <CTAButton href={STAGES_URL} variant="stage">
              Découvrir les Stages Printemps →
            </CTAButton>
            <CTAButton href={EAF_URL} variant="eaf-outline">
              Essayer la plateforme EAF gratuitement
            </CTAButton>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm text-white/68">
            {reassuranceItems.map((item) => (
              <span key={item} className="font-body">
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
