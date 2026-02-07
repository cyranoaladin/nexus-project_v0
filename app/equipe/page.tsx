"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";

const FEATURED = ["marc", "sophie", "yassine", "helene"];

type Mentor = {
  id: string;
  name: string;
  subject: string;
  title: string;
  experience: string;
  tagline: string;
  stats: string[];
  testimonial: { quote: string; author: string };
  tags: string[];
  category: "maths" | "physique" | "nsi" | "lettres" | "orientation";
  availability: number;
  rating: number;
  specialties: string[];
  personality: string[];
  matchCriteria: {
    profile: string[];
    goal: string[];
    challenge: string[];
    style: string[];
  };
};

const MENTORS: Mentor[] = [
  {
    id: "marc",
    name: "Marc",
    subject: "Maths",
    title: "Agrégé de Mathématiques",
    experience: "22 ans d'expérience",
    tagline: "Transforme l'angoisse des équations en plaisir de la résolution",
    stats: ["+4,2 pts de moyenne", "92% mentions", "12 places/mois"],
    testimonial: {
      quote: "Marc a sauvé mon année de Terminale. En 3 mois, je suis passé de 8 à 16.",
      author: "Thomas, Terminale",
    },
    tags: ["Maths Expertes", "Spécialiste difficultés", "Méthodo Bac"],
    category: "maths",
    availability: 12,
    rating: 4.9,
    specialties: ["Algèbre", "Géométrie", "Analyse"],
    personality: ["structuré", "logique", "rigoureux"],
    matchCriteria: {
      profile: ["logique", "structuré"],
      goal: ["bac", "mention"],
      challenge: ["methodo", "comprehension"],
      style: ["visuel", "pratique"],
    },
  },
  {
    id: "sophie",
    name: "Sophie",
    subject: "Physique-Chimie",
    title: "Professeure Agrégée",
    experience: "18 ans d'expérience",
    tagline: "Rend la physique intuitive et passionnante",
    stats: ["+3,6 pts", "88% mentions", "8 places/mois"],
    testimonial: {
      quote: "Sophie m'a donné une méthode claire pour tout comprendre.",
      author: "Inès, Première",
    },
    tags: ["Physique", "Méthodo", "Prépa"],
    category: "physique",
    availability: 8,
    rating: 4.8,
    specialties: ["Mécanique", "Chimie", "Optique"],
    personality: ["curieux", "expérimental"],
    matchCriteria: {
      profile: ["curieux", "expérimental"],
      goal: ["bac", "mention"],
      challenge: ["comprehension"],
      style: ["pratique"],
    },
  },
  {
    id: "yassine",
    name: "Yassine",
    subject: "NSI & Python",
    title: "Expert NSI & Développement",
    experience: "12 ans d'expérience",
    tagline: "Le mentor qui transforme les projets en compétences durables",
    stats: ["+3,8 pts", "100% projets validés", "10 places/mois"],
    testimonial: {
      quote: "Avec Yassine j'ai enfin compris la logique de l'algorithmique.",
      author: "Ali, Terminale",
    },
    tags: ["NSI", "Python", "Projets"],
    category: "nsi",
    availability: 10,
    rating: 4.9,
    specialties: ["Algorithmique", "Python", "Web"],
    personality: ["créatif", "solutionneur"],
    matchCriteria: {
      profile: ["creatif", "solutionneur"],
      goal: ["bac", "mention"],
      challenge: ["temps", "methodo"],
      style: ["pratique", "visuel"],
    },
  },
  {
    id: "helene",
    name: "Hélène",
    subject: "Grand Oral",
    title: "Coach en Éloquence",
    experience: "15 ans d'expérience",
    tagline: "Débloque l'oral et installe la confiance",
    stats: ["+2,9 pts", "95% oraux réussis", "9 places/mois"],
    testimonial: {
      quote: "Hélène m'a appris à parler avec assurance. Le Grand Oral est devenu un plaisir.",
      author: "Sara, Terminale",
    },
    tags: ["Grand Oral", "Confiance", "Éloquence"],
    category: "lettres",
    availability: 9,
    rating: 4.8,
    specialties: ["Rhétorique", "Confiance", "Argumentation"],
    personality: ["expressif", "communicant"],
    matchCriteria: {
      profile: ["expressif", "communicant"],
      goal: ["mention"],
      challenge: ["confiance"],
      style: ["oral"],
    },
  },
  {
    id: "alexandre",
    name: "Alexandre",
    subject: "Maths",
    title: "Agrégé de Mathématiques",
    experience: "20 ans d'expérience",
    tagline: "Spécialiste de l'algèbre et de la géométrie avancée",
    stats: ["+3,4 pts", "4 places", "4.9/5"],
    testimonial: {
      quote: "Son exigence m'a fait progresser très vite.",
      author: "Yasmine, Terminale",
    },
    tags: ["Maths Expertes", "CPGE", "Analyse"],
    category: "maths",
    availability: 4,
    rating: 4.9,
    specialties: ["Algèbre", "Analyse", "CPGE"],
    personality: ["rigoureux", "structuré"],
    matchCriteria: {
      profile: ["logique"],
      goal: ["mention"],
      challenge: ["methodo"],
      style: ["visuel"],
    },
  },
  {
    id: "victor",
    name: "Victor",
    subject: "Maths Appliquées",
    title: "Professeur Certifié (CAPES)",
    experience: "14 ans d'expérience",
    tagline: "Pédagogue pragmatique, adore les problèmes concrets",
    stats: ["+3 pts", "6 places", "4.7/5"],
    testimonial: {
      quote: "Victor rend les maths simples et efficaces.",
      author: "Nour, Première",
    },
    tags: ["Maths", "Pratique", "Méthodo"],
    category: "maths",
    availability: 6,
    rating: 4.7,
    specialties: ["Probabilités", "Applications", "Exos"],
    personality: ["pratique"],
    matchCriteria: {
      profile: ["logique"],
      goal: ["bac"],
      challenge: ["comprehension"],
      style: ["pratique"],
    },
  },
  {
    id: "fabien",
    name: "Fabien",
    subject: "Physique-Chimie",
    title: "Professeur Certifié",
    experience: "13 ans d'expérience",
    tagline: "Maîtrise la chimie et les problématiques d'examens",
    stats: ["+2,7 pts", "5 places", "4.8/5"],
    testimonial: {
      quote: "Avec Fabien j'ai enfin compris les réactions chimiques.",
      author: "Leila, Première",
    },
    tags: ["Physique", "Chimie", "Exams"],
    category: "physique",
    availability: 5,
    rating: 4.8,
    specialties: ["Chimie", "Mécanique", "Thermo"],
    personality: ["curieux"],
    matchCriteria: {
      profile: ["curieux"],
      goal: ["bac"],
      challenge: ["comprehension"],
      style: ["pratique"],
    },
  },
  {
    id: "olivier",
    name: "Olivier",
    subject: "Physique",
    title: "Professeur Agrégé",
    experience: "19 ans d'expérience",
    tagline: "Passionné par la physique théorique et les défis",
    stats: ["+3,1 pts", "4 places", "4.9/5"],
    testimonial: {
      quote: "Olivier m'a poussé à viser la mention.",
      author: "Amin, Terminale",
    },
    tags: ["Physique", "Prépa", "Analyse"],
    category: "physique",
    availability: 4,
    rating: 4.9,
    specialties: ["Mécanique", "Optique", "Modèles"],
    personality: ["logique"],
    matchCriteria: {
      profile: ["logique"],
      goal: ["mention"],
      challenge: ["methodo"],
      style: ["visuel"],
    },
  },
  {
    id: "rachid",
    name: "Rachid",
    subject: "NSI",
    title: "Ingénieur & Mentor NSI",
    experience: "11 ans d'expérience",
    tagline: "Spécialiste des projets et de la préparation Bac",
    stats: ["+3,2 pts", "7 places", "4.8/5"],
    testimonial: {
      quote: "Rachid m'a aidé à réussir mon projet final.",
      author: "Youssef, Terminale",
    },
    tags: ["NSI", "Projets", "Algorithmique"],
    category: "nsi",
    availability: 7,
    rating: 4.8,
    specialties: ["Projets", "Python", "Bac"],
    personality: ["créatif"],
    matchCriteria: {
      profile: ["creatif"],
      goal: ["bac"],
      challenge: ["temps"],
      style: ["pratique"],
    },
  },
  {
    id: "karim",
    name: "Karim",
    subject: "NSI & Systèmes",
    title: "Expert systèmes",
    experience: "16 ans d'expérience",
    tagline: "Aide à comprendre l'architecture et la logique informatique",
    stats: ["+3,5 pts", "6 places", "4.9/5"],
    testimonial: {
      quote: "Karim m'a donné une vraie méthode en NSI.",
      author: "Omar, Terminale",
    },
    tags: ["NSI", "Systèmes", "Réseaux"],
    category: "nsi",
    availability: 6,
    rating: 4.9,
    specialties: ["Systèmes", "Réseaux", "Python"],
    personality: ["structuré"],
    matchCriteria: {
      profile: ["structuré"],
      goal: ["mention"],
      challenge: ["methodo"],
      style: ["visuel"],
    },
  },
  {
    id: "sarah",
    name: "Sarah",
    subject: "Français",
    title: "Professeure Certifiée",
    experience: "17 ans d'expérience",
    tagline: "Spécialiste de l'écrit et des analyses de textes",
    stats: ["+2,8 pts", "5 places", "4.8/5"],
    testimonial: {
      quote: "Sarah m'a donné une vraie méthode pour les commentaires.",
      author: "Amira, Première",
    },
    tags: ["Français", "Écrit", "Analyse"],
    category: "lettres",
    availability: 5,
    rating: 4.8,
    specialties: ["Écrit", "Analyse", "Méthodo"],
    personality: ["expressif"],
    matchCriteria: {
      profile: ["expressif"],
      goal: ["bac"],
      challenge: ["confiance"],
      style: ["oral"],
    },
  },
  {
    id: "pierre",
    name: "Pierre",
    subject: "Orientation",
    title: "Conseiller Parcoursup",
    experience: "10 ans d'expérience",
    tagline: "Stratégie d'orientation et coaching entretien",
    stats: ["+200 dossiers", "4 places", "4.7/5"],
    testimonial: {
      quote: "Pierre a rendu Parcoursup clair et stratégique.",
      author: "Nadia, Parent",
    },
    tags: ["Orientation", "Parcoursup", "Coaching"],
    category: "orientation",
    availability: 4,
    rating: 4.7,
    specialties: ["Parcoursup", "Coaching", "Dossiers"],
    personality: ["communicant"],
    matchCriteria: {
      profile: ["expressif"],
      goal: ["parcoursup"],
      challenge: ["confiance"],
      style: ["oral"],
    },
  },
  {
    id: "clara",
    name: "Clara",
    subject: "Coordination",
    title: "Responsable pédagogique",
    experience: "12 ans d'expérience",
    tagline: "Suivi personnalisé et coordination des parcours",
    stats: ["+95% satisfaction", "6 places", "4.9/5"],
    testimonial: {
      quote: "Clara a organisé notre parcours avec précision.",
      author: "Mme Trabelsi",
    },
    tags: ["Suivi", "Coordination", "Familles"],
    category: "orientation",
    availability: 6,
    rating: 4.9,
    specialties: ["Suivi", "Planification", "Conseil"],
    personality: ["structuré", "communicant"],
    matchCriteria: {
      profile: ["structuré"],
      goal: ["bac", "mention"],
      challenge: ["confiance"],
      style: ["oral"],
    },
  },
];

