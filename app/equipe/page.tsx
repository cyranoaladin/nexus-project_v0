"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Compass,
  GraduationCap,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { resolveUiIcon } from "@/lib/ui-icons";
import { GROUP_RULES } from "@/lib/group-rules";

const FEATURED = [
  "maths-methode-bac",
  "physique-raisonnement",
  "nsi-projets",
  "oral-eaf-grand-oral",
];

type AccompanimentProfile = {
  id: string;
  label: string;
  subject: string;
  title: string;
  tagline: string;
  stats: string[];
  tags: string[];
  category: "maths" | "physique" | "nsi" | "lettres" | "orientation";
  capacityLabel: string;
  isAvailable: boolean;
  specialties: string[];
  personality: string[];
  matchCriteria: {
    profile: string[];
    goal: string[];
    challenge: string[];
    style: string[];
  };
};

const PROFILES: AccompanimentProfile[] = [
  {
    id: "maths-methode-bac",
    label: "Mathématiques - méthode bac",
    subject: "Mathématiques",
    title: "Approche structurée pour consolider les bases et traiter les sujets d'examen",
    tagline: "Installer les automatismes, clarifier les raisonnements et rendre les exercices moins opaques.",
    stats: ["Diagnostic initial", "Méthode par chapitres", "Entraînement guidé"],
    tags: ["Maths expertes", "Méthodologie", "Sujets bac"],
    category: "maths",
    capacityLabel: "Créneaux selon diagnostic",
    isAvailable: true,
    specialties: ["Algèbre", "Analyse", "Raisonnement"],
    personality: ["structuré", "logique", "rigoureux"],
    matchCriteria: {
      profile: ["logique", "structuré"],
      goal: ["bac", "mention"],
      challenge: ["methodo", "comprehension"],
      style: ["visuel", "pratique"],
    },
  },
  {
    id: "physique-raisonnement",
    label: "Physique-Chimie - raisonnement expérimental",
    subject: "Physique-Chimie",
    title: "Approche expérimentale pour relier cours, modèles et exercices",
    tagline: "Passer de la formule apprise au raisonnement compris, avec des étapes explicites.",
    stats: ["Schémas de résolution", "Méthode expérimentale", "Corrections commentées"],
    tags: ["Physique", "Chimie", "Méthode"],
    category: "physique",
    capacityLabel: "Créneaux selon niveau",
    isAvailable: true,
    specialties: ["Mécanique", "Chimie", "Modélisation"],
    personality: ["curieux", "expérimental"],
    matchCriteria: {
      profile: ["curieux", "expérimental"],
      goal: ["bac", "mention"],
      challenge: ["comprehension"],
      style: ["pratique", "visuel"],
    },
  },
  {
    id: "nsi-projets",
    label: "NSI - projets et algorithmique",
    subject: "NSI & Python",
    title: "Approche projet pour transformer les notions en compétences durables",
    tagline: "Décomposer les problèmes, écrire du code lisible et défendre une démarche.",
    stats: ["Algorithmique", "Python", "Projet guidé"],
    tags: ["NSI", "Python", "Projets"],
    category: "nsi",
    capacityLabel: "Créneaux sur dossier",
    isAvailable: true,
    specialties: ["Algorithmique", "Python", "Architecture"],
    personality: ["créatif", "solutionneur"],
    matchCriteria: {
      profile: ["creatif", "solutionneur"],
      goal: ["bac", "mention"],
      challenge: ["temps", "methodo"],
      style: ["pratique", "visuel"],
    },
  },
  {
    id: "oral-eaf-grand-oral",
    label: "Oral - EAF et Grand Oral",
    subject: "Français & oral",
    title: "Approche progressive pour l'argumentation, la prise de parole et la confiance",
    tagline: "Préparer une parole claire, structurée et fidèle aux attendus du système français.",
    stats: ["Plans d'oral", "Simulations", "Retour précis"],
    tags: ["Grand Oral", "EAF", "Argumentation"],
    category: "lettres",
    capacityLabel: "Créneaux encadrés",
    isAvailable: true,
    specialties: ["Rhétorique", "Analyse", "Expression"],
    personality: ["expressif", "communicant"],
    matchCriteria: {
      profile: ["expressif", "communicant"],
      goal: ["bac", "mention"],
      challenge: ["confiance"],
      style: ["oral"],
    },
  },
  {
    id: "eaf-ecrit",
    label: "Français - écrit EAF",
    subject: "Français",
    title: "Approche méthodique pour commentaire, dissertation et grammaire",
    tagline: "Clarifier les attendus, structurer les réponses et travailler la précision de l'écrit.",
    stats: ["Méthode écrite", "Analyses guidées", "Grilles officielles"],
    tags: ["Français", "Écrit", "Analyse"],
    category: "lettres",
    capacityLabel: "Créneaux selon objectif",
    isAvailable: true,
    specialties: ["Commentaire", "Dissertation", "Grammaire"],
    personality: ["expressif", "structuré"],
    matchCriteria: {
      profile: ["expressif", "structuré"],
      goal: ["bac"],
      challenge: ["methodo", "confiance"],
      style: ["oral", "visuel"],
    },
  },
  {
    id: "maths-applications",
    label: "Mathématiques - applications et exercices",
    subject: "Mathématiques",
    title: "Approche concrète pour reprendre confiance dans les exercices",
    tagline: "Multiplier les situations utiles sans perdre le fil du cours et des notations.",
    stats: ["Exercices ciblés", "Probabilités", "Automatismes"],
    tags: ["Maths", "Applications", "Pratique"],
    category: "maths",
    capacityLabel: "Créneaux à confirmer",
    isAvailable: true,
    specialties: ["Probabilités", "Fonctions", "Applications"],
    personality: ["pratique", "logique"],
    matchCriteria: {
      profile: ["logique"],
      goal: ["bac"],
      challenge: ["comprehension"],
      style: ["pratique"],
    },
  },
  {
    id: "nsi-architecture",
    label: "NSI - systèmes et architecture",
    subject: "NSI",
    title: "Approche structurée pour comprendre les systèmes, réseaux et données",
    tagline: "Relier la théorie informatique aux questions de sujet et aux projets.",
    stats: ["Systèmes", "Réseaux", "Données"],
    tags: ["NSI", "Systèmes", "Réseaux"],
    category: "nsi",
    capacityLabel: "Créneaux selon besoin",
    isAvailable: true,
    specialties: ["Réseaux", "Données", "Python"],
    personality: ["structuré"],
    matchCriteria: {
      profile: ["structuré", "creatif"],
      goal: ["mention", "bac"],
      challenge: ["methodo"],
      style: ["visuel", "pratique"],
    },
  },
  {
    id: "orientation-strategie",
    label: "Orientation - stratégie et dossier",
    subject: "Orientation",
    title: "Approche de cadrage pour choix, dossier et entretiens",
    tagline: "Aider la famille à prioriser les options et formuler un projet cohérent.",
    stats: ["Choix de parcours", "Dossier", "Entretiens"],
    tags: ["Orientation", "Parcoursup", "Conseil"],
    category: "orientation",
    capacityLabel: "Créneaux de rendez-vous",
    isAvailable: true,
    specialties: ["Parcours", "Dossier", "Entretien"],
    personality: ["communicant", "structuré"],
    matchCriteria: {
      profile: ["expressif", "structuré"],
      goal: ["parcoursup", "combine"],
      challenge: ["confiance", "temps"],
      style: ["oral"],
    },
  },
];

