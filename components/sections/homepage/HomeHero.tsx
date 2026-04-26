import CTAButton from "@/components/sections/homepage/CTAButton";
import { ArrowRight, BarChart3, BookOpenCheck, Check, Mic2, PenLine } from "lucide-react";
import {
  EAF_URL,
  STAGES_URL,
  WHATSAPP_URL,
} from "@/components/sections/homepage/content";

const reassuranceItems = [
  "Cours hebdomadaires toute l'année",
  "Stages intensifs pendant les vacances",
  "Packs par objectif",
  "Plateforme numérique associée",
];

export default function HomeHero() {
  return (
    <section id="hero" className="relative overflow-hidden bg-[#f7fbff] px-6 pb-16 pt-28 sm:px-8 sm:pt-32 lg:px-12 lg:pb-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(219,234,254,0.92),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(254,242,242,0.82),transparent_28%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-white" />

      <div className="relative mx-auto grid min-h-[calc(100vh-var(--promo-banner-offset,0px)-64px)] max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex rounded-full border border-[#0f3d73]/15 bg-white px-4 py-2 text-xs font-mono uppercase tracking-[0.14em] text-[#0f3d73] shadow-sm">
            Académie premium · Cours · Stages · Suivi
          </div>

          <h1 className="mt-6 max-w-4xl font-display text-hero font-bold leading-[0.96] text-[#0f2f57]">
            Accompagner chaque élève vers la réussite, toute l'année.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-700 sm:text-lg">
            Nexus Réussite réunit cours hebdomadaires, stages intensifs, packs ciblés, préparation EAF, mathématiques, NSI, Grand Oral, plateforme numérique et suivi personnalisé dans un cadre premium et rassurant.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <CTAButton href={WHATSAPP_URL} variant="eaf">
              Trouver la bonne formule
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </CTAButton>
            <CTAButton href={STAGES_URL} variant="stage">
              Voir les stages
            </CTAButton>
          </div>

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm text-slate-700">
            {reassuranceItems.map((item) => (
              <span key={item} className="inline-flex items-center gap-2 font-body">
                <Check className="h-4 w-4 text-[#0f3d73]" aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="rounded-[28px] border border-[#0f3d73]/10 bg-white p-5 shadow-xl shadow-slate-200/70 sm:p-6">
            <div className="rounded-2xl bg-[#0f3d73] p-5 text-white">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-blue-100">
                Parcours Nexus Réussite
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: PenLine, label: "Cours", value: "Hebdo" },
                  { icon: Mic2, label: "Objectif", value: "Pack" },
                  { icon: BookOpenCheck, label: "Suivi", value: "Clair" },
                ].map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={item.label} className="rounded-2xl bg-white/10 p-4">
                      <ItemIcon className="h-5 w-5 text-blue-100" aria-hidden="true" />
                      <p className="mt-4 text-2xl font-bold">{item.value}</p>
                      <p className="text-xs text-blue-100">{item.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {[
                "Mathématiques : automatismes et chapitres à sécuriser",
                "EAF : Épreuves anticipées de français, écrit + oral",
                "Grand Oral / NSI : entraînement ciblé avant l'échéance",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <BarChart3 className="h-4 w-4 text-[#0f3d73]" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
              Plateforme EAF disponible en complément : entraînement autonome, quiz adaptatifs et tableau de bord de progression.
              <a href={EAF_URL} className="ml-1 font-semibold text-[#0f3d73] underline-offset-4 hover:underline">
                Accéder à l'outil numérique
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
