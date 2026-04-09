"use client";

import { useMemo, useState } from "react";
import CTAButton from "@/components/sections/homepage/CTAButton";
import {
  EAF_URL,
  STAGES_URL,
  WHATSAPP_URL,
} from "@/components/sections/homepage/content";
import { cn } from "@/lib/utils";

type Level = "premiere" | "terminale" | null;
type Choice =
  | "francais"
  | "maths"
  | "les-deux"
  | "nsi"
  | null;

type Recommendation = {
  title: string;
  price: string;
  benefit: string;
  href: string;
  cta: string;
  variant: "stage" | "eaf";
  complement?: string;
  description?: string;
};

const choiceButtonBase =
  "rounded-full border px-5 py-3 text-sm font-medium transition-all duration-200";

const activeChoiceClass = "border-nexus-green bg-nexus-green/10 text-white";
const idleChoiceClass =
  "border-white/10 bg-white/4 text-white/70 hover:border-nexus-green/50 hover:text-white";

function getRecommendation(level: Level, choice: Choice): Recommendation | null {
  if (level === "premiere" && choice === "francais") {
    return {
      title: "Plateforme EAF",
      price: "Gratuit pour commencer",
      benefit: "Simulation orale, correction écrite et entraînement quotidien immédiat.",
      href: EAF_URL,
      cta: "Commencer gratuitement",
      variant: "eaf",
      complement: "Complément conseillé : Stage Français 1ère (550 TND).",
    };
  }

  if (level === "premiere" && choice === "maths") {
    return {
      title: "Stage Maths 1ère",
      price: "550 TND",
      benefit: "Consolider les automatismes et préparer les épreuves anticipées avec méthode.",
      href: STAGES_URL,
      cta: "Découvrir les Stages Printemps",
      variant: "stage",
    };
  }

  if (level === "premiere" && choice === "les-deux") {
    return {
      title: "Pack Doublé Anticipé",
      price: "950 TND",
      benefit: "Le meilleur combo pour sécuriser Français + Maths avant les épreuves.",
      href: STAGES_URL,
      cta: "Découvrir les Stages Printemps",
      variant: "stage",
      complement: "Complément conseillé : Plateforme EAF pour l'entraînement quotidien.",
    };
  }

  if (level === "terminale" && choice === "maths") {
    return {
      title: "Stage Maths Terminale",
      price: "690 TND",
      benefit: "Structurer la stratégie de points et consolider les chapitres à fort coefficient.",
      href: STAGES_URL,
      cta: "Découvrir les Stages Printemps",
      variant: "stage",
      complement: "Option recommandée : Grand Oral en add-on à 250 TND.",
    };
  }

  if (level === "terminale" && choice === "nsi") {
    return {
      title: "Pack Full Stack NSI",
      price: "990 TND",
      benefit: "Pack complet pratique + écrit + oral pour sécuriser la séquence NSI la plus risquée.",
      href: STAGES_URL,
      cta: "Découvrir les Stages Printemps",
      variant: "stage",
      complement: "Grand Oral inclus.",
    };
  }

  if (level === "terminale" && choice === "les-deux") {
    return {
      title: "Programme sur mesure",
      price: "Sur diagnostic",
      benefit: "On construit le bon mix Maths + NSI selon les échéances, le niveau et le budget.",
      href: WHATSAPP_URL,
      cta: "Contacter sur WhatsApp",
      variant: "stage",
      description: "Contact direct recommandé pour un programme personnalisé.",
    };
  }

  return null;
}