const quizQuestions = [
  {
    key: "profile",
    question: "Quel mot décrit le mieux votre enfant ?",
    options: [
      { value: "logique", label: "Logique et structuré", icon: "🔢" },
      { value: "curieux", label: "Curieux et expérimental", icon: "🔬" },
      { value: "creatif", label: "Créatif et solutionneur", icon: "💻" },
      { value: "expressif", label: "Expressif et communicant", icon: "🎤" },
    ],
  },
  {
    key: "goal",
    question: "Son objectif principal est :",
    options: [
      { value: "bac", label: "Réussir le Bac", icon: "🎓" },
      { value: "mention", label: "Obtenir une mention", icon: "🏅" },
      { value: "parcoursup", label: "Réussir Parcoursup", icon: "🧭" },
      { value: "combine", label: "Tout cela à la fois", icon: "✨" },
    ],
  },
  {
    key: "challenge",
    question: "Son principal défi est :",
    options: [
      { value: "methodo", label: "Méthodologie", icon: "📘" },
      { value: "comprehension", label: "Compréhension", icon: "🧠" },
      { value: "temps", label: "Manque de temps", icon: "⏱️" },
      { value: "confiance", label: "Manque de confiance", icon: "💬" },
    ],
  },
  {
    key: "style",
    question: "Quel style d'apprentissage lui convient ?",
    options: [
      { value: "visuel", label: "Visuel et structuré", icon: "🧩" },
      { value: "pratique", label: "Pratique et concret", icon: "🧪" },
      { value: "oral", label: "Oral et interactif", icon: "🎙️" },
      { value: "autonome", label: "Autonome avec guidance", icon: "🚀" },
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
  const mentorsRef = useRef<HTMLDivElement | null>(null);
  const allExpertsRef = useRef<HTMLDivElement | null>(null);

  const [filters, setFilters] = useState({ category: "all", availability: "all" });
  const [visibleCount, setVisibleCount] = useState(8);
  const [quizStep, setQuizStep] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<Mentor | null>(null);
  const [counters, setCounters] = useState({
    agr: 0,
    mentions: 0,
    satisfaction: 0,
    students: 0,
  });

  useEffect(() => {
    const targets = { agr: 100, mentions: 150, satisfaction: 98, students: 500 };
    let frame = 0;
    const total = 80;
    const interval = setInterval(() => {
      frame += 1;
      setCounters({
        agr: Math.min(Math.round((targets.agr * frame) / total), targets.agr),
        mentions: Math.min(Math.round((targets.mentions * frame) / total), targets.mentions),
        satisfaction: Math.min(Math.round((targets.satisfaction * frame) / total), targets.satisfaction),
        students: Math.min(Math.round((targets.students * frame) / total), targets.students),
      });
      if (frame >= total) clearInterval(interval);
    }, 20);
    return () => clearInterval(interval);
  }, []);

  const featuredMentors = useMemo(() => MENTORS.filter((m) => FEATURED.includes(m.id)), []);

  const filteredMentors = useMemo(() => {
    return MENTORS.filter((mentor) => {
      const categoryMatch = filters.category === "all" || mentor.category === filters.category;
      const availabilityMatch =
        filters.availability === "all" ||
        (filters.availability === "available" && mentor.availability > 0);
      return categoryMatch && availabilityMatch;
    });
  }, [filters]);

  const visibleMentors = filteredMentors.slice(0, visibleCount);

  const calculateMatch = (answers: Record<string, string>) => {
    const scored = MENTORS.map((mentor) => {
      let score = 0;
      if (answers.profile && mentor.matchCriteria.profile.includes(answers.profile)) score += 30;
      if (answers.goal && mentor.matchCriteria.goal.includes(answers.goal)) score += 25;
      if (answers.challenge && mentor.matchCriteria.challenge.includes(answers.challenge)) score += 25;
      if (answers.style && mentor.matchCriteria.style.includes(answers.style)) score += 20;
      return { mentor, score };
    }).sort((a, b) => b.score - a.score);

    return scored[0].mentor;
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
    <div className="min-h-screen bg-midnight-950 text-slate-200">

      <main className="pb-20">
        {/* HERO */}
        <section className="relative overflow-hidden py-20">
          <div className="absolute inset-0 bg-gradient-to-b from-midnight-950 via-midnight-950/70 to-midnight-950" />
          <div className="absolute -top-20 right-10 h-72 w-72 rounded-full bg-gold-500/10 blur-[140px]" />
          <div className="container relative z-10 mx-auto px-4 md:px-6">
            <div className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr] items-center">
              <div>
                <h1 className="text-4xl md:text-6xl font-bold text-white font-serif">
                  L&apos;élite pédagogique qui transforme l&apos;angoisse en excellence
                </h1>
                <p className="mt-4 text-lg text-slate-300">
                  Sélectionnés parmi 1% des candidats. Unis par une obsession :
                  <strong className="text-white"> +4,2 points de moyenne</strong> pour chaque élève.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { value: `${counters.agr}%`, label: "Agrégés/Certifiés" },
                    { value: `${counters.mentions}+`, label: "Mentions TB" },
                    { value: `${counters.satisfaction}%`, label: "Satisfaction" },
                    { value: `${counters.students}+`, label: "Élèves accompagnés" },
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
                    onClick={() => mentorsRef.current?.scrollIntoView({ behavior: "smooth" })}
                    className="rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-black hover:bg-gold-400 transition"
                  >
                    🎯 Trouver mon mentor idéal
                  </button>
                  <button
                    onClick={() => allExpertsRef.current?.scrollIntoView({ behavior: "smooth" })}
                    className="rounded-full border border-gold-500 px-6 py-3 text-sm font-bold text-white hover:bg-gold-500/10 transition"
                  >
                    👥 Voir toute l&apos;équipe
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-6 rounded-full bg-gold-500/10 blur-3xl" />
                <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-md">
                  <div className="grid grid-cols-2 gap-4">
                    {featuredMentors.map((mentor) => (
                      <div key={mentor.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/20 text-gold-400 font-bold">
                          {mentor.name.slice(0, 1)}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-white">{mentor.name}</div>
                        <div className="text-xs text-slate-400">{mentor.subject}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* QUIZ */}
        <section ref={mentorsRef} className="py-20 bg-black/20" id="matchingQuiz">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
                Trouvez le mentor qui parle le même langage que votre enfant
              </h2>
              <p className="mt-3 text-slate-300">
                4 questions pour une recommandation personnalisée
              </p>
            </div>

            <div className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-8">
              <div className="mb-6">
                <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                  {quizQuestions.map((q, index) => (
                    <div
                      key={q.key}
                      className={`rounded-full px-3 py-1 border ${
                        index <= quizStep ? "border-gold-500/50 text-gold-400" : "border-white/10"
                      }`}
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
                        <span className="mr-2">{option.icon}</span>
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
                        ← Précédent
                      </button>
                    )}
                    <button
                      onClick={() => allExpertsRef.current?.scrollIntoView({ behavior: "smooth" })}
                      className="rounded-full border border-white/10 px-4 py-2 text-xs text-slate-300 hover:text-white"
                    >
                      Passer au directoire
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-gold-500/40 bg-black/30 p-6">
                  <div className="flex flex-col gap-6 md:flex-row md:items-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gold-500/20 text-gold-400 text-3xl font-bold">
                      {quizResult.name.slice(0, 1)}
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        Votre mentor idéal : {quizResult.name}
                      </h3>
                      <p className="mt-2 text-slate-300">{quizResult.tagline}</p>
                      <div className="mt-2 text-sm text-gold-400">
                        {quizResult.stats[0]} · {quizResult.experience}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex flex-col sm:flex-row gap-3">
                    <a
                      href="/contact"
                      className="rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-black hover:bg-gold-400 transition"
                    >
                      Réserver un diagnostic avec {quizResult.name}
                    </a>
                    <button
                      onClick={resetQuiz}
                      className="rounded-full border border-gold-500 px-6 py-3 text-sm font-bold text-white hover:bg-gold-500/10 transition"
                    >
                      Voir 2 alternatives
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* FEATURED MENTORS */}
        <section className="py-20" id="featuredMentors">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
                Les mentors qui ont déjà transformé 500+ parcours
              </h2>
              <p className="mt-3 text-slate-300">Découvrez nos 4 experts les plus demandés</p>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {featuredMentors.map((mentor, index) => (
                <div
                  key={mentor.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm hover:border-gold-500/40 transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-500/20 text-gold-400 text-xl font-bold">
                        {mentor.name.slice(0, 1)}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">{mentor.name}</h3>
                        <div className="text-sm text-slate-300">{mentor.title}</div>
                      </div>
                    </div>
                    {index === 0 && (
                      <span className="rounded-full bg-gold-500/10 px-3 py-1 text-xs text-gold-400">
                        🔥 PLUS DEMANDÉ
                      </span>
                    )}
                  </div>

                  <div className="mt-4 text-sm text-slate-300">“{mentor.tagline}”</div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3 text-xs text-slate-200">
                    {mentor.stats.map((stat) => (
                      <div key={stat} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        {stat}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 text-xs text-slate-400">
                    “{mentor.testimonial.quote}” — {mentor.testimonial.author}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {mentor.tags.map((tag) => (
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
                      📅 Réserver un diagnostic
                    </a>
                    <a href="/contact?sujet=profil-mentor" className="rounded-full border border-gold-500 px-6 py-3 text-sm font-bold text-white hover:bg-gold-500/10 transition text-center">
                      Voir le profil complet
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <button
                onClick={() => allExpertsRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-full border border-gold-500 px-6 py-3 text-sm font-bold text-white hover:bg-gold-500/10 transition"
              >
                👥 Voir tous nos experts spécialisés
              </button>
            </div>
          </div>
        </section>

        {/* DIRECTORY */}
        <section ref={allExpertsRef} className="py-20 bg-black/20" id="allExperts">
          <div className="container mx-auto px-4 md:px-6">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
                Notre Panthéon d&apos;Experts
              </h2>
              <p className="mt-3 text-slate-300">12 spécialistes, chacun maître dans son domaine</p>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 items-center">
              <span className="text-xs text-slate-400">Filtrer par :</span>
              {filterCategories.map((category) => (
                <button
                  key={category.value}
                  onClick={() => setFilters((prev) => ({ ...prev, category: category.value }))}
                  className={`rounded-full px-3 py-1 text-xs border transition ${
                    filters.category === category.value
                      ? "border-gold-500 bg-gold-500/10 text-gold-400"
                      : "border-white/10 text-slate-300 hover:border-gold-500/40"
                  }`}
                >
                  {category.label}
                </button>
              ))}
              <span className="text-xs text-slate-400">Disponibilité :</span>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, availability: "available" }))}
                className={`rounded-full px-3 py-1 text-xs border transition ${
                  filters.availability === "available"
                    ? "border-emerald-400 bg-emerald-400/10 text-emerald-300"
                    : "border-white/10 text-slate-300"
                }`}
              >
                🟢 Disponible
              </button>
              <button
                onClick={() => setFilters((prev) => ({ ...prev, availability: "all" }))}
                className={`rounded-full px-3 py-1 text-xs border transition ${
                  filters.availability === "all"
                    ? "border-gold-500 bg-gold-500/10 text-gold-400"
                    : "border-white/10 text-slate-300"
                }`}
              >
                Tous
              </button>
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {visibleMentors.map((mentor) => (
                <div
                  key={mentor.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm hover:border-gold-500/40 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/20 text-gold-400 font-bold">
                      {mentor.name.slice(0, 1)}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{mentor.name}</h4>
                      <div className="text-xs text-slate-400">{mentor.title}</div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-300">{mentor.tagline}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {mentor.tags.slice(0, 2).map((tag) => (
                      <span key={tag} className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px]">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                    <span>⭐ {mentor.rating.toFixed(1)}</span>
                    <span className="text-emerald-300">🟢 {mentor.availability} places</span>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <a
                      href="/contact"
                      className="flex-1 rounded-full bg-gold-500 px-3 py-2 text-xs font-semibold text-black text-center hover:bg-gold-400 transition"
                    >
                      Réserver
                    </a>
                    <a href="/contact?sujet=profil-mentor" className="flex-1 rounded-full border border-gold-500 px-3 py-2 text-xs font-semibold text-white hover:bg-gold-500/10 text-center">
                      Profil
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-col items-center gap-2">
              {visibleCount < filteredMentors.length && (
                <button
                  onClick={() => setVisibleCount((prev) => Math.min(prev + 4, filteredMentors.length))}
                  className="rounded-full border border-gold-500 px-6 py-3 text-sm font-semibold text-white hover:bg-gold-500/10"
                >
                  Charger plus d&apos;experts
                </button>
              )}
              <div className="text-xs text-slate-400">
                {visibleMentors.length}/{filteredMentors.length} experts affichés
              </div>
            </div>
          </div>
        </section>

        {/* COMPARAISON */}
        <section className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              Pourquoi nos experts valent 2× un professeur classique
            </h2>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-white">Professeur Classique</h3>
                <div className="mt-2 text-sm text-slate-400">~60 TND/h</div>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  <li>✅ Diplôme variable</li>
                  <li>✅ Suivi limité aux cours</li>
                  <li>✅ Disponibilité restreinte</li>
                  <li>✅ Pas de garantie</li>
                  <li>✅ Aucun dashboard</li>
                </ul>
              </div>
              <div className="rounded-3xl border border-gold-500/40 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-white">Expert Nexus</h3>
                  <span className="rounded-full bg-gold-500/10 px-3 py-1 text-xs text-gold-400">MEILLEUR ROI</span>
                </div>
                <div className="mt-2 text-sm text-slate-300">37 TND/h*</div>
                <ul className="mt-4 space-y-2 text-sm text-slate-200">
                  <li>🎓 100% Agrégés/Certifiés</li>
                  <li>📊 Dashboard + IA ARIA 24/7</li>
                  <li>⏰ Disponibilité illimitée</li>
                  <li>🛡️ Garantie résultats</li>
                  <li>🧭 Coaching orientation inclus</li>
                </ul>
                <div className="mt-4 text-xs text-slate-400">
                  *Basé sur Programme Excellence (299 TND/mois pour 8h)
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRIAL */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="rounded-3xl border border-gold-500/30 bg-white/5 p-10">
              <div className="flex flex-col lg:flex-row lg:items-center gap-8">
                <div className="flex-1">
                  <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
                    Essayez sans le moindre risque
                  </h2>
                  <div className="mt-2 inline-flex items-center rounded-full bg-gold-500/10 px-3 py-1 text-xs text-gold-400">
                    🛡️ GARANTIE SATISFACTION
                  </div>
                  <ul className="mt-6 space-y-2 text-sm text-slate-300">
                    <li>✅ Diagnostic personnalisé avec l&apos;expert</li>
                    <li>✅ Analyse des difficultés précises</li>
                    <li>✅ Plan d&apos;action sur mesure</li>
                    <li>✅ Accès ARIA 7 jours gratuit</li>
                  </ul>
                </div>
                <div className="flex-1 rounded-2xl border border-white/10 bg-black/20 p-6">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">💯</div>
                    <div>
                      <strong className="text-white">Si le courant ne passe pas</strong>
                      <p className="text-sm text-slate-300">
                        Nous remboursons ou changeons de professeur immédiatement.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="text-3xl font-bold text-gold-400">30 TND</div>
                    <div className="text-sm text-slate-400">au lieu de 60 TND pour le premier cours</div>
                  </div>
                  <div className="mt-6 flex flex-col gap-3">
                    <a
                      href="/contact"
                      className="rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-black hover:bg-gold-400 transition"
                    >
                      📅 Réserver mon cours d&apos;essai
                    </a>
                    <a
                      href="/contact"
                      className="rounded-full border border-gold-500 px-6 py-3 text-sm font-bold text-white hover:bg-gold-500/10 transition"
                    >
                      💬 Demander conseil à ARIA
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
