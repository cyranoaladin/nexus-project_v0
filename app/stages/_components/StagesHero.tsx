import { ArrowRight, MessageCircle, ShieldCheck } from "lucide-react";

import CountdownChip from "./CountdownChip";
import CTAButton from "./CTAButton";
import { TARGET_DATES, WHATSAPP_URL } from "../_lib/constants";

export default function StagesHero() {
  return (
    <section className="relative overflow-hidden bg-nexus-bg px-4 pb-24 pt-20 sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(16,185,129,0.13),transparent_42%),radial-gradient(ellipse_at_80%_70%,rgba(245,158,11,0.07),transparent_32%)]" />
      <div className="absolute inset-0 opacity-[0.1] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative mx-auto max-w-5xl text-center">
        {/* Badge contextuel */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-full border border-nexus-green/22 bg-white/[0.08] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-slate-200">
            Stages Printemps 2026 · 18 avril — 2 mai · Tunis
          </span>
          <CountdownChip
            targetDate={TARGET_DATES.stage_start.toISOString()}
            label="avant le départ"
            tone="amber"
          />
        </div>

        {/* Titre */}
        <h1 className="mx-auto max-w-4xl font-display text-hero font-extrabold leading-[0.95] text-white">
          Préparez les échéances de mai et juin avec méthode, exigence et un cadre qui fait
          vraiment travailler.
        </h1>

        {/* Sous-titre */}
        <p className="mx-auto mt-7 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg">
          Des groupes de 6 élèves maximum. Des intervenants du système français. Des entraînements
          corrigés, des épreuves blanches et un plan de révision final.
        </p>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <CTAButton href="#offres" className="sm:min-w-[260px]">
            Voir les formules disponibles
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </CTAButton>
          <CTAButton href={WHATSAPP_URL} external variant="outline" className="sm:min-w-[240px]">
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Nous contacter sur WhatsApp
          </CTAButton>
        </div>

        {/* Réassurance */}
        <div className="mx-auto mt-10 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl border border-white/8 bg-white/[0.06] px-6 py-4 text-sm text-slate-300">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-nexus-green" aria-hidden="true" />
            6 élèves maximum
          </span>
          <span className="hidden h-1 w-1 rounded-full bg-white/18 sm:block" aria-hidden="true" />
          <span>Épreuves blanches incluses</span>
          <span className="hidden h-1 w-1 rounded-full bg-white/18 sm:block" aria-hidden="true" />
          <span>Bilan individualisé</span>
          <span className="hidden h-1 w-1 rounded-full bg-white/18 sm:block" aria-hidden="true" />
          <span>Places limitées — inscription dans l'ordre d'arrivée</span>
        </div>
      </div>
    </section>
  );
}