const quizQuestions = [
  {
    key: "profile",
    question: "Quel mot décrit le mieux votre enfant ?",
    options: [
      { value: "logique", label: "Logique et structuré", icon: "sigma" },
      { value: "curieux", label: "Curieux et expérimental", icon: "science" },
      { value: "creatif", label: "Créatif et solutionneur", icon: "code" },
      { value: "expressif", label: "Expressif et communicant", icon: "mic" },
    ],
  },
  {
    key: "goal",
    question: "Son objectif principal est :",
    options: [
      { value: "bac", label: "Préparer le Bac", icon: "graduation" },
      { value: "mention", label: "Viser un dossier solide", icon: "medal" },
      { value: "parcoursup", label: "Clarifier l'orientation", icon: "compass" },
      { value: "combine", label: "Combiner plusieurs priorités", icon: "sparkles" },
    ],
  },
  {
    key: "challenge",
    question: "Son principal défi est :",
    options: [
      { value: "methodo", label: "Méthodologie", icon: "book" },
      { value: "comprehension", label: "Compréhension", icon: "brain" },
      { value: "temps", label: "Organisation du temps", icon: "calendar" },
      { value: "confiance", label: "Confiance à l'oral ou à l'écrit", icon: "message" },
    ],
  },
  {
    key: "style",
    question: "Quel style d'apprentissage lui convient ?",
    options: [
      { value: "visuel", label: "Visuel et structuré", icon: "cpu" },
      { value: "pratique", label: "Pratique et concret", icon: "science" },
      { value: "oral", label: "Oral et interactif", icon: "mic" },
      { value: "autonome", label: "Autonome avec guidance", icon: "rocket" },
    ],
  },
];

