"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  Check,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { BackToTop } from "@/components/ui/back-to-top";

const packs = [
  {
    badge: "🎤 ESSENTIEL POUR LE BAC",
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
    expert: { name: "Oratora", role: "Coach en éloquence" },
    cta: "Ajouter à mon programme",
  },
  {
    badge: "🎯 POUR L'ORIENTATION",
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
    expert: { name: "Prospect", role: "Conseiller orientation" },
    cta: "Ajouter à mon programme",
  },
  {
    badge: "⚡ ACCÉLÉRATION",
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
    badge: "🤖 IA AVANCÉE",
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
    nexus: "100% Agrégés/Certifiés",
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
  const [billingAnnual, setBillingAnnual] = useState(false);
  const [currentSolution, setCurrentSolution] = useState("rien");
  const [hours, setHours] = useState(10);
  const [goal, setGoal] = useState("mention");
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const pricing = useMemo(() => {
    const monthly = 299;
    const annual = 2990;
    return billingAnnual ? { price: annual, label: "TND/an" } : { price: monthly, label: "TND/mois" };
  }, [billingAnnual]);

  const currentMonthly = useMemo(() => {
    if (currentSolution === "prof") return 60 * hours;
    if (currentSolution === "groupe") return 40 * hours;
    return 0;
  }, [currentSolution, hours]);

  const nexusMonthly = 299;
  const savings = Math.max(currentMonthly - nexusMonthly, 0);
  const savingsPercent = currentMonthly ? Math.round((savings / currentMonthly) * 100) : 0;

  const recommendationMap: Record<string, string> = {
    "scolarise-bac-methodo": "Programme Excellence",
    "scolarise-bac-comprehension": "Programme Excellence + Pack Méthodologie",
    "scolarise-mention-methodo": "Programme Excellence + Pack Grand Oral",
    "scolarise-mention-comprehension": "Programme Excellence + Soutien Intensif",
    "candidat-bac-methodo": "Pack Bac Garanti",
    "candidat-bac-comprehension": "Pack Bac Garanti + Académie Intensive",
    "candidat-mention-methodo": "Pack Bac Garanti + Pack Grand Oral",
    "candidat-mention-comprehension": "Pack Bac Garanti + Coaching Premium",
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
      <Header />

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden py-20">
          <div className="absolute inset-0 bg-gradient-to-b from-surface-darker via-surface-darker/70 to-surface-darker" />
          <div className="absolute -top-10 right-10 h-72 w-72 rounded-full bg-gold-500/10 blur-[140px]" />
          <div className="container relative z-10 mx-auto px-4 md:px-6">
            <div className="text-center">
              <h1 className="text-4xl md:text-6xl font-bold text-white font-serif">
                Investissez dans la seule garantie de réussite au Bac.
              </h1>
              <p className="mt-4 text-lg text-neutral-300">
                Un prix unique, tout inclus. Expertise humaine + IA 24/7 + Garantie Mention.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Élève scolarisé",
                  text: "En Lycée français, je veux optimiser mes résultats",
                  anchor: "#offres-principales",
                  badge: "Plus choisi",
                },
                {
                  title: "Candidat libre",
                  text: "Je prépare le Bac seul, je veux un cadre complet",
                  anchor: "#offres-principales",
                },
                {
                  title: "Parent indécis",
                  text: "Je veux comparer toutes les options",
                  anchor: "#comparaison",
                },
              ].map((item, index) => (
                <a
                  key={item.title}
                  href={item.anchor}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition hover:border-gold-500/40 hover:bg-white/10"
                >
                  {item.badge && (
                    <span className="inline-flex items-center rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-400">
                      {item.badge}
                    </span>
                  )}
                  <h3 className="mt-4 text-xl font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-neutral-300">{item.text}</p>
                  <div className="mt-4 inline-flex items-center text-sm font-semibold text-gold-400">
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
              <a href="#comparaison" className="hover:text-white">
                Comparaison détaillée
              </a>
              <span>•</span>
              <a href="#garanties" className="hover:text-white">
                Nos garanties
              </a>
            </div>
          </div>
        </section>

        {/* OFFRES PRINCIPALES */}
        <section id="offres-principales" className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
                Votre solution clé-en-main
              </h2>
              <p className="mt-3 text-neutral-300">
                Tout inclus : experts agrégés et certifiés + IA 24/7 + suivi premium.
              </p>
            </div>

            <div className="mt-8 flex items-center justify-center gap-4 text-sm text-neutral-300">
              <span>Paiement Mensuel</span>
              <button
                type="button"
                onClick={() => setBillingAnnual(!billingAnnual)}
                className="relative h-6 w-12 rounded-full border border-gold-500/40 bg-black/30"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-gold-500 transition ${
                    billingAnnual ? "right-0.5" : "left-0.5"
                  }`}
                />
              </button>
              <span>
                Paiement Annuel <strong className="text-gold-400">(-2 mois offerts)</strong>
              </span>
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-2">
              <div className="rounded-3xl border border-gold-500/40 bg-white/5 p-8 shadow-2xl shadow-gold-500/10">
                <div className="inline-flex items-center rounded-full bg-gold-500/10 px-3 py-1 text-xs font-semibold text-gold-400">
                  🎯 PLUS POPULAIRE
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-white">Programme Excellence</h3>
                    <p className="mt-2 text-sm text-neutral-300">
                      Pour les élèves scolarisés (2nde à Terminale)
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">
                      {pricing.price} <span className="text-base text-neutral-300">{pricing.label}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3 text-sm text-neutral-200">
                  {[
                    "8h/mois avec experts agrégés et certifiés",
                    "IA ARIA Premium 24/7 toutes matières",
                    "Dashboard parent temps réel",
                    "Garantie mention ou 3 mois offerts",
                    "Coaching Parcoursup inclus",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-gold-400 mt-1" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-neutral-300">
                  Valeur réelle : <span className="line-through">450 TND/mois</span>
                  <div className="text-gold-400 font-semibold">Vous économisez 151 TND/mois</div>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <Link href="/bilan-gratuit?programme=excellence" className="rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-black hover:bg-gold-400 transition text-center">
                    Choisir l&apos;Excellence →
                  </Link>
                  <a href="#details-excellence" className="text-sm text-gold-400 hover:text-white">
                    Voir tous les détails
                  </a>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
                <div className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-neutral-200">
                  🛡️ TOUT-INCLUS
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-bold text-white">Pack Bac Garanti</h3>
                    <p className="mt-2 text-sm text-neutral-300">
                      Pour réussir le Bac en candidat libre sans stress
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-white">
                      1 990 <span className="text-base text-neutral-300">TND/an</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3 text-sm text-neutral-200">
                  {[
                    "100h annuelles programme complet",
                    "Inscription Aix-Marseille gérée",
                    "IA ARIA Premium illimitée",
                    "4 examens blancs corrigés",
                    "Garantie 100% Bac ou remboursé",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-gold-400 mt-1" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-neutral-300">
                  Valeur réelle : <span className="line-through">3 200 TND/an</span>
                  <div className="text-gold-400 font-semibold">Vous économisez 1 210 TND</div>
                </div>

                <div className="mt-6 flex flex-col gap-3">
                  <Link href="/bilan-gratuit?programme=bac-garanti" className="rounded-full border border-gold-500 px-6 py-3 text-sm font-bold text-white hover:bg-gold-500/10 transition text-center">
                    Sécuriser mon Bac →
                  </Link>
                  <a href="#details-bac" className="text-sm text-gold-400 hover:text-white">
                    Voir tous les détails
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PACKS SPECIALISES */}
        <section id="packs-specialises" className="py-20 bg-black/20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
                Packs à la carte pour besoins spécifiques
              </h2>
              <p className="mt-3 text-neutral-300">
                Complétez votre programme principal ou choisissez une solution ciblée.
              </p>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {packs.map((pack) => (
                <div
                  key={pack.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm hover:border-gold-500/40 transition"
                >
                  <div className="text-xs text-gold-400 font-semibold">{pack.badge}</div>
                  <h3 className="mt-3 text-xl font-semibold text-white">{pack.title}</h3>
                  <div className="mt-2 text-2xl font-bold text-white">
                    {pack.price} <span className="text-sm text-neutral-300">TND</span>
                  </div>
                  <div className="text-sm text-neutral-300">{pack.duration}</div>

                  <ul className="mt-4 space-y-2 text-sm text-neutral-200">
                    {pack.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-gold-400 mt-0.5" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {pack.expert && (
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gold-500/20 text-gold-400 font-semibold">
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
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {pack.note && (
                    <p className="mt-4 text-xs text-neutral-400">⚠️ {pack.note}</p>
                  )}

                  <Link href="/bilan-gratuit?programme=pack-specialise" className="mt-4 w-full rounded-full border border-gold-500/40 px-4 py-2 text-sm font-semibold text-gold-300 hover:bg-gold-500/10 transition text-center block">
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
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              Pourquoi Nexus Réussite vaut 2× plus... et coûte 40% moins cher
            </h2>

            <div className="mt-8 overflow-x-auto rounded-3xl border border-white/10 bg-white/5">
              <div className="min-w-[820px]">
                <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-4 border-b border-white/10 px-6 py-4 text-sm text-neutral-300">
                  <div>Critère</div>
                  <div>Prof Particulier</div>
                  <div className="text-gold-400 font-semibold">Nexus Réussite</div>
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
              *Calcul basé sur Programme Excellence : 299 TND/mois pour 8h = 37 TND/h. Inclus IA 24/7, dashboard, garantie.
            </p>
          </div>
        </section>

        {/* ROI CALCULATOR */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
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

              <div className="rounded-3xl border border-gold-500/30 bg-white/5 p-6">
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

                  <div className="text-gold-400 text-2xl font-bold">→</div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <h3 className="text-sm text-neutral-300">Avec Nexus Réussite</h3>
                    <div id="nexus-price" className="mt-2 text-2xl font-bold text-white">
                      {nexusMonthly} TND/mois
                    </div>
                    <ul className="mt-3 text-xs text-neutral-300 space-y-1">
                      <li>Expertise : Agrégés et certifiés</li>
                      <li>Flexibilité : 24/7</li>
                      <li>Garantie : Résultats</li>
                    </ul>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-gold-500/30 bg-black/30 p-4 text-center">
                  <div className="text-sm text-neutral-300">Votre économie mensuelle :</div>
                  <div id="savings-amount" className="text-3xl font-bold text-gold-400">
                    {savings} TND
                  </div>
                  <div className="text-xs text-neutral-400">
                    <span id="savings-percent">{savingsPercent}%</span> d'économie pour +150% de valeur
                  </div>
                </div>

                <Link href="/bilan-gratuit" className="mt-6 w-full rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-black hover:bg-gold-400 transition text-center block">
                  Démarrer avec Nexus
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* GARANTIES */}
        <section id="garanties" className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
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
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/10 text-gold-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm text-neutral-300">{item.text}</p>
                    <a href="#" className="mt-3 inline-flex text-xs text-gold-400 hover:text-white">
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
                    <div className="text-3xl font-bold text-gold-400">{stat.value}</div>
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
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              Trouvez la solution parfaite en 2 minutes
            </h2>

            <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8">
              <div className="mb-6 flex items-center justify-between text-sm text-neutral-300">
                <span>Étape {Math.min(quizStep + 1, 3)}/3</span>
                <span className="text-gold-400">Progression</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-gold-500 transition"
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
                        className={`rounded-2xl border px-4 py-3 text-sm transition ${
                          selectedOption === option.value
                            ? "border-gold-500 bg-gold-500/10 text-gold-400"
                            : "border-white/10 bg-black/20 text-neutral-200 hover:border-gold-500/40"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-8">
                  <div className="rounded-2xl border border-gold-500/40 bg-black/30 p-6 text-center">
                    <h3 className="text-xl font-semibold text-white">Notre recommandation :</h3>
                    <p className="mt-2 text-neutral-300">{quizRecommendation}</p>
                    <div className="mt-4 text-2xl font-bold text-gold-400">
                      299 TND/mois
                    </div>
                    <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                      <Link href="/bilan-gratuit?programme=recommande" className="rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-black hover:bg-gold-400 transition text-center">
                        Choisir cette solution
                      </Link>
                      <button
                        onClick={resetQuiz}
                        className="rounded-full border border-gold-500 px-6 py-3 text-sm font-bold text-white hover:bg-gold-500/10 transition"
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
            <div className="rounded-3xl border border-gold-500/30 bg-white/5 p-10 text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
                Prêt à transformer l'avenir de votre enfant ?
              </h2>
              <p className="mt-3 text-neutral-300">
                Rejoignez les 500+ familles qui nous font confiance pour l'excellence éducative.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
                <a
                  href="/bilan-gratuit"
                  className="rounded-full bg-gold-500 px-8 py-3 text-sm font-bold text-black hover:bg-gold-400 transition"
                >
                  Commencer mon bilan gratuit
                </a>
                <a
                  href="/contact"
                  className="rounded-full border border-gold-500 px-8 py-3 text-sm font-bold text-white hover:bg-gold-500/10 transition"
                >
                  Parler à un expert
                </a>
              </div>
              <div className="mt-6 text-sm text-gold-400">
                ⚠️ Places limitées pour Septembre · Prochain créneau disponible : Demain 10h
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
      <BackToTop />
    </div>
  );
}
