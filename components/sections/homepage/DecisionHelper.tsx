"use client";

import { useMemo, useState } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import CTAButton from "@/components/sections/homepage/CTAButton";
import {
  EAF_URL,
  STAGES_URL,
  WHATSAPP_URL,
} from "@/components/sections/homepage/content";
import { cn } from "@/lib/utils";

type Need = "suivi" | "stage" | "eaf" | "objectif" | null;

type Recommendation = {
  title: string;
  eyebrow: string;
  benefit: string;
  href: string;
  cta: string;
  variant: "stage" | "eaf";
  complement?: string;
};

const choiceButtonBase =
  "cursor-pointer rounded-full border px-5 py-3 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d73] focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const activeChoiceClass = "border-[#0f3d73] bg-[#0f3d73] text-white";
const idleChoiceClass =
  "border-slate-200 bg-white text-slate-700 hover:border-[#0f3d73]/35 hover:bg-[#eff6ff] hover:text-[#0f2f57]";

function getRecommendation(need: Need): Recommendation | null {
  if (need === "suivi") {
    return {
      title: "Cours hebdomadaires & suivi personnalisé",
      eyebrow: "Pour progresser toute l'année.",
      benefit:
        "Installez un rythme régulier avec des objectifs clairs, un suivi parent et un accompagnement ajusté au niveau de l'élève.",
      href: WHATSAPP_URL,
      cta: "Demander un diagnostic",
      variant: "eaf",
      complement: "Recommandé si le besoin dépasse une échéance ponctuelle.",
    };
  }

  if (need === "stage") {
    return {
      title: "Stages intensifs de vacances",
      eyebrow: "Pour accélérer sur une période courte.",
      benefit:
        "Un cadre resserré pour consolider, préparer une épreuve ou reprendre confiance avant la reprise.",
      href: STAGES_URL,
      cta: "Voir les stages",
      variant: "stage",
      complement: "Les stages complètent le suivi annuel ou un pack objectif.",
    };
  }

  if (need === "eaf") {
    return {
      title: "Plateforme EAF & préparation Bac de français",
      eyebrow: "Écrit, oral, autonomie et progression.",
      benefit:
        "EAF signifie Épreuves anticipées de français : l'élève travaille l'écrit et l'oral avec quiz adaptatifs, entraînements guidés et tableau de bord.",
      href: EAF_URL,
      cta: "Accéder à la plateforme",
      variant: "eaf",
      complement: "Freemium disponible pour démarrer sans friction.",
    };
  }

  if (need === "objectif") {
    return {
      title: "Pack objectif",
      eyebrow: "Mention, remise à niveau ou excellence.",
      benefit:
        "Construisez un parcours ciblé autour d'un objectif : mathématiques, NSI, Grand Oral, EAF ou stratégie de mention.",
      href: WHATSAPP_URL,
      cta: "Construire mon pack",
      variant: "eaf",
      complement: "Contact direct conseillé pour cadrer le niveau, l'objectif et le calendrier.",
    };
  }

  return null;
}

export default function DecisionHelper() {
  const [need, setNeed] = useState<Need>(null);
  const recommendation = useMemo(() => getRecommendation(need), [need]);

  return (
    <section className="bg-white px-6 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl rounded-[28px] border border-slate-200 bg-[#f8fbff] p-6 shadow-sm sm:p-8 lg:p-10">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#0f3d73]">
            Aide au choix
          </p>
          <h2 className="mt-4 font-display text-h2 font-bold text-[#0f2f57]">
            Quelle formule Nexus Réussite correspond à votre enfant ?
          </h2>
          <p className="mt-4 text-base leading-8 text-slate-700">
            En 10 secondes, identifiez le bon point d'entrée : cours hebdomadaires, stage intensif, plateforme EAF ou pack ciblé.
          </p>
        </div>

        <div className="mt-8 rounded-[24px] border border-slate-200 bg-white p-5 sm:p-6">
          <p className="text-sm font-medium text-slate-700">Votre priorité aujourd'hui :</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {[
              { id: "suivi", label: "Suivi toute l'année" },
              { id: "stage", label: "Stage de vacances" },
              { id: "eaf", label: "Préparation EAF" },
              { id: "objectif", label: "Pack objectif" },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setNeed(option.id as Need)}
                className={cn(
                  choiceButtonBase,
                  need === option.id ? activeChoiceClass : idleChoiceClass
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {recommendation && (
            <div className="mt-6 rounded-[22px] border border-[#0f3d73]/12 bg-[#eff6ff] p-6">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#0f3d73]">
                {recommendation.eyebrow}
              </p>
              <h3 className="mt-3 font-display text-3xl font-bold text-[#0f2f57]">
                {recommendation.title}
              </h3>
              <p className="mt-4 text-base leading-7 text-slate-700">{recommendation.benefit}</p>
              {recommendation.complement && (
                <p className="mt-3 text-sm text-slate-600">{recommendation.complement}</p>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <CTAButton
                  href={recommendation.href}
                  variant={recommendation.variant === "eaf" ? "eaf" : "stage"}
                >
                  {recommendation.cta}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </CTAButton>
                <CTAButton href={WHATSAPP_URL} variant="eaf-outline">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  Demander conseil
                </CTAButton>
              </div>

              <a
                href={STAGES_URL}
                className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[#9f1239] underline-offset-4 transition hover:text-[#7f1d1d] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f3d73] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eff6ff]"
              >
                Voir les stages intensifs
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
