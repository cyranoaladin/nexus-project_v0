"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Mic,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { BackToTop } from "@/components/ui/back-to-top";
import { track } from "@/lib/analytics";

const packs = [
  {
    badgeLabel: "Essentiel pour le Bac",
    badgeIcon: Mic,
    title: "Pack Grand Oral",
    price: "300",
    duration: "8 heures intensives",
    features: [
      "Techniques de prise de parole",
      "Construction d'exposé structuré",
      "Gestion du stress et de la voix",
      "Simulations d'oraux blancs",
      "Feedback personnalisé",
    ],
    expert: { name: "Athéna", role: "Stratège du Bac et de l'Éloquence" },
    cta: "Ajouter à mon programme",
  },
  {
    badgeLabel: "Pour l'orientation",
    badgeIcon: Target,
    title: "Pack Parcoursup",
    price: "450",
    duration: "6 heures stratégiques",
    features: [
      "Analyse de profil personnalisée",
      "Stratégie de choix d'orientation",
      "Rédaction CV et lettre de motivation",
      "Préparation aux entretiens",
      "Simulation de jury",
    ],
    expert: { name: "Orion", role: "Conseiller d'Orientation" },
    cta: "Ajouter à mon programme",
  },
  {
    badgeLabel: "Accélération",
    badgeIcon: Zap,
    title: "Académie Intensive",
    price: "750",
    duration: "15 heures en vacances",
    features: [
      "Stage pendant vacances scolaires",
      "Maximum 6 élèves par groupe",
      "Focus sur chapitres clés",
      "Examens blancs corrigés",
      "Suivi post-stage inclus",
    ],
    extra: [
      "Toussaint : Méthodologie",
      "Hiver : Révisions intensives",
      "Printemps : Préparation Bac",
    ],
    cta: "Voir le calendrier",
  },
  {
    badgeLabel: "IA avancée",
    badgeIcon: Bot,
    title: "ARIA+ Premium Seul",
    price: "50",
    duration: "Accès illimité",
    features: [
      "Toutes matières (tronc commun inclus)",
      "Correction exercices avancée",
      "Simulateur d'oral",
      "Analyses de textes IA",
      "Support prioritaire",
    ],
    note: "Inclus gratuitement dans nos programmes principaux",
    cta: "Essayer 7 jours gratuits",
  },
];

const comparisonRows = [
  {
    label: "Expertise enseignants",
    prof: "Aléatoire",
    nexus: "100% Agrégés et Certifiés",
    other: "Variable",
  },
  {
    label: "Disponibilité",
    prof: "Heures fixes",
    nexus: "24/7 avec IA ARIA",
    other: "Forum asynchrone",
  },
  {
    label: "Suivi parents",
    prof: "Aucun dashboard",
    nexus: "Dashboard temps réel",
    other: "Partiel",
  },
  {
    label: "Garantie résultats",
    prof: "Aucune",
    nexus: "Mention ou mois offerts",
    other: "Limitée",
  },
  {
    label: "Coaching Parcoursup",
    prof: "Non inclus",
    nexus: "Inclus",
    other: "En option",
  },
  {
    label: "ROI estimé",
    prof: "Faible",
    nexus: "Excellent",
    other: "Moyen",
  },
];

const quizSteps = [
  {
    question: "Votre enfant est :",
    options: [
      { value: "scolarise", label: "Scolarisé en lycée français" },
      { value: "candidat", label: "Candidat libre" },
      { value: "autre", label: "Autre situation" },
    ],
  },
  {
    question: "Son objectif principal est :",
    options: [
      { value: "bac", label: "Réussir le Bac" },
      { value: "mention", label: "Obtenir une mention" },
      { value: "parcoursup", label: "Réussir Parcoursup" },
      { value: "combine", label: "Tout cela à la fois" },
    ],
  },
  {
    question: "Son principal défi est :",
    options: [
      { value: "methodo", label: "Méthodologie" },
      { value: "comprehension", label: "Compréhension" },
      { value: "temps", label: "Manque de temps" },
      { value: "confiance", label: "Manque de confiance" },
    ],
  },
];

