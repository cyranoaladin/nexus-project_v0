import Image from "next/image";
import CTAButton from "@/components/sections/homepage/CTAButton";
import { ArrowRight, BookOpenCheck, Check, GraduationCap, MapPin } from "lucide-react";
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
    <section id="hero" className="relative overflow-hidden bg-[#f8fbff] px-6 pb-20 pt-28 sm:px-8 sm:pt-32 lg:px-12 lg:pb-28">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(239,246,255,0.95),rgba(255,255,255,0.98)_48%,rgba(255,241,242,0.65))]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-white" />

      <div className="relative mx-auto grid min-h-[calc(100vh-var(--promo-banner-offset,0px)-64px)] max-w-7xl items-center gap-12 lg:grid-cols-[0.98fr_1.02fr]">
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

          <div className="mt-7 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
            {reassuranceItems.map((item) => (
              <span key={item} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 font-body shadow-sm">
                <Check className="h-4 w-4 text-[#0f3d73]" aria-hidden="true" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="overflow-hidden rounded-[32px] border border-white bg-white shadow-2xl shadow-slate-200/80">
            <div className="relative aspect-[4/3] min-h-[360px]">
              <Image
                src="/images/hero-image.png"
                alt="Élève accompagné dans un cadre de travail premium Nexus Réussite"
                fill
                sizes="(min-width: 1024px) 48vw, 100vw"
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f2f57]/72 via-[#0f2f57]/10 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 rounded-3xl border border-white/20 bg-white/92 p-4 shadow-xl backdrop-blur-md sm:p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0f3d73]">
                  Parcours Nexus Réussite
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    { icon: GraduationCap, label: "Cours", value: "Hebdo" },
                    { icon: BookOpenCheck, label: "Objectif", value: "Packs" },
                    { icon: MapPin, label: "Centre", value: "Tunis" },
                  ].map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div key={item.label} className="rounded-2xl bg-[#f8fbff] p-3">
                        <ItemIcon className="h-4 w-4 text-[#0f3d73]" aria-hidden="true" />
                        <p className="mt-3 text-xl font-bold text-[#0f2f57]">{item.value}</p>
                        <p className="text-xs text-slate-500">{item.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="border-t border-slate-100 px-5 py-4 text-sm leading-6 text-slate-700">
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