const filterCategories = [
  { value: "all", label: "Tous" },
  { value: "maths", label: "Mathématiques" },
  { value: "physique", label: "Physique-Chimie" },
  { value: "nsi", label: "NSI & Python" },
  { value: "lettres", label: "Français & Oral" },
  { value: "orientation", label: "Orientation" },
];

export default function EquipePage() {
  const groupMax = GROUP_RULES.group_max;
  const profilesRef = useRef<HTMLDivElement | null>(null);
  const directoryRef = useRef<HTMLDivElement | null>(null);

  const [filters, setFilters] = useState({ category: "all", availability: "all" });
  const [visibleCount, setVisibleCount] = useState(8);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<AccompanimentProfile | null>(null);

  const featuredProfiles = useMemo(
    () => PROFILES.filter((profile) => FEATURED.includes(profile.id)),
    [],
  );

  const filteredProfiles = useMemo(() => {
    return PROFILES.filter((profile) => {
      const categoryMatch = filters.category === "all" || profile.category === filters.category;
      const availabilityMatch =
        filters.availability === "all" ||
        (filters.availability === "available" && profile.isAvailable);
      return categoryMatch && availabilityMatch;
    });
  }, [filters]);

  const visibleProfiles = filteredProfiles.slice(0, visibleCount);

  const calculateMatch = (answers: Record<string, string>) => {
    const scored = PROFILES.map((profile) => {
      let score = 0;
      if (answers.profile && profile.matchCriteria.profile.includes(answers.profile)) score += 30;
      if (answers.goal && profile.matchCriteria.goal.includes(answers.goal)) score += 25;
      if (answers.challenge && profile.matchCriteria.challenge.includes(answers.challenge)) score += 25;
      if (answers.style && profile.matchCriteria.style.includes(answers.style)) score += 20;
      return { profile, score };
    }).sort((a, b) => b.score - a.score);

    return scored[0].profile;
  };

  const handleQuiz = (value: string) => {
    const key = quizQuestions[quizStep].key;
    const updated = { ...quizAnswers, [key]: value };
    setQuizAnswers(updated);

    if (quizStep < quizQuestions.length - 1) {
      setQuizStep(quizStep + 1);
    } else {
      setQuizResult(calculateMatch(updated));
    }
  };

  const resetQuiz = () => {
    setQuizStep(0);
    setQuizAnswers({});
    setQuizResult(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 equipe-dark">
      <main id="main-content" className="pb-20">
        <section className="relative overflow-hidden py-20">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/70 to-slate-950" />
          <div className="container relative z-10 mx-auto px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] items-center">
              <div>
                <h1 className="text-4xl md:text-6xl font-bold text-white font-serif">
                  Des approches pédagogiques structurées pour progresser
                </h1>
                <p className="mt-4 text-lg text-slate-300">
                  Nexus Réussite présente ici ses profils d'accompagnement par discipline et par besoin.
                  Le diagnostic permet ensuite d'orienter la famille vers le cadre le plus adapté.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { value: "Méthode", label: "Progression structurée" },
                    { value: `${groupMax} max`, label: "Élèves par groupe" },
                    { value: "Grilles", label: "Corrections officielles" },
                    { value: "Suivi", label: "Bilan individualisé" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center"
                    >
                      <div className="text-2xl font-bold text-gold-400">{stat.value}</div>
                      <div className="text-xs text-slate-300">{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => profilesRef.current?.scrollIntoView({ behavior: "smooth" })}
                    className="rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-black hover:bg-gold-400 transition"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Target className="h-4 w-4" aria-hidden="true" />
                      Trouver l'approche adaptée
                    </span>
                  </button>
                  <button
                    onClick={() => directoryRef.current?.scrollIntoView({ behavior: "smooth" })}
                    className="rounded-full border border-gold-500 px-6 py-3 text-sm font-bold text-white hover:bg-gold-500/10 transition"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Users className="h-4 w-4" aria-hidden="true" />
                      Voir les profils d'accompagnement
                    </span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-md">
                  <div className="grid grid-cols-2 gap-4">
                    {featuredProfiles.map((profile) => (
                      <div key={profile.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/20 text-gold-400 font-bold">
                          {profile.label.slice(0, 1)}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white">{profile.subject}</div>
                        <div className="text-xs text-slate-300">{profile.category}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section ref={profilesRef} className="py-20 bg-black/20" id="matchingQuiz">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
                Identifier le cadre de travail le plus utile
              </h2>
              <p className="mt-3 text-slate-300">
                4 questions pour orienter la discussion de diagnostic.
              </p>
            </div>

            <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8">
              <div className="mb-6">
                <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                  {quizQuestions.map((q, index) => (
                    <div
                      key={q.key}
                      className={`rounded-full px-3 py-1 border ${index <= quizStep ? "border-gold-500/50 text-gold-400" : "border-white/10"}`}
                    >
                      {q.question.split(" ")[0]}
                    </div>
                  ))}
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gold-500 transition"
                    style={{ width: `${((quizStep + 1) / quizQuestions.length) * 100}%` }}
                  />
                </div>
              </div>

              {!quizResult ? (
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {quizQuestions[quizStep].question}
                  </h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {quizQuestions[quizStep].options.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleQuiz(option.value)}
                        className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-200 hover:border-gold-500/40 transition"
                      >
                        {(() => {
                          const OptionIcon = resolveUiIcon(option.icon);
                          return <OptionIcon className="mr-2 inline h-4 w-4 text-gold-400" aria-hidden="true" />;
                        })()}
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    {quizStep > 0 && (
                      <button
                        onClick={() => setQuizStep(Math.max(quizStep - 1, 0))}
                        className="rounded-full border border-gold-500 px-4 py-2 text-xs font-semibold text-gold-300"
                      >
                        Précédent
                      </button>
                    )}
                    <button
                      onClick={() => directoryRef.current?.scrollIntoView({ behavior: "smooth" })}
                      className="rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      Voir directement les profils
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-gold-500/40 bg-black/30 p-6">
                  <div className="flex flex-col gap-6 md:flex-row md:items-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gold-500/20 text-gold-400 text-3xl font-bold">
                      {quizResult.label.slice(0, 1)}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        Approche recommandée : {quizResult.label}
                      </h3>
                      <p className="mt-2 text-slate-300">{quizResult.tagline}</p>
                      <div className="mt-2 text-sm text-gold-400">
                        {quizResult.stats[0]} · {quizResult.capacityLabel}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <a
                      href="/contact"
                      className="rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-black hover:bg-gold-400 transition"
                    >
                      Réserver un diagnostic pédagogique
                    </a>
                    <button
                      onClick={resetQuiz}
                      className="rounded-full border border-gold-500 px-6 py-3 text-sm font-bold text-white hover:bg-gold-500/10 transition"
                    >
                      Recommencer
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="py-20" id="featuredProfiles">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
                Des repères par discipline et par besoin
              </h2>
              <p className="mt-3 text-slate-300">Ces profils servent à préparer le diagnostic, pas à promettre un résultat.</p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {featuredProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm hover:border-gold-500/40 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/20 text-gold-400 text-xl font-bold">
                      {profile.label.slice(0, 1)}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">{profile.label}</h3>
                      <div className="text-sm text-slate-300">{profile.title}</div>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-slate-300">{profile.tagline}</div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs text-slate-200">
                    {profile.stats.map((stat) => (
                      <div key={stat} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        {stat}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.tags.map((tag) => (
                      <span key={tag} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <a
                      href="/contact"
                      className="rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-black hover:bg-gold-400 transition"
                    >
                      <span className="inline-flex items-center gap-2">
                        <CalendarRange className="h-4 w-4" aria-hidden="true" />
                        Demander un diagnostic
                      </span>
                    </a>
                    <a href="/contact?sujet=accompagnement" className="rounded-full border border-gold-500 px-6 py-3 text-sm font-bold text-white hover:bg-gold-500/10 transition text-center">
                      Être conseillé
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <button
                onClick={() => directoryRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-full border border-gold-500 px-6 py-3 text-sm font-bold text-white hover:bg-gold-500/10 transition"
              >
                <span className="inline-flex items-center gap-2">
                  <Users className="h-4 w-4" aria-hidden="true" />
                  Voir tous les profils
                </span>
              </button>
            </div>
          </div>
        </section>

        <section ref={directoryRef} className="py-20 bg-black/20" id="allProfiles">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
                Profils d'accompagnement
              </h2>
              <p className="mt-3 text-slate-300">Une lecture par discipline, objectif et méthode de travail.</p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 items-center">
              <span className="text-xs text-slate-300">Filtrer par :</span>
              {filterCategories.map((category) => (
                <button
                  key={category.value}
                  onClick={() => setFilters((prev) => ({ ...prev, category: category.value }))}
                  className={`rounded-full px-3 py-1 text-xs border transition ${filters.category === category.value
                      ? "border-gold-500 bg-gold-500/10 text-gold-400"
                      : "border-white/10 text-slate-300 hover:border-gold-500/40"
                    }`}
                >
                  {category.label}
                </button>
              ))}
              <span className="text-xs text-slate-300">Disponibilité :</span>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, availability: "available" }))}
                className={`rounded-full px-3 py-1 text-xs border transition ${filters.availability === "available"
                    ? "border-emerald-400 bg-emerald-400/10 text-blue-300"
                    : "border-white/10 text-slate-300"
                  }`}
              >
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Créneaux ouverts
                </span>
              </button>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, availability: "all" }))}
                className={`rounded-full px-3 py-1 text-xs border transition ${filters.availability === "all"
                    ? "border-gold-500 bg-gold-500/10 text-gold-400"
                    : "border-white/10 text-slate-300"
                  }`}
              >
                Tous
              </button>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {visibleProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm hover:border-gold-500/40 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/20 text-gold-400 font-bold">
                      {profile.label.slice(0, 1)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{profile.label}</h3>
                      <div className="text-xs text-slate-300">{profile.subject}</div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-300">{profile.tagline}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {profile.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px]">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-gold-400" aria-hidden="true" />
                      {profile.subject}
                    </span>
                    <span className="inline-flex items-center gap-2 text-blue-300">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      {profile.capacityLabel}
                    </span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <a
                      href="/contact"
                      className="flex-1 rounded-full bg-gold-500 px-3 py-2 text-xs font-semibold text-black text-center hover:bg-gold-400 transition"
                    >
                      Diagnostic
                    </a>
                    <a href="/contact?sujet=accompagnement" className="flex-1 rounded-full border border-gold-500 px-3 py-2 text-xs font-semibold text-white hover:bg-gold-500/10 text-center">
                      Conseil
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-2">
              {visibleCount < filteredProfiles.length && (
                <button
                  onClick={() => setVisibleCount((prev) => Math.min(prev + 4, filteredProfiles.length))}
                  className="rounded-full border border-gold-500 px-6 py-3 text-sm font-semibold text-white hover:bg-gold-500/10"
                >
                  Charger plus de profils
                </button>
              )}
              <div className="text-xs text-slate-300">
                {visibleProfiles.length}/{filteredProfiles.length} profils affichés
              </div>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              Ce que le cadre Nexus ajoute à un cours isolé
            </h2>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-white">Cours isolé</h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-slate-300" aria-hidden="true" /> Objectifs parfois implicites</li>
                  <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-slate-300" aria-hidden="true" /> Suivi limité aux séances</li>
                  <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-slate-300" aria-hidden="true" /> Peu de visibilité parent</li>
                  <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-slate-300" aria-hidden="true" /> Ajustements rarement formalisés</li>
                </ul>
              </div>
              <div className="rounded-3xl border border-gold-500/40 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-white">Cadre Nexus</h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-200">
                  <li className="inline-flex items-center gap-2"><GraduationCap className="h-4 w-4 text-gold-400" aria-hidden="true" /> Approches alignées sur les attendus du système français</li>
                  <li className="inline-flex items-center gap-2"><BarChart3 className="h-4 w-4 text-gold-400" aria-hidden="true" /> Bilans et progression suivie</li>
                  <li className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-gold-400" aria-hidden="true" /> Créneaux encadrés selon la formule retenue</li>
                  <li className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-gold-400" aria-hidden="true" /> Engagement de moyens, méthode et suivi parent</li>
                  <li className="inline-flex items-center gap-2"><Compass className="h-4 w-4 text-gold-400" aria-hidden="true" /> Orientation vers les ressources utiles</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="rounded-3xl border border-gold-500/30 bg-white/5 p-10">
              <div className="flex flex-col lg:flex-row lg:items-center gap-8">
                <div className="flex-1">
                  <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
                    Commencer par un diagnostic pédagogique
                  </h2>
                  <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-gold-500/10 px-3 py-1 text-xs text-gold-400">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Orientation personnalisée
                  </div>
                  <ul className="mt-6 space-y-2 text-sm text-slate-300">
                    <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold-400" aria-hidden="true" /> Diagnostic des besoins prioritaires</li>
                    <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold-400" aria-hidden="true" /> Analyse des difficultés précises</li>
                    <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold-400" aria-hidden="true" /> Plan de travail adapté</li>
                    <li className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-gold-400" aria-hidden="true" /> Orientation vers les outils utiles selon la formule</li>
                  </ul>
                </div>
                <div className="flex-1 rounded-2xl border border-white/10 bg-black/20 p-6">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-8 w-8 text-gold-400" aria-hidden="true" />
                    <div>
                      <strong className="text-white">Un cadre ajusté après échange</strong>
                      <p className="text-sm text-slate-300">
                        La recommandation finale dépend du niveau, de l'établissement, du calendrier et des objectifs.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="text-lg font-bold text-gold-400">Bilan initial</div>
                    <div className="text-sm text-slate-300">Point de départ pour choisir la formule et le rythme.</div>
                  </div>
                  <div className="mt-6 flex flex-col gap-3">
                    <a
                      href="/bilan-gratuit"
                      className="rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-black hover:bg-gold-400 transition"
                    >
                      <span className="inline-flex items-center gap-2">
                        <CalendarRange className="h-4 w-4" aria-hidden="true" />
                        Demander un bilan gratuit
                      </span>
                    </a>
                    <a
                      href="/contact"
                      className="rounded-full border border-gold-500 px-6 py-3 text-sm font-bold text-white hover:bg-gold-500/10 transition"
                    >
                      <span className="inline-flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        Être conseillé
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