export default function DecisionHelper() {
  const [level, setLevel] = useState<Level>(null);
  const [choice, setChoice] = useState<Choice>(null);

  const recommendation = useMemo(() => getRecommendation(level, choice), [choice, level]);

  const resetChoice = () => setChoice(null);
  const showRecommendation = Boolean(level && choice && recommendation);

  return (
    <section className="bg-nexus-bg px-6 py-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-5xl rounded-[28px] border border-white/8 bg-white/[0.025] p-6 sm:p-8 lg:p-10">
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/45">
            Aide au choix
          </p>
          <h2 className="mt-4 font-display text-h2 font-bold text-white">
            Quelle solution pour votre enfant ?
          </h2>
          <p className="mt-4 text-base leading-8 text-white/58">
            Répondez en 10 secondes pour savoir par où commencer.
          </p>
        </div>

        <div className="mt-8 rounded-[24px] border border-white/8 bg-nexus-bg-alt/70 p-5 sm:p-6">
          {!level && (
            <div className="space-y-5 opacity-100 transition-all duration-200">
              <p className="text-sm font-medium text-white/72">Votre enfant est en :</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  className={cn(choiceButtonBase, idleChoiceClass)}
                  onClick={() => setLevel("premiere")}
                >
                  Première
                </button>
                <button
                  type="button"
                  className={cn(choiceButtonBase, idleChoiceClass)}
                  onClick={() => setLevel("terminale")}
                >
                  Terminale
                </button>
              </div>
            </div>
          )}

          {level === "premiere" && !choice && (
            <div className="space-y-5 opacity-100 transition-all duration-200">
              <button type="button" onClick={() => setLevel(null)} className="text-sm text-white/45 hover:text-white" aria-label="Retour">
                ← Retour
              </button>
              <p className="text-sm font-medium text-white/72">Son besoin principal :</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {[
                  { id: "francais", label: "Bac de Français (écrit + oral)" },
                  { id: "maths", label: "Maths" },
                  { id: "les-deux", label: "Les deux" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setChoice(option.id as Choice)}
                    className={cn(
                      choiceButtonBase,
                      choice === option.id ? activeChoiceClass : idleChoiceClass
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {level === "terminale" && !choice && (
            <div className="space-y-5 opacity-100 transition-all duration-200">
              <button type="button" onClick={() => setLevel(null)} className="text-sm text-white/45 hover:text-white" aria-label="Retour">
                ← Retour
              </button>
              <p className="text-sm font-medium text-white/72">Sa spécialité :</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {[
                  { id: "maths", label: "Maths" },
                  { id: "nsi", label: "NSI" },
                  { id: "les-deux", label: "Les deux" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setChoice(option.id as Choice)}
                    className={cn(
                      choiceButtonBase,
                      choice === option.id ? activeChoiceClass : idleChoiceClass
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showRecommendation && recommendation && (
            <div className="space-y-5 opacity-100 transition-all duration-200">
              <button
                type="button"
                onClick={resetChoice}
                className="text-sm text-white/45 hover:text-white"
                aria-label="Retour"
              >
                ← Retour
              </button>

              <div className="rounded-[22px] border border-white/8 bg-white/[0.03] p-6">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-white/45">
                  Recommandation personnalisée
                </p>
                <h3
                  className={cn(
                    "mt-3 font-display text-3xl font-bold",
                    recommendation.variant === "eaf" ? "text-nexus-purple" : "text-nexus-green"
                  )}
                >
                  {recommendation.title}
                </h3>
                <p className="mt-2 font-mono text-sm uppercase tracking-[0.12em] text-white/45">
                  {recommendation.price}
                </p>
                <p className="mt-4 text-base leading-7 text-white/70">{recommendation.benefit}</p>
                {recommendation.complement && (
                  <p className="mt-3 text-sm text-white/50">{recommendation.complement}</p>
                )}
                {recommendation.description && (
                  <p className="mt-3 text-sm text-white/50">{recommendation.description}</p>
                )}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <CTAButton
                    href={recommendation.href}
                    variant={recommendation.variant === "eaf" ? "eaf" : "stage"}
                  >
                    {recommendation.cta}
                  </CTAButton>
                  <CTAButton href={WHATSAPP_URL} variant="stage-outline">
                    📞 Consultation gratuite
                  </CTAButton>
                </div>

                <a href="/stages#tarifs" className="mt-5 inline-flex text-sm text-white/55 hover:text-white">
                  Voir toutes les formules →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