export default function OffresPage() {
  const [currentSolution, setCurrentSolution] = useState("rien");
  const [hours, setHours] = useState(10);
  const [goal, setGoal] = useState("mention");
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [recommendedPlan, setRecommendedPlan] = useState<string | null>(null);

  // Track offer page view on mount
  useEffect(() => {
    track.offerView(document.referrer || undefined);
  }, []);

  const currentMonthly = useMemo(() => {
    if (currentSolution === "prof") return 60 * hours;
    if (currentSolution === "groupe") return 40 * hours;
    return 0;
  }, [currentSolution, hours]);

  const nexusMonthly = 450;
  const savings = Math.max(currentMonthly - nexusMonthly, 0);
  const savingsPercent = currentMonthly ? Math.round((savings / currentMonthly) * 100) : 0;

  const recommendationMap: Record<string, string> = {
    "scolarise-bac-methodo": "Formule Hybride (450 TND/mois)",
    "scolarise-bac-comprehension": "Formule Hybride + Pack Grand Oral",
    "scolarise-mention-methodo": "Formule Immersion (750 TND/mois)",
    "scolarise-mention-comprehension": "Formule Immersion + Pack Grand Oral",
    "candidat-bac-methodo": "Formule Immersion (750 TND/mois)",
    "candidat-bac-comprehension": "Formule Immersion + Académie Intensive",
    "candidat-mention-methodo": "Formule Immersion + Pack Grand Oral",
    "candidat-mention-comprehension": "Formule Immersion + Pack Parcoursup",
  };

  const quizKey = useMemo(() => {
    const [statut, objectif, defi] = quizAnswers;
    if (!statut || !objectif || !defi) return "";
    return `${statut}-${objectif}-${defi}`;
  }, [quizAnswers]);

  const quizRecommendation = recommendationMap[quizKey] || "Programme Excellence";

  const handleQuiz = (value: string) => {
    const updated = [...quizAnswers];
    updated[quizStep] = value;
    setQuizAnswers(updated);
    setSelectedOption(value);
    if (quizStep < quizSteps.length - 1) {
      setTimeout(() => {
        setQuizStep(quizStep + 1);
        setSelectedOption(null);
      }, 350);
    } else {
      setTimeout(() => {
        setQuizStep(quizSteps.length);
        setSelectedOption(null);
        // Track quiz completion with all answers and recommendation
        const finalAnswers = [...quizAnswers];
        finalAnswers[quizStep] = value;
        const key = finalAnswers.join('-');
        const rec = recommendationMap[key] || 'Programme Excellence';
        track.quizComplete(finalAnswers, rec);
      }, 350);
    }
  };

  const resetQuiz = () => {
    setQuizStep(0);
    setQuizAnswers([]);
    setSelectedOption(null);
  };

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-200">
      <CorporateNavbar />

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden py-20">
          <div className="absolute inset-0 bg-gradient-to-b from-surface-darker via-surface-darker/70 to-surface-darker" />
          <div className="absolute -top-10 right-10 h-72 w-72 rounded-full bg-brand-accent/10 blur-[140px]" />
          <div className="container relative z-10 mx-auto px-4 md:px-6">
            <div className="text-center">
              <h1 className="marketing-hero-title">
                Investissez dans la seule garantie de réussite au Bac.
              </h1>
              <p className="marketing-hero-copy">
                Un prix unique, tout inclus. Expertise humaine + IA 24/7 + Garantie Mention.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/bilan-gratuit"
                  className="btn-primary"
                >
                  Démarrer un bilan gratuit
                </Link>
                <a
                  href="#offres-principales"
                  className="btn-outline-strong"
                >
                  Voir les formules
                </a>
                <Link
                  href="/contact"
                  className="btn-outline"
                >
                  Parler à un expert
                </Link>
              </div>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Lycée français",
                  text: "Suivi régulier + méthode pour viser la mention",
                  anchor: "#offres-principales",
                  badge: "Plus choisi",
                },
                {
                  title: "Candidat libre",
                  text: "Cadre structuré pour rattraper et performer",
                  anchor: "#offres-principales",
                },
                {
                  title: "Parent indécis",
                  text: "Commencez par un bilan gratuit",
                  anchor: "#bilan-start",
                },
              ].map((item) => (
                <a
                  key={item.title}
                  href={item.anchor}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition hover:border-brand-accent/40 hover:bg-white/10"
                >
                  {item.badge && (
                    <span className="marketing-badge border border-brand-accent/40 bg-brand-accent/10 text-brand-accent normal-case">
                      {item.badge}
                    </span>
                  )}
                  <h3 className="mt-4 text-xl font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-neutral-300">{item.text}</p>
                  <div className="mt-4 inline-flex items-center text-sm font-semibold text-brand-accent">
                    Voir ma solution <ChevronRight className="ml-1 h-4 w-4" />
                  </div>
                </a>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-neutral-300">
              <a href="#offres-principales" className="hover:text-white">
                Offres principales
              </a>
              <span>•</span>
              <a href="#packs-specialises" className="hover:text-white">
                Packs à la carte
              </a>
              <span>•</span>
              <a href="#garanties" className="hover:text-white">
                Nos garanties
              </a>
              <span>•</span>
              <a href="#faq" className="hover:text-white">
                FAQ
              </a>
            </div>
          </div>
        </section>

        {/* CHOISIR EN 3 ÉTAPES */}
        <section id="bilan-start" className="py-12">
          <div className="container mx-auto px-4 md:px-6">
            <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <h3 className="text-xl font-semibold text-white">Recommandation rapide</h3>
              <p className="mt-2 text-sm text-neutral-300">
                Sélectionnez votre profil pour voir la formule la plus adaptée.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setRecommendedPlan("hybride")}
                  className={`rounded-full border px-5 py-2 text-xs font-semibold transition ${recommendedPlan === "hybride"
                    ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                    : "border-white/10 text-neutral-200 hover:border-brand-accent/40"
                    }`}
                >
                  Lycée français
                </button>
                <button
                  type="button"
                  onClick={() => setRecommendedPlan("immersion")}
                  className={`rounded-full border px-5 py-2 text-xs font-semibold transition ${recommendedPlan === "immersion"
                    ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                    : "border-white/10 text-neutral-200 hover:border-brand-accent/40"
                    }`}
                >
                  Candidat libre
                </button>
                <button
                  type="button"
                  onClick={() => setRecommendedPlan("plateforme")}
                  className={`rounded-full border px-5 py-2 text-xs font-semibold transition ${recommendedPlan === "plateforme"
                    ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                    : "border-white/10 text-neutral-200 hover:border-brand-accent/40"
                    }`}
                >
                  Découverte
                </button>
                <button
                  type="button"
                  onClick={() => setRecommendedPlan(null)}
                  className="rounded-full border border-white/10 px-5 py-2 text-xs font-semibold text-neutral-400 hover:text-white transition"
                >
                  Réinitialiser
                </button>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "1. Bilan gratuit",
                  text: "Évaluez le niveau et l’objectif de votre enfant.",
                },
                {
                  title: "2. Formule adaptée",
                  text: "Plateforme, Hybride ou Immersion selon le besoin.",
                },
                {
                  title: "3. Résultats suivis",
                  text: "Coachs + IA ARIA + reporting parent.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-neutral-300">{item.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 text-center">
              <Link
                href="/bilan-gratuit"
                className="btn-primary"
              >
                Démarrer un bilan gratuit
              </Link>
            </div>
          </div>
        </section>

        {/* OFFRES PRINCIPALES — 3 Formules Mensuelles */}
        <section id="offres-principales" className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
              <h2 className="marketing-section-title">
                3 formules, un seul objectif : la réussite
              </h2>
              <p className="mt-3 text-neutral-300">
                Abonnement mensuel. 1 séance = 1 heure de cours particulier en ligne.
              </p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {/* ACCÈS PLATEFORME */}
              <div className={`rounded-3xl border bg-white/5 p-8 ${recommendedPlan === "plateforme" ? "border-brand-accent/60 shadow-2xl shadow-brand-accent/10" : "border-white/10"} hover:border-brand-accent/30 transition-colors`}>
                <div className="marketing-badge bg-white/10 text-neutral-200 normal-case">
                  Accès digital
                </div>
                {recommendedPlan === "plateforme" && (
                  <div className="mt-3 text-xs font-semibold text-brand-accent">
                    Recommandée pour vous
                  </div>
                )}
                <div className="mt-4">
                  <h3 className="text-2xl font-bold text-white">Accès Plateforme</h3>
                  <p className="mt-2 text-sm text-neutral-300">
                    Suivi et IA, sans cours particuliers
                  </p>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-white">
                    150 <span className="text-base text-neutral-300">TND/mois</span>
                  </div>
                  <div className="text-xs text-neutral-400 mt-1">0 séance incluse</div>
                </div>

                <div className="mt-6 space-y-3 text-sm text-neutral-200">
                  {[
                    "Accès plateforme 24/7",
                    "Suivi de progression",
                    "IA ARIA (1 matière)",
                    "Dashboard parent",
                    "Ressources pédagogiques",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand-accent mt-1" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <Link href="/bilan-gratuit?programme=plateforme" className="btn-outline-strong w-full">
                    Démarrer un bilan gratuit →
                  </Link>
                </div>
              </div>

              {/* HYBRIDE — Recommandée */}
              <div className={`rounded-3xl border bg-white/5 p-8 shadow-2xl relative ${recommendedPlan === "hybride" ? "border-brand-accent/60 shadow-brand-accent/20" : "border-brand-accent/40 shadow-brand-accent/10"} hover:border-brand-accent/60 transition-colors`}>
                <div className="marketing-badge bg-brand-accent/10 text-brand-accent normal-case">
                  Recommandée
                </div>
                {recommendedPlan === "hybride" && (
                  <div className="mt-3 text-xs font-semibold text-brand-accent">
                    Recommandée pour vous
                  </div>
                )}
                <div className="mt-4">
                  <h3 className="text-2xl font-bold text-white">Hybride</h3>
                  <p className="mt-2 text-sm text-neutral-300">
                    Plateforme + coach référent dédié
                  </p>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-white">
                    450 <span className="text-base text-neutral-300">TND/mois</span>
                  </div>
                  <div className="text-xs text-brand-accent mt-1">4 séances incluses (4h/mois)</div>
                </div>

                <div className="mt-6 space-y-3 text-sm text-neutral-200">
                  {[
                    "Tout Accès Plateforme inclus",
                    "4h/mois avec coachs Agrégés et Certifiés",
                    "Coach référent dédié",
                    "IA ARIA (1 matière)",
                    "Suivi personnalisé",
                    "Visioconférence intégrée",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand-accent mt-1" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <Link href="/bilan-gratuit?programme=hybride" className="btn-primary w-full">
                    Démarrer un bilan gratuit →
                  </Link>
                </div>
              </div>

              {/* IMMERSION */}
              <div className={`rounded-3xl border bg-white/5 p-8 ${recommendedPlan === "immersion" ? "border-brand-accent/60 shadow-2xl shadow-brand-accent/10" : "border-white/10"} hover:border-brand-accent/30 transition-colors`}>
                <div className="marketing-badge bg-white/10 text-neutral-200 normal-case">
                  Premium
                </div>
                {recommendedPlan === "immersion" && (
                  <div className="mt-3 text-xs font-semibold text-brand-accent">
                    Recommandée pour vous
                  </div>
                )}
                <div className="mt-4">
                  <h3 className="text-2xl font-bold text-white">Immersion</h3>
                  <p className="mt-2 text-sm text-neutral-300">
                    Accompagnement intensif et prioritaire
                  </p>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-bold text-white">
                    750 <span className="text-base text-neutral-300">TND/mois</span>
                  </div>
                  <div className="text-xs text-brand-accent mt-1">8 séances incluses (8h/mois)</div>
                </div>

                <div className="mt-6 space-y-3 text-sm text-neutral-200">
                  {[
                    "Tout Hybride inclus",
                    "8h/mois avec experts Agrégés et Certifiés",
                    "Support prioritaire",
                    "Bilan trimestriel",
                    "IA ARIA (1 matière)",
                    "Sessions présentiel possibles",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-brand-accent mt-1" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <Link href="/bilan-gratuit?programme=immersion" className="btn-outline-strong w-full">
                    Démarrer un bilan gratuit →
                  </Link>
                </div>
              </div>
            </div>

            {/* Add-on ARIA */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
              <p className="text-sm text-neutral-300">
                <strong className="text-brand-accent">ARIA+</strong> : ajoutez des matières à votre IA pédagogique.
                +1 matière : <strong>50 TND/mois</strong> · Pack toutes matières : <strong>120 TND/mois</strong>
              </p>
            </div>
          </div>
        </section>

        {/* PACKS SPECIALISES */}
        <section id="packs-specialises" className="py-20 bg-black/20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
              <h2 className="marketing-section-title">
                Packs à la carte pour besoins spécifiques
              </h2>
              <p className="mt-3 text-neutral-300">
                Complétez votre programme principal ou choisissez une solution ciblée.
              </p>
              <div className="mt-5">
                <Link
                  href="/bilan-gratuit"
                  className="inline-flex rounded-full border border-brand-accent px-6 py-2 text-xs font-semibold text-brand-accent hover:bg-brand-accent/10 transition"
                >
                  Pas sûr ? Faites un bilan gratuit
                </Link>
              </div>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {packs.map((pack) => (
                <div
                  key={pack.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm hover:border-brand-accent/40 transition"
                >
                  <div className="marketing-badge text-brand-accent normal-case inline-flex items-center gap-2">
                    <pack.badgeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    {pack.badgeLabel}
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-white">{pack.title}</h3>
                  <div className="mt-2 text-2xl font-bold text-white">
                    {pack.price} <span className="text-sm text-neutral-300">TND</span>
                  </div>
                  <div className="text-sm text-neutral-300">{pack.duration}</div>

                  <ul className="mt-4 space-y-2 text-sm text-neutral-200">
                    {pack.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-brand-accent mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {pack.expert && (
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-accent/20 text-brand-accent font-semibold">
                        {pack.expert.name.slice(0, 1)}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{pack.expert.name}</div>
                        <div className="text-neutral-300 text-xs">{pack.expert.role}</div>
                      </div>
                    </div>
                  )}

                  {pack.extra && (
                    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-neutral-300">
                      <div className="font-semibold text-white mb-2">Prochains stages</div>
                      <ul className="space-y-1">
                        {pack.extra.map((item) => (
                          <li key={item} className="flex items-center gap-2">
                            <Check className="h-3.5 w-3.5 text-brand-accent" aria-hidden="true" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {pack.note && (
                    <p className="mt-4 inline-flex items-start gap-2 text-xs text-neutral-400">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-brand-accent" aria-hidden="true" />
                      {pack.note}
                    </p>
                  )}

                  <Link href={`/bilan-gratuit?programme=${encodeURIComponent(pack.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''))}`} className="mt-4 w-full rounded-full border border-brand-accent/40 px-4 py-2 text-sm font-semibold text-brand-accent hover:bg-brand-accent/10 transition text-center block">
                    {pack.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COMPARAISON */}
        <section id="comparaison" className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="marketing-section-title text-center">
              La comparaison la plus claire du marché
            </h2>

            <div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-white/5">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-4 border-b border-white/10 px-6 py-4 text-sm text-neutral-300">
                  <div>Critère</div>
                  <div>Prof Particulier</div>
                  <div className="text-brand-accent font-semibold">Nexus Réussite</div>
                  <div>Autre EdTech</div>
                </div>
                {comparisonRows.map((row) => (
                  <div
                    key={row.label}
                    className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-4 border-b border-white/5 px-6 py-4 text-sm"
                  >
                    <div className="text-neutral-300">{row.label}</div>
                    <div className="text-neutral-400">{row.prof}</div>
                    <div className="text-white">{row.nexus}</div>
                    <div className="text-neutral-400">{row.other}</div>
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-4 text-xs text-neutral-400 text-center">
              *Tarifs horaires de référence : cours individuel 60 TND/h, cours en groupe 40 TND/h (tout inclus : coachs Agrégés et Certifiés + IA ARIA + dashboard + suivi).
            </p>
          </div>
        </section>

        {/* ROI CALCULATOR */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="marketing-section-title text-center">
              Calculez votre économie réelle
            </h2>

            <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="space-y-6">
                  <div>
                    <label htmlFor="current-solution" className="text-sm text-neutral-300">
                      Votre situation actuelle :
                    </label>
                    <select
                      id="current-solution"
                      value={currentSolution}
                      onChange={(e) => setCurrentSolution(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                    >
                      <option value="rien">Pas d'accompagnement</option>
                      <option value="prof">Professeur particulier (60 TND/h)</option>
                      <option value="groupe">Cours en groupe (40 TND/h)</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="hours-range" className="text-sm text-neutral-300">
                      Nombre d'heures/mois nécessaires :
                    </label>
                    <input
                      id="hours-range"
                      type="range"
                      min={4}
                      max={20}
                      value={hours}
                      onChange={(e) => setHours(Number(e.target.value))}
                      className="mt-3 w-full"
                    />
                    <div className="text-sm text-neutral-300">
                      <span id="hours-value">{hours}</span> heures/mois
                    </div>
                  </div>

                  <div>
                    <label htmlFor="goal" className="text-sm text-neutral-300">
                      Objectif :
                    </label>
                    <select
                      id="goal"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                    >
                      <option value="bac">Réussir le Bac</option>
                      <option value="mention">Obtenir une mention</option>
                      <option value="parcoursup">Réussir Parcoursup</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-brand-accent/30 bg-white/5 p-6">
                <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] items-center">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <h3 className="text-sm text-neutral-300">Votre solution actuelle</h3>
                    <div id="current-price" className="mt-2 text-2xl font-bold text-white">
                      {currentMonthly} TND/mois
                    </div>
                    <ul className="mt-3 text-xs text-neutral-300 space-y-1">
                      <li>Expertise : Aléatoire</li>
                      <li>Flexibilité : Limitée</li>
                      <li>Garantie : Aucune</li>
                    </ul>
                  </div>

                  <div className="text-brand-accent text-2xl font-bold">→</div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <h3 className="text-sm text-neutral-300">Avec Nexus Réussite</h3>
                    <div id="nexus-price" className="mt-2 text-2xl font-bold text-white">
                      {nexusMonthly} TND/mois
                    </div>
                    <ul className="mt-3 text-xs text-neutral-300 space-y-1">
                      <li>Expertise : Agrégés et Certifiés</li>
                      <li>Flexibilité : 24/7</li>
                      <li>Garantie : Résultats</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-brand-accent/30 bg-black/30 p-4 text-center">
                  <div className="text-sm text-neutral-300">Votre économie mensuelle :</div>
                  <div id="savings-amount" className="text-3xl font-bold text-brand-accent">
                    {savings} TND
                  </div>
                  <div className="text-xs text-neutral-400">
                    <span id="savings-percent">{savingsPercent}%</span> d'économie pour +150% de valeur
                  </div>
                </div>

                <Link href="/bilan-gratuit" className="mt-6 w-full btn-primary">
                  Démarrer un bilan gratuit
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* GARANTIES */}
        <section id="garanties" className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="marketing-section-title text-center">
              Votre réussite, notre engagement contractuel
            </h2>

            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  title: "Garantie Bac Obtenu",
                  text: "Si votre enfant ne réussit pas le Bac malgré un suivi régulier, remboursement 100%.",
                  icon: ShieldCheck,
                },
                {
                  title: "Garantie Mention Atteinte",
                  text: "Si la mention visée n'est pas obtenue, 3 mois offerts.",
                  icon: Award,
                },
                {
                  title: "Satisfait ou remboursé (30j)",
                  text: "Insatisfait dans les 30 premiers jours ? Remboursement intégral.",
                  icon: Sparkles,
                },
                {
                  title: "Garantie Progression",
                  text: "+2 points en 3 mois sinon mois suivant offert.",
                  icon: TrendingUp,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm text-neutral-300">{item.text}</p>
                    <a href="/conditions#garanties" className="mt-3 inline-flex text-xs text-brand-accent hover:text-white">
                      Voir les conditions détaillées
                    </a>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 rounded-3xl border border-white/10 bg-white/5 p-8">
              <div className="grid gap-6 md:grid-cols-4 text-center">
                {[
                  { value: "98%", label: "Taux de réussite" },
                  { value: "500+", label: "Élèves accompagnés" },
                  { value: "4.9/5", label: "Satisfaction" },
                  { value: "150+", label: "Mentions TB" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <div className="text-3xl font-bold text-brand-accent">{stat.value}</div>
                    <div className="text-sm text-neutral-300">{stat.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-8 grid gap-6 md:grid-cols-2">
                {[
                  {
                    quote: "Grâce à Nexus, mon fils est passé de 9 à 15 en maths. La garantie nous a rassurés.",
                    author: "Mme Ben Ammar",
                    role: "Mère de Karim, Terminale",
                  },
                  {
                    quote: "L'IA ARIA nous a permis de réviser sans stress. Les progrès sont visibles chaque semaine.",
                    author: "M. Hassen",
                    role: "Parent d'élève Première",
                  },
                ].map((t) => (
                  <div key={t.author} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <p className="text-sm text-neutral-200">“{t.quote}”</p>
                    <div className="mt-3 text-xs text-neutral-400">
                      <strong className="text-white">{t.author}</strong> — {t.role}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FUNNEL */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="marketing-section-title text-center">
              Trouvez la solution parfaite en 2 minutes
            </h2>

            <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8">
              <div className="mb-6 flex items-center justify-between text-sm text-neutral-300">
                <span>Étape {Math.min(quizStep + 1, 3)}/3</span>
                <span className="text-brand-accent">Progression</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-brand-accent transition"
                  style={{ width: `${(Math.min(quizStep + 1, 3) / 3) * 100}%` }}
                />
              </div>

              {quizStep < quizSteps.length ? (
                <div className="mt-8">
                  <h3 className="text-xl font-semibold text-white">
                    {quizSteps[quizStep].question}
                  </h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {quizSteps[quizStep].options.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleQuiz(option.value)}
                        className={`rounded-2xl border px-4 py-3 text-sm transition ${selectedOption === option.value
                          ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                          : "border-white/10 bg-black/20 text-neutral-200 hover:border-brand-accent/40"
                          }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-8">
                  <div className="rounded-2xl border border-brand-accent/40 bg-black/30 p-6 text-center">
                    <h3 className="text-xl font-semibold text-white">Notre recommandation :</h3>
                    <p className="mt-2 text-neutral-300">{quizRecommendation}</p>
                    <div className="mt-4 text-2xl font-bold text-brand-accent">
                      À partir de 450 TND/mois
                    </div>
                    <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                      <Link href="/bilan-gratuit?programme=recommande" className="btn-primary">
                        Démarrer un bilan gratuit
                      </Link>
                      <button
                        onClick={resetQuiz}
                        className="btn-outline-strong"
                      >
                        Recommencer le quiz
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="rounded-3xl border border-brand-accent/30 bg-white/5 p-10 text-center">
              <p className="marketing-eyebrow">
                Prochaine étape
              </p>
              <h2 className="marketing-cta-title">
                Prêt à transformer l'avenir de votre enfant ?
              </h2>
              <p className="marketing-cta-copy">
                Rejoignez les 500+ familles qui nous font confiance pour l'excellence éducative.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/bilan-gratuit" className="btn-primary">
                  Démarrer un bilan gratuit
                </Link>
                <Link href="/contact" className="btn-outline">
                  Parler à un expert
                </Link>
              </div>
              <div className="mt-6 text-sm text-brand-accent">
                <span className="inline-flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Places limitées chaque mois · Priorité donnée après bilan
                </span>
              </div>
            </div>
          </div>
        </section>
        {/* FAQ */}
        <section id="faq" className="py-20 bg-black/20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="marketing-section-title text-center">
              Questions fréquentes des parents
            </h2>

            <div className="mt-10 grid gap-4 max-w-3xl mx-auto">
              {[
                {
                  q: "Comment fonctionnent les séances ?",
                  a: "Chaque séance correspond à 1 heure de cours particulier en ligne avec un coach Agrégé ou Certifié. Les séances sont incluses dans votre abonnement mensuel (4 pour Hybride, 8 pour Immersion). Les séances non utilisées sont reportables d'un mois sur l'autre."
                },
                {
                  q: "Qui sont les coachs Nexus Réussite ?",
                  a: "Tous nos coachs sont Agrégés et Certifiés. Ils sont sélectionnés pour leur expertise et leur capacité à accompagner des lycéens du système français. Chaque coach a un pseudonyme mythique et un profil spécialisé."
                },
                {
                  q: "Comment fonctionne l'IA ARIA ?",
                  a: "ARIA est une assistante pédagogique basée sur GPT-4, disponible 24/7. Elle aide votre enfant pour les révisions, les exercices, et la préparation aux examens. Elle est incluse dans tous les abonnements (1 matière). Matières supplémentaires en add-on."
                },
                {
                  q: "Puis-je suivre la progression de mon enfant ?",
                  a: "Oui. Votre dashboard parent vous donne une vue en temps réel : sessions réalisées, planning à venir, rapports des coachs, et progression globale. Vous recevez aussi des notifications par email."
                },
                {
                  q: "Quelles sont les conditions d'annulation ?",
                  a: "Annulation gratuite si plus de 24h avant un cours particulier, ou plus de 48h avant un atelier de groupe. La séance est automatiquement recréditée sur votre forfait. L'abonnement est résiliable à tout moment."
                },
                {
                  q: "Comment se passent les cours en ligne ?",
                  a: "Les cours se déroulent en visioconférence intégrée (Jitsi Meet) directement dans la plateforme. Pas besoin de télécharger de logiciel. Le lien est disponible 15 minutes avant la session."
                },
                {
                  q: "Quels modes de paiement acceptez-vous ?",
                  a: "Paiement en ligne par carte bancaire via ClicToPay (TND, bientôt disponible). Virement bancaire (Banque Zitouna). Paiement sur place au centre est également possible."
                },
              ].map((item) => (
                <details key={item.q} className="group rounded-2xl border border-white/10 bg-white/5 p-5">
                  <summary className="flex cursor-pointer items-center justify-between text-white font-semibold">
                    {item.q}
                    <ChevronRight className="h-5 w-5 text-brand-accent transition-transform group-open:rotate-90" />
                  </summary>
                  <p className="mt-3 text-sm text-neutral-300 leading-relaxed">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <CorporateFooter />
      <BackToTop />
    </div>
  );
}
