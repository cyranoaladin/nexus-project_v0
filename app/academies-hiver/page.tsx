"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck, Star, TrendingUp } from "lucide-react";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { CorporateFooter } from "@/components/layout/CorporateFooter";

const ACADEMIES = [
  // TERMINALE
  {
    id: "maths-bac-garanti",
    title: "🛡️ MATHS : PROTOCOLE SÉCURITÉ",
    badge: "SÉCURITÉ DOSSIER",
    price: 590,
    early: 502,
    tier: "essentielle",
    audience: "Terminale EDS Maths",
    duration: "24h (20h Maths + 4h Python)",
    group: "6 élèves max",
    expert: "Professeur Agrégé",
    category: ["terminale", "maths", "essentielle", "budget"],
    description: "Ne jouez pas à la roulette russe avec votre moyenne. Verrouillez le 14/20.",
    features: [
      "Analyse Tactique : Ne plus jamais bloquer sur une Suite",
      "Géométrie 3D : La méthode visuelle pour plier l'exo en 15 min",
      "Rédaction 'Jury-Proof' : Les phrases qui déclenchent les points",
      "Bonus : Le Hack Calculatrice pour vérifier vos résultats",
    ],
    seats: 5,
    tone: "essential",
    cta: "Sécuriser mon Bac",
  },
  {
    id: "maths-mention-max",
    title: "👑 MATHS : MAJOR & TESCIA",
    badge: "VISER L'ÉLITE",
    price: 990,
    early: 842,
    tier: "premium",
    audience: "Terminale Maths Expertes + Prépas",
    duration: "32h",
    group: "6 élèves max",
    expert: "Agrégé & Jury Concours",
    category: ["terminale", "maths", "premium"],
    description: "Le programme des Prépas d'élite. Pour ceux qui trouvent le 16/20 banal.",
    features: [
      "Hors-Piste : Arithmétique & Équations Diff. (Niveau MPSI)",
      "Avantage Concurrentiel : Certification TeSciA (Logique & QCM)",
      "Grand Oral : Devenez l'orateur que le jury n'oubliera pas",
      "Objectif : Dossier Louis-le-Grand / Ginette / EPFL",
    ],
    seats: 3,
    tone: "premium",
    cta: "Rejoindre l'Élite",
  },
  {
    id: "nsi-commando",
    title: "💻 NSI : CRASH-TEST ECE",
    badge: "URGENCE BAC",
    price: 590,
    early: 502,
    tier: "essentielle",
    audience: "Terminale EDS NSI",
    duration: "24h",
    group: "6 élèves max",
    expert: "Expert NSI & Jury ECE",
    category: ["terminale", "nsi", "essentielle", "budget"],
    description: "L'épreuve pratique est un champ de mines. Nous vous donnons le démineur.",
    features: [
      "Simulateur ECE : Coding sous pression en conditions réelles",
      "Kit de Survie : Les 10 algorithmes à connaître par cœur",
      "SQL & Data : Maîtriser les requêtes complexes pour l'écrit",
      "Debug Express : Repérer une erreur en moins de 120 secondes",
    ],
    seats: 4,
    tone: "essential",
    cta: "Sauver mon ECE",
  },

  // PREMIERE
  {
    id: "maths-strategiques",
    title: "🏗️ MATHS : REBOOT & FONDATIONS",
    badge: "PACK PREMIÈRE",
    price: 490,
    early: 417,
    tier: "essentielle",
    audience: "Première EDS Maths",
    duration: "20h",
    group: "6 élèves max",
    expert: "Professeur Lycée",
    category: ["premiere", "maths", "essentielle", "budget"],
    description: "Stoppez l'hémorragie. Transformez vos lacunes en socle solide.",
    features: [
      "Déclic Dérivation : Comprendre enfin le sens des variations",
      "Spécial 'Fin de Spé' : Training intensif pour l'épreuve écrite finale",
      "Python Starter : Les scripts indispensables pour ne pas couler",
      "Méthodologie : Comment gratter des points 'gratuits' sur la forme",
    ],
    seats: 6,
    tone: "essential",
    cta: "Redémarrer du bon pied",
  },
  {
    id: "maths-premiere-excellence",
    title: "🚀 MATHS : HORS-NORME (PRÉPA)",
    badge: "OBJECTIF MENTION",
    price: 990,
    early: 842,
    tier: "premium",
    audience: "Première VIsant Maths Expertes",
    duration: "30h",
    group: "6 élèves max",
    expert: "Agrégé de Mathématiques",
    category: ["premiere", "maths", "premium"],
    description: "Pourquoi attendre la Terminale ? Prenez 6 mois d'avance sur la concurrence.",
    features: [
      "Anticipation : Initiation aux Limites et à la Continuité",
      "Challenge : Problèmes ouverts type Concours Général",
      "Produit Scalaire Expert : La clé de voûte de la géométrie vectorielle",
      "Asset Parcoursup : Un bulletin de Première qui impressionne",
    ],
    seats: 4,
    tone: "premium",
    cta: "Prendre le Lead",
  },
  {
    id: "nsi-decouverte",
    title: "🌐 NSI : START-UP & WEB",
    badge: "CODING STARTER",
    price: 490,
    early: 417,
    tier: "essentielle",
    audience: "Première Spé NSI",
    duration: "20h",
    group: "6 élèves max",
    expert: "Professeur NSI",
    category: ["premiere", "nsi", "essentielle", "budget"],
    description: "Passez de l'autre côté de l'écran. Comprenez (enfin) ce que vous codez.",
    features: [
      "Web Design : Créer et publier une page HTML/CSS pro",
      "Logique Python : Boucles & Conditions sans douleur",
      "Données : Manipuler des fichiers CSV comme un Data Analyst",
      "Projet : Un premier site fonctionnel à montrer",
    ],
    seats: 6,
    tone: "essential",
    cta: "Valider la NSI",
  },
  {
    id: "nsi-premiere-avance",
    title: "🤖 NSI : ENGINEERING & MAKER",
    badge: "FUTUR INGÉNIEUR",
    price: 990,
    early: 842,
    tier: "premium",
    audience: "Première NSI Passionnés",
    duration: "30h",
    group: "6 élèves max",
    expert: "Ingénieur & Professeur",
    category: ["premiere", "nsi", "premium"],
    description: "Ne soyez pas utilisateur. Soyez Créateur. Le niveau ingénieur dès la Première.",
    features: [
      "Algo Pure : Complexité, Tris et Gloutons expliqués",
      "Full Stack : Développer un site dynamique ou un jeu (PyGame)",
      "Architecture : Comprendre Linux et l'OS (Operating System)",
      "Portfolio Github : Votre premier atout pour un dossier Tech",
    ],
    seats: 4,
    tone: "premium",
    cta: "Devenir Ingénieur",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Tout le monde avait 16 en maths dans ma classe. Avec le module TeSciA de Nexus, j'ai pu montrer à Louis-le-Grand que je savais vraiment raisonner. Admis.",
    author: "Thomas L.",
    role: "Prépa MPSI",
    stats: ["Admis Louis-le-Grand", "Top 1% TeSciA"],
  },
];

const PROGRAMS = [
  {
    title: "🛡️ MATHS : PROTOCOLE SÉCURITÉ (Terminale)",
    blocks: [
      "J1-J2 : Analyse & Fonctions (Suites, Logarithmes, Continuité)",
      "J3-J4 : Géométrie dans l'Espace & Calcul Vectoriel",
      "J5 : Probabilités & Variables Aléatoires",
      "J6 : Bac Blanc (4h) + Correction Détaillée"
    ],
    total: "24h (20h Maths + 4h Python)"
  },
  {
    title: "👑 MATHS : MAJOR & TESCIA (Terminale)",
    blocks: [
      "Module 1 : Arithmétique (Congruences, Divisibilité)",
      "Module 2 : Équations Différentielles & Primitives",
      "Module 3 : Préparation TeSciA (Logique, Dénombrement)",
      "Module 4 : Grand Oral & Oraux de Concours"
    ],
    total: "32h Excellence"
  },
  {
    title: "💻 NSI : CRASH-TEST ECE (Terminale)",
    blocks: [
      "Jour 1-2 : Structures de Données (Arbres, Graphes, Piles/Files)",
      "Jour 3 : Bases de Données (SQL, Modèle Relationnel)",
      "Jour 4 : Programmation Orientée Objet & Algorithmique",
      "Jour 5-6 : Entraînement ECE Intensif (Sujets 2024/2025)"
    ],
    total: "24h Pratique"
  },
  {
    title: "🏗️ MATHS : REBOOT & FONDATIONS (Première)",
    blocks: [
      "Bloc 1 : Maîtrise de la Dérivation & Applications",
      "Bloc 2 : Produit Scalaire & Géométrie",
      "Bloc 3 : Probabilités Conditionnelles",
      "Bonus : Introduction aux Suites Numériques pour la Terminale"
    ],
    total: "20h Fondations"
  },
  {
    title: "🚀 MATHS : HORS-NORME / PRÉPA (Première)",
    blocks: [
      "Module 1 : Analyse Avancée & Optimisation",
      "Module 2 : Géométrie Vectorielle & Produit Scalaire",
      "Module 3 : Anticipation Terminale (Suites & Limites)",
      "Module 4 : Python Scientifique & Simulation"
    ],
    total: "30h Excellence"
  },
  {
    title: "🌐 NSI : START-UP & WEB (Première)",
    blocks: [
      "J1-J2 : Web (HTML/CSS) & Interactions",
      "J3 : Python Fondamental (Types, Boucles, Cond.)",
      "J4 : Traitement de Données & Tables CSV",
      "J5 : Mini-Projet : Créer son site statique"
    ],
    total: "20h Pratique"
  },
  {
    title: "🤖 NSI : ENGINEERING & MAKER (Première)",
    blocks: [
      "Bloc 1 : Algorithmes Gloutons & Tris",
      "Bloc 2 : Projet Web Dynamique (Serveur/Client)",
      "Bloc 3 : Architecture Machine & OS",
      "Bloc 4 : Initiation Programmation Orientée Objet"
    ],
    total: "30h Maker"
  }
];

const PLANNING = [
  {
    day: "Matin (09h-12h)",
    slots: [
      "Bloc Théorie & Méthodologie",
      "Reverse Engineering des sujets",
      "Analyse des pièges classiques",
      "Techniques de résolution rapide",
    ],
  },
  {
    day: "Midi (12h-13h)",
    slots: [
      "Pause Déjeuner",
      "Networking Élèves/Profs",
      "Détente & Discussions Orientation",
    ],
  },
  {
    day: "Après-midi (13h-15h30)",
    slots: [
      "Entraînement Intensif",
      "Labo de Code (NSI)",
      "Résolution de problèmes complexes",
      "Exercices types Bac & Concours",
    ],
  },
  {
    day: "Fin d'aprem (15h30-16h30)",
    slots: [
      "Option Grand Oral",
      "Coaching Mental & Gestion du stress",
      "Debriefing personnalisé",
      "Points d'étape individuels",
    ],
  },
];



const MATERIALS = {
  maths: [
    "Calculatrice scientifique",
    "Accès Jupyter Notebook (fourni)",
  ],
  nsi: [
    "Ordinateur portable personnel",
    "Python 3.8+ installé",
    "IDE : Thonny (recommandé pour le Bac) ou VS Code",
  ],

};

export default function AcademiesHiverPage() {
  const [filter, setFilter] = useState("all");
  const [level, setLevel] = useState("both");
  const [helper, setHelper] = useState({ budget: "", goal: "", level: "", subject: "maths" });

  const [selectedAcademy, setSelectedAcademy] = useState(ACADEMIES[0]);
  const [countdown, setCountdown] = useState({ days: "05", hours: "12", minutes: "45" });
  const [stats, setStats] = useState({ satisfaction: 0, progress: 0, mentions: 0 });

  const [simAvg, setSimAvg] = useState(12);
  const [formData, setFormData] = useState({ parent: "", phone: "", classe: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);


  useEffect(() => {
    const targets = { satisfaction: 98, progress: 4.2, mentions: 150 };
    let frame = 0;
    const total = 80;
    const timer = setInterval(() => {
      frame += 1;
      setStats({
        satisfaction: Math.min(Math.round((targets.satisfaction * frame) / total), targets.satisfaction),
        progress: Math.min(Number(((targets.progress * frame) / total).toFixed(1)), targets.progress),
        mentions: Math.min(Math.round((targets.mentions * frame) / total), targets.mentions),
      });
      if (frame >= total) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const deadline = new Date("2026-02-10T23:59:59");
    const interval = setInterval(() => {
      const diff = deadline.getTime() - Date.now();
      const days = Math.max(Math.floor(diff / (1000 * 60 * 60 * 24)), 0);
      const hours = Math.max(Math.floor((diff / (1000 * 60 * 60)) % 24), 0);
      const minutes = Math.max(Math.floor((diff / (1000 * 60)) % 60), 0);
      setCountdown({
        days: String(days).padStart(2, "0"),
        hours: String(hours).padStart(2, "0"),
        minutes: String(minutes).padStart(2, "0"),
      });
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");
    if (!formData.parent.trim() || !formData.phone.trim() || !formData.classe.trim()) {
      alert("Merci de compléter tous les champs avant de réserver.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent: formData.parent,
          phone: formData.phone,
          classe: formData.classe,
          academyId: selectedAcademy.id,
          academyTitle: selectedAcademy.title,
          price: selectedAcademy.early,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Erreur lors de l'envoi.");
      }
      setIsSuccess(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Erreur lors de l'envoi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredAcademies = useMemo(() => {
    const byLevel = level === "both" ? ACADEMIES : ACADEMIES.filter((a) => a.category.includes(level));
    if (filter === "all") return byLevel;
    if (filter === "budget") return byLevel.filter((a) => a.category.includes("budget"));
    return byLevel.filter((a) => a.category.includes(filter));
  }, [filter, level]);

  const getAcademyById = (academyId: string) =>
    ACADEMIES.find((academy) => academy.id === academyId) || ACADEMIES[0];

  const recommendation = useMemo(() => {
    const subject = helper.subject === "nsi" ? "nsi" : "maths";
    const isPremiere = level === "premiere";
    const isHighBudget = helper.budget === "950";

    if (isPremiere) {
      if (subject === "nsi") {
        if (isHighBudget) return getAcademyById("nsi-premiere-avance");
        return getAcademyById("nsi-decouverte");
      }
      // Maths Premiere
      if (isHighBudget) return getAcademyById("maths-premiere-excellence");
      return getAcademyById("maths-strategiques");
    }

    if (subject === "nsi") {
      if (simAvg < 11) return getAcademyById("nsi-pratique-ecrit");
      if (isHighBudget) return getAcademyById("nsi-excellence");
      return getAcademyById("nsi-pratique-ecrit");
    }

    if (simAvg < 11) return getAcademyById("maths-bac-garanti");
    if (isHighBudget) return getAcademyById("maths-mention-max");
    return getAcademyById("maths-bac-garanti");
  }, [helper.subject, helper.budget, level, simAvg]);



  useEffect(() => {
    if (recommendation) setSelectedAcademy(recommendation);
  }, [recommendation]);

  const focusAcademyCard = (academyId: string) => {
    const element = document.getElementById(academyId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedId(academyId);
      window.setTimeout(() => setHighlightedId(null), 1400);
    }
  };





  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100 font-sans stages-dark">
      <CorporateNavbar />

      <style jsx global>{`
        html {
          scroll-padding-top: 100px;
        }
        /* AEFE Style Overrides */
        .academy-highlight {
          animation: academyPulse 1.2s ease-in-out 2;
          border-color: #EF4444 !important; /* Red highlight */
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.25);
        }
        .rec-pulse {
          animation: recPulse 0.6s ease-in-out;
        }
        @keyframes academyPulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.35); }
          50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes recPulse {
          0% { transform: scale(1); color: #2563EB; }
          50% { transform: scale(1.02); color: #EF4444; }
          100% { transform: scale(1); color: #2563EB; }
        }
      `}</style>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden py-24 bg-gradient-to-b from-blue-900 via-nexus-blue to-blue-800 text-white">
          {/* Subtle pattern or shapes for French "Marianne" feel or just geometric */}
          <div className="absolute top-0 right-0 h-96 w-96 rounded-full bg-white/10 blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-nexus-red/20 blur-[120px] pointer-events-none" />

          <div className="container relative z-10 mx-auto px-4 md:px-6">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold text-white uppercase tracking-wide">
                  <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                  Inscriptions ouvertes jusqu'au 10/02
                </div>
                <h1 className="marketing-hero-title mt-8 font-extrabold tracking-tight leading-tight">
                  STAGES FÉVRIER <br />
                  <span className="text-white">OBJECTIF MENTION</span>
                </h1>
                <div className="mt-8 space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <span className="text-xl">🎓</span>
                    <div>
                      <div className="text-sm font-bold text-white uppercase tracking-wider mb-1">Terminale</div>
                      <div className="text-blue-200 text-sm leading-relaxed">
                        Dernière ligne droite pour <strong className="text-white">Parcoursup</strong>, la <strong className="text-white">Mention TB</strong> et le <strong className="text-white">TeSciA</strong>.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <span className="text-xl">🏗️</span>
                    <div>
                      <div className="text-sm font-bold text-white uppercase tracking-wider mb-1">Première</div>
                      <div className="text-blue-200 text-sm leading-relaxed">
                        Préparez votre <strong className="text-white">Épreuve de Spécialité</strong> (Bac) et assurez votre passage.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <a href="#academies" className="btn-secondary-lg shadow-lg hover:shadow-xl transform hover:-translate-y-1">
                    Découvrir les académies
                  </a>
                  <a href="#reservation" className="btn-outline shadow-lg">
                    Réserver un bilan
                  </a>
                </div>

                <div className="mt-10 grid gap-4 sm:grid-cols-3 border-t border-white/20 pt-8">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">{stats.satisfaction}%</div>
                    <div className="text-xs text-blue-100 uppercase tracking-wide font-semibold mt-1">de satisfaction</div>
                  </div>
                  <div className="text-center border-l border-white/20">
                    <div className="text-3xl font-bold text-white">+{stats.progress}</div>
                    <div className="text-xs text-blue-100 uppercase tracking-wide font-semibold mt-1">points moyenne</div>
                  </div>
                  <div className="text-center border-l border-white/20">
                    <div className="text-3xl font-bold text-white">{stats.mentions}+</div>
                    <div className="text-xs text-blue-100 uppercase tracking-wide font-semibold mt-1">mentions TB</div>
                  </div>
                </div>
              </div>

              <div className="relative hidden lg:block">
                <div className="relative rounded-3xl border border-white/20 bg-white/10 p-8 backdrop-blur-md shadow-2xl">
                  <div className="absolute -top-6 -right-6 bg-white text-nexus-blue rounded-full p-4 shadow-xl">
                    <TrendingUp className="h-8 w-8" />
                  </div>
                  <div className="text-lg text-white italic font-medium">“8 jours qui ont changé mon orientation. J'ai eu mon premier 18/20 en Maths juste après le stage.”</div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-200 text-blue-800 flex items-center justify-center font-bold">S</div>
                    <div>
                      <div className="text-sm font-bold text-white">Sarah M.</div>
                      <div className="text-xs text-blue-100">Terminale • Lycée Français</div>
                    </div>
                  </div>
                  <div className="mt-4 font-semibold text-white">NSI</div>
                  <ul className="mt-2 space-y-2">
                    {MATERIALS.nsi.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>

                  <div className="mt-8 space-y-3">
                    {[
                      "Groupes de niveau (6-8 élèves)",
                      "Professeurs agrégés & jurys du Bac",
                      "Suivi personnalisé post-stage",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-3 text-sm text-white font-medium">
                        <div className="rounded-full bg-green-400/20 p-1">
                          <CheckCircle2 className="h-4 w-4 text-green-300" />
                        </div>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* URGENCE - TIMELINE & NEEDS */}
        <section id="programmes" className="py-32 relative bg-slate-950 overflow-hidden">
          {/* Background Effects */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-600/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none" />

          <div className="container mx-auto px-4 md:px-6 relative z-10">

            {/* Header */}
            <div className="text-center max-w-5xl mx-auto mb-20">
              <span className="text-cyan-200 font-bold tracking-[0.3em] text-[10px] uppercase mb-4 block animate-pulse">Calendrier Stratégique</span>
              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-12">
                Février : Le <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-orange-400">Tournant Décisif</span>
              </h2>

              <div className="grid md:grid-cols-2 gap-8 text-left">
                {/* TERMINALE */}
                <div className="bg-slate-900/50 rounded-3xl p-8 border border-white/10 relative overflow-hidden group hover:border-blue-500/30 transition-colors">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-[60px] rounded-full group-hover:bg-blue-500/30 transition-colors" />
                  <h3 className="text-2xl font-black text-white mb-4 flex items-center gap-3">
                    <span className="text-3xl">🎯</span>
                    <div>
                      OBJECTIF <br /><span className="text-blue-400">PARCOURSUP & MENTION</span>
                    </div>
                  </h3>
                  <p className="text-slate-300 font-medium mb-6 leading-relaxed">
                    Le dossier Parcoursup se joue sur vos notes actuelles. C'est le sprint final avant le verrouillage.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-sm text-slate-400">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">1</div>
                      <span className="items-center"><strong className="text-white">Dossier :</strong> Remonter la moyenne du T2 impérativement.</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-400">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">2</div>
                      <span className="items-center"><strong className="text-white">NSI :</strong> Sécuriser les 5 points de l'épreuve pratique (ECE).</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-400">
                      <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">3</div>
                      <span className="items-center"><strong className="text-white">Distinction :</strong> Le module TeSciA pour se démarquer.</span>
                    </li>
                  </ul>
                </div>

                {/* PREMIERE */}
                <div className="bg-slate-900/50 rounded-3xl p-8 border border-white/10 relative overflow-hidden group hover:border-purple-500/30 transition-colors">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/20 blur-[60px] rounded-full group-hover:bg-purple-500/30 transition-colors" />
                  <h3 className="text-2xl font-black text-white mb-4 flex items-center gap-3">
                    <span className="text-3xl">🏗️</span>
                    <div>
                      OBJECTIF <br /><span className="text-purple-400">SOCLE & ÉPREUVE BAC</span>
                    </div>
                  </h3>
                  <p className="text-slate-300 font-medium mb-6 leading-relaxed">
                    Ne laissez pas les lacunes de Première gâcher votre future Terminale. Anticipez dès maintenant.
                  </p>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-sm text-slate-400">
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">1</div>
                      <span className="items-center"><strong className="text-white">Maths Spécifiques :</strong> Préparation à l'épreuve finale écrite.</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-400">
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">2</div>
                      <span className="items-center"><strong className="text-white">Dossier Anticipé :</strong> Un bulletin béton pour Parcoursup 2027.</span>
                    </li>
                    <li className="flex items-start gap-3 text-sm text-slate-400">
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs">3</div>
                      <span className="items-center"><strong className="text-white">Socle :</strong> Maîtriser la dérivation pour la Terminale.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* SECTION: PÉDAGOGIE DE PRÉCISION (New) */}
            <div className="mb-24">
              <div className="text-center mb-12">
                <span className="text-blue-400 font-bold tracking-[0.2em] text-xs uppercase mb-3 block">L'Obsession de la Qualité</span>
                <h3 className="text-3xl md:text-4xl font-black text-white">LA PÉDAGOGIE DE <span className="text-blue-500">PRÉCISION</span></h3>
                <p className="text-slate-400 mt-4 text-lg">Pourquoi nous limitons nos groupes à <strong className="text-white">6 élèves</strong> (et pas un de plus).</p>
              </div>

              <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
                {/* Colonne 1 */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-blue-500/50 transition duration-300">
                  <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-2xl mb-4 text-blue-400">👁️</div>
                  <h4 className="text-xl font-bold text-white mb-2">100% Focus</h4>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    En classe, un prof vous consacre 1 min/heure. Chez Nexus, c'est 15 min/heure. Nous voyons tout, nous corrigeons tout en direct.
                  </p>
                </div>

                {/* Colonne 2 */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-purple-500/50 transition duration-300">
                  <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-2xl mb-4 text-purple-400">⚙️</div>
                  <h4 className="text-xl font-bold text-white mb-2">Différenciation Totale</h4>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    L'un avance vite ? On le challenge (Concours). L'autre bloque ? On le débloque (Soutien). Le cours s'adapte à vous, pas l'inverse.
                  </p>
                </div>

                {/* Colonne 3 */}
                <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-orange-500/50 transition duration-300">
                  <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center text-2xl mb-4 text-orange-400">🚀</div>
                  <h4 className="text-xl font-bold text-white mb-2">L'Effet Escouade</h4>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Ni la solitude du cours particulier, ni l'anonymat de la classe. L'énergie d'un groupe d'élite qui vise la même Mention.
                  </p>
                </div>
              </div>
            </div>

            {/* TIMELINE */}
            <div className="relative max-w-5xl mx-auto mb-32">
              {/* Connecting Line */}
              <div className="absolute top-1/2 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent -translate-y-1/2 hidden md:block" />

              <div className="grid md:grid-cols-3 gap-8 md:gap-12 relative">
                {[
                  {
                    date: "16-26 Fév.",
                    title: "Dernier Sprint",
                    text: "Vos dernières notes fixent la moyenne du T2.",
                    icon: "⚡",
                    color: "from-blue-500 to-cyan-400",
                    glow: "shadow-blue-500/50"
                  },
                  {
                    date: "Fin Février",
                    title: "Conseils de Classe",
                    text: "Les moyennes se figent, les appréciations s'écrivent.",
                    icon: "🔒",
                    color: "from-purple-500 to-pink-500",
                    glow: "shadow-purple-500/50"
                  },
                  {
                    date: "Mars-Avril",
                    title: "Parcoursup",
                    text: "Examen des dossiers et concours (TESCIA).",
                    icon: "🚀",
                    color: "from-orange-500 to-red-500",
                    glow: "shadow-orange-500/50"
                  },
                ].map((item, i) => (
                  <div key={i} className="group relative">
                    {/* Floating Card */}
                    <div className="relative bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 hover:-translate-y-4 transition-all duration-500 hover:border-white/20 hover:bg-slate-800/80">
                      {/* Top Glow Node */}
                      <div className={`absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center font-bold text-xl shadow-lg ${item.glow} z-20`}>
                        {item.icon}
                      </div>

                      <div className={`text-center mt-6`}>
                        <div className={`inline-block px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-widest mb-4 bg-clip-text text-transparent bg-gradient-to-r ${item.color}`}>
                          {item.date}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                        <p className="text-sm text-slate-400 leading-relaxed font-medium">{item.text}</p>
                      </div>
                    </div>
                    {/* Reflection */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-5 blur-2xl transition-opacity duration-500 rounded-3xl -z-10`} />
                  </div>
                ))}
              </div>
            </div>

            {/* NEEDS / ACTION CARDS */}
            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {[
                {
                  icon: "📉",
                  title: "Besoin de remonter ?",
                  subtitle: "Moyenne < 12",
                  text: "Visez le 14+ pour sécuriser le dossier.",
                  solution: "Stage Rattrapage",
                  gradient: "from-slate-800 to-slate-900",
                  border: "border-slate-700",
                  check: "text-slate-400"
                },
                {
                  icon: "🎯",
                  title: "Viser l'Excellence",
                  subtitle: "Objectif Prépa",
                  text: "Passer de 15 à 18 pour viser Louis-le-Grand.",
                  solution: "Maths Expertes",
                  gradient: "from-slate-900 to-blue-950",
                  border: "border-blue-500/30",
                  check: "text-blue-400"
                },
                {
                  icon: "🚨",
                  title: "Urgence NSI",
                  subtitle: "Épreuve Pratique",
                  text: "Ne perdez pas de points bêtement au Bac.",
                  solution: "Bootcamp ECE",
                  gradient: "from-red-950/30 to-slate-900",
                  border: "border-red-500/30",
                  check: "text-red-400"
                },
              ].map((item, idx) => (
                <div key={idx} className={`relative group p-[1px] rounded-[2rem] bg-gradient-to-b from-white/10 to-transparent hover:from-white/20 transition-all duration-300`}>
                  <div className={`h-full bg-gradient-to-br ${item.gradient} rounded-[2rem] p-8 relative overflow-hidden backdrop-blur-md`}>
                    <div className="absolute top-0 right-0 p-32 bg-white/5 blur-[80px] rounded-full pointer-events-none group-hover:bg-white/10 transition-colors" />

                    <div className="relative z-10 flex flex-col h-full items-start">
                      <div className="text-4xl mb-6 bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner">{item.icon}</div>

                      <div className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">{item.subtitle}</div>
                      <h4 className="text-2xl font-black text-white mb-4">{item.title}</h4>
                      <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8 border-l-2 border-white/10 pl-4">{item.text}</p>

                      <div className="mt-auto w-full">
                        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-white mb-2">
                          <span>Recommandation</span>
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </div>
                        <div className={`w-full py-4 text-center rounded-xl font-bold bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer transition-colors text-white`}>
                          {item.solution}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* ACADEMIES */}
        <section id="academies" className="py-24 bg-white">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 text-center">
              Nos Académies d'Excellence
            </h2>
            <p className="text-center text-slate-500 mt-2">Choisissez le programme adapté à votre ambition</p>

            <div className="mt-10 flex flex-col gap-6 items-center">
              <div className="flex gap-2 p-1 bg-slate-100 rounded-full">
                {["terminale", "premiere", "both"].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLevel(lvl)}
                    className={`rounded-full px-6 py-2 text-sm font-medium transition-all ${level === lvl
                      ? "bg-white text-nexus-blue shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                      }`}
                  >
                    {lvl === "terminale" ? "Terminale" : lvl === "premiere" ? "Première" : "Tout voir"}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                {[
                  { key: "all", label: "Toutes les matières" },
                  { key: "maths", label: "Mathématiques" },
                  { key: "nsi", label: "NSI & Info" },
                  { key: "budget", label: "Offres Essentielles" },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setFilter(item.key)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold border transition ${filter === item.key
                      ? "border-nexus-blue bg-blue-50 text-nexus-blue"
                      : "border-slate-200 text-slate-600 hover:border-nexus-blue"
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
              {filteredAcademies.map((academy) => (
                <div
                  key={academy.id}
                  id={academy.id}
                  className={`group relative flex flex-col overflow-hidden rounded-[2.5rem] transition-all duration-500 hover:-translate-y-3 ${highlightedId === academy.id ? "ring-4 ring-offset-4 ring-nexus-blue" : ""
                    } ${academy.tone === 'premium'
                      ? 'bg-slate-900 text-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border border-white/10'
                      : 'bg-white text-slate-900 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-slate-100 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)]'
                    }`}
                >
                  {/* Premium Ambient Glow */}
                  {academy.tone === 'premium' && (
                    <>
                      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-nexus-red/20 blur-[100px] rounded-full group-hover:bg-nexus-red/30 transition-colors duration-500" />
                      <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-blue-600/20 blur-[100px] rounded-full group-hover:bg-blue-600/30 transition-colors duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    </>
                  )}

                  <div className="relative p-10 flex flex-col h-full z-10">
                    <div className="flex flex-col items-start gap-4 mb-8">
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full border ${academy.tone === "premium"
                          ? "bg-white/10 border-white/10 text-white backdrop-blur-md shadow-inner"
                          : "bg-blue-50 border-blue-100 text-nexus-blue"
                          }`}>
                          {academy.badge}
                        </span>
                        {academy.seats <= 5 && (
                          <span className={`flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full ${academy.tone === 'premium' ? 'text-red-300 bg-red-500/10' : 'text-red-500 bg-red-50'}`}>
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                            {academy.seats} places
                          </span>
                        )}
                      </div>

                      {/* ESCOUADE BADGE */}
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border backdrop-blur-md ${academy.tone === 'premium'
                        ? 'bg-amber-400/10 border-amber-400/30 text-amber-300'
                        : 'bg-blue-900/10 border-blue-900/20 text-blue-800'}`}>
                        <span className="text-sm">🔒</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest">Escouade : 6 Éleves Max</span>
                      </div>
                    </div>

                    <h3 className={`text-3xl font-black tracking-tight mb-2 ${academy.tone === 'premium' ? 'text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400' : 'text-slate-900'}`}>
                      {academy.title}
                    </h3>
                    <div className={`text-sm font-bold uppercase tracking-widest mb-8 flex items-center gap-2 ${academy.tone === 'premium' ? 'text-blue-400' : 'text-slate-400'}`}>
                      <div className={`h-px w-8 ${academy.tone === 'premium' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                      {academy.tier}
                    </div>

                    <div className={`mb-8 p-6 rounded-3xl border backdrop-blur-sm transition-transform group-hover:scale-105 duration-300 ${academy.tone === 'premium'
                      ? 'bg-white/5 border-white/10'
                      : 'bg-slate-50 border-slate-100'
                      }`}>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-5xl font-black tracking-tighter ${academy.tone === 'premium' ? 'text-white' : 'text-slate-900'}`}>
                          {academy.early}
                        </span>
                        <span className={`text-xl font-bold ${academy.tone === 'premium' ? 'text-slate-200' : 'text-slate-600'}`}>TND</span>
                      </div>
                      <div className={`text-xs font-medium mt-2 flex items-center gap-2 ${academy.tone === 'premium' ? 'text-slate-200' : 'text-slate-500'}`}>
                        <span className="line-through decoration-red-500 decoration-2">Prix standard : {academy.price} TND</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500 text-white">ÉCONOMISEZ 15%</span>
                      </div>
                    </div>

                    <p className={`text-sm leading-relaxed mb-10 min-h-[48px] font-medium ${academy.tone === 'premium' ? 'text-slate-100' : 'text-slate-600'}`}>
                      {academy.description}
                    </p>

                    <ul className="space-y-4 mb-10">
                      {academy.features.slice(0, 4).map((feature) => (
                        <li key={feature} className="flex items-start gap-4 text-sm font-medium">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${academy.tone === 'premium'
                            ? 'bg-gradient-to-br from-nexus-red to-orange-500 shadow-lg shadow-red-900/50'
                            : 'bg-blue-100 text-nexus-blue'
                            }`}>
                            <CheckCircle2 className={`w-3.5 h-3.5 ${academy.tone === 'premium' ? 'text-white' : 'text-nexus-blue'}`} />
                          </div>
                          <span className={academy.tone === 'premium' ? 'text-slate-200' : 'text-slate-700'}>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-6 flex flex-col gap-4">
                      <button
                        onClick={() => {
                          setSelectedAcademy(academy);
                          document.getElementById("reservation")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className={`group/btn relative w-full overflow-hidden rounded-2xl py-5 text-sm font-bold text-white shadow-xl transition-all transform active:scale-[0.98] ${academy.tone === 'premium'
                          ? "bg-white text-slate-900 hover:text-white"
                          : "bg-slate-900 hover:bg-black"
                          }`}
                      >
                        {academy.tone === 'premium' && (
                          <div className="absolute inset-0 w-full h-full bg-nexus-red translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" />
                        )}
                        <span className="relative flex items-center justify-center gap-2">
                          {academy.cta} <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                        </span>
                      </button>
                      <p className="text-center text-[10px] text-slate-400 italic">
                        Pédagogie différenciée garantie par nos professeurs agrégés.
                      </p>

                      <button
                        onClick={() => document.getElementById("programmes")?.scrollIntoView({ behavior: "smooth" })}
                        className={`text-xs font-bold uppercase tracking-widest transition-colors text-center py-2 ${academy.tone === 'premium' ? 'text-slate-300 hover:text-white' : 'text-slate-400 hover:text-nexus-blue'
                          }`}
                      >
                        Voir le programme
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COMPARATOR TOOL - FLOATING DASHBOARD */}
        <section className="py-32 relative overflow-hidden bg-slate-900">
          {/* Background Grid */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-blue-900/10 to-slate-900 pointer-events-none" />

          <div className="container relative mx-auto px-4 text-center z-10">
            <span className="text-cyan-200 font-bold tracking-[0.3em] text-[10px] uppercase mb-4 block animate-pulse">Intelligence Artificielle</span>
            <h3 className="text-4xl md:text-6xl font-black text-white mb-16 tracking-tight">Trouvez votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Trajectoire</span></h3>

            <div className="max-w-5xl mx-auto rounded-[2rem] p-1 bg-gradient-to-b from-white/10 to-white/0 shadow-2xl backdrop-blur-2xl">
              <div className="rounded-[1.9rem] bg-slate-900/80 p-8 md:p-12 border border-white/5 relative overflow-hidden">
                {/* Dashboard Lighting */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-32 bg-blue-500/20 blur-[80px]" />

                <div className="relative grid gap-12 md:grid-cols-4 text-left items-center">
                  {/* INPUTS ROW */}
                  <div className="md:col-span-3 grid md:grid-cols-3 gap-8 border-r border-white/10 pr-8">
                    {/* Budget */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Votre Budget</label>
                      <div className="flex gap-2 bg-black/40 p-1.5 rounded-xl border border-white/5">
                        {[{ key: "500", label: "Essentiel" }, { key: "950", label: "Premium" }].map((b) => (
                          <button
                            key={b.key}
                            onClick={() => setHelper(prev => ({ ...prev, budget: b.key }))}
                            className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${helper.budget === b.key
                              ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                              : 'text-slate-500 hover:text-white hover:bg-white/5'
                              }`}
                          >
                            {b.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Matière */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Spécialité</label>
                      <div className="flex gap-2 bg-black/40 p-1.5 rounded-xl border border-white/5">
                        {[{ key: "maths", label: "Maths" }, { key: "nsi", label: "NSI" }].map((s) => (
                          <button
                            key={s.key}
                            onClick={() => setHelper(prev => ({ ...prev, subject: s.key }))}
                            className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all ${helper.subject === s.key
                              ? 'bg-nexus-red text-white shadow-lg shadow-red-500/25'
                              : 'text-slate-500 hover:text-white hover:bg-white/5'
                              }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Moyenne */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4">
                        Moyenne : <span className="text-white text-base ml-2">{simAvg}/20</span>
                      </label>
                      <input
                        type="range"
                        min="5" max="18"
                        value={simAvg}
                        onChange={(e) => setSimAvg(Number(e.target.value))}
                        className="w-full accent-blue-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer border border-white/5"
                      />
                    </div>
                  </div>

                  {/* RESULT CARD */}
                  <div className="relative group cursor-pointer" onClick={() => focusAcademyCard(recommendation.id)}>
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl group-hover:bg-blue-500/30 transition-colors rounded-full" />
                    <div className="relative text-center">
                      <div className="text-[10px] uppercase tracking-widest text-blue-300 mb-2">Recommandation</div>
                      <div className="text-2xl font-black text-white leading-none mb-1">{recommendation.title.split(" ")[0]}</div>
                      <div className="text-sm font-bold text-slate-400 mb-4">{recommendation.tier === "premium" ? "Excellence" : "Essentiel"}</div>
                      <button className="text-xs font-bold text-slate-900 bg-white px-6 py-3 rounded-full hover:scale-105 transition-transform">
                        Voir l'offre
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARISON */}
        <section className="py-24 bg-white relative">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 text-center mb-20 tracking-tight">
              Nexus vs <span className="text-slate-500 decoration-4 underline decoration-slate-400 decoration-wavy">Le Passé</span>
            </h2>
            <div className="grid gap-10 md:grid-cols-3 max-w-7xl mx-auto items-center">
              {/* Classique */}
              <div className="rounded-[2.5rem] p-10 border border-slate-100 bg-slate-50/50 grayscale hover:grayscale-0 hover:opacity-100 transition duration-700">
                <h3 className="text-2xl font-bold text-slate-500">Cours Particulier</h3>
                <div className="mt-4 text-4xl font-extrabold text-slate-700 tracking-tighter">1200<span className="text-lg ml-1">TND</span></div>
                <div className="mt-2 text-xs font-bold text-slate-600 uppercase tracking-widest">Le classique inefficace</div>
                <ul className="mt-8 space-y-4 text-sm font-medium text-slate-700">
                  <li className="flex gap-4 items-center"><span className="w-1.5 h-1.5 bg-red-300 rounded-full" />1h par semaine (trop lent)</li>
                  <li className="flex gap-4 items-center"><span className="w-1.5 h-1.5 bg-red-300 rounded-full" />Pas d'émulation</li>
                  <li className="flex gap-4 items-center"><span className="w-1.5 h-1.5 bg-red-300 rounded-full" />Enseignant étudiant</li>
                </ul>
              </div>

              {/* Nexus Essentiel */}
              <div className="relative rounded-[3rem] p-10 border-2 border-slate-100 bg-white shadow-2xl z-10">
                <h3 className="text-2xl font-bold text-slate-900">Stage Essentiel</h3>
                <div className="mt-4 text-5xl font-black text-slate-900 tracking-tighter">590<span className="text-lg ml-1 text-slate-500">TND</span></div>
                <div className="mt-2 text-xs font-bold text-nexus-blue uppercase tracking-widest">L'efficacité pure</div>
                <div className="mt-8 space-y-4 text-sm font-bold text-slate-700">
                  <li className="flex gap-4 items-center"><CheckCircle2 className="w-5 h-5 text-nexus-blue" /> 24h intensives</li>
                  <li className="flex gap-4 items-center"><CheckCircle2 className="w-5 h-5 text-nexus-blue" /> Profs de Lycée</li>
                  <li className="flex gap-4 items-center"><CheckCircle2 className="w-5 h-5 text-nexus-blue" /> Objectif +4 points</li>
                </div>
              </div>

              {/* Nexus Premium */}
              <div className="relative rounded-[3rem] p-10 bg-slate-900 text-white shadow-2xl scale-110 border border-white/10 overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-nexus-red/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="absolute top-0 right-0 bg-red-700 text-white text-[10px] font-black uppercase px-6 py-2 rounded-bl-2xl">Recommandé</div>

                <h3 className="text-2xl font-bold text-white relative z-10">Stage Premium</h3>
                <div className="mt-4 text-5xl font-black text-white tracking-tighter relative z-10">990<span className="text-lg ml-1 text-slate-100">TND</span></div>
                <div className="mt-2 text-xs font-bold text-red-400 uppercase tracking-widest relative z-10">L'Excellence absolue</div>

                <ul className="mt-10 space-y-5 text-sm font-bold text-slate-200 relative z-10">
                  <li className="flex gap-4 items-center"><Star className="w-5 h-5 text-nexus-red fill-current" /> Pour la Mention Très Bien</li>
                  <li className="flex gap-4 items-center"><Star className="w-5 h-5 text-nexus-red fill-current" /> Prépa Concours / Post-Bac</li>
                  <li className="flex gap-4 items-center"><Star className="w-5 h-5 text-nexus-red fill-current" /> Professeurs Agrégés</li>
                  <li className="flex gap-4 items-center"><Star className="w-5 h-5 text-nexus-red fill-current" /> Groupe Élite (6 max)</li>
                </ul>

                <button className="mt-10 w-full bg-white text-slate-900 font-bold py-4 rounded-xl hover:bg-slate-200 transition-colors">
                  S'inscrire en Premium
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* DETAILS PEDAGOGIQUES - CURRICULUM MAP */}
        <section id="curriculum" className="py-32 bg-slate-50 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <h2 className="text-3xl md:text-5xl font-black text-slate-900 text-center mb-4 tracking-tight">Le Programme Détaillé</h2>
            <p className="text-center text-slate-500 font-medium mb-16 max-w-2xl mx-auto">Chaque heure est optimisée. 0 temps mort, 100% de progression.</p>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {PROGRAMS.map((prog, idx) => (
                <div key={prog.title} className="group relative bg-white p-8 rounded-[2.5rem] shadow-sm hover:shadow-2xl transition-all duration-500 border border-slate-100 overflow-hidden hover:-translate-y-2">
                  {/* Decorative */}
                  <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-blue-500/5 transition-colors duration-500" />

                  <div className="relative z-10 flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 mb-8">
                      <h3 className="text-2xl font-black text-slate-900 leading-tight min-h-[64px] flex items-center">{prog.title}</h3>
                      <div className="h-12 w-12 flex-shrink-0 flex items-center justify-center rounded-2xl bg-slate-50 border border-slate-100 group-hover:bg-slate-900 group-hover:text-white transition-colors duration-500 shadow-sm">
                        <span className="font-bold text-lg">{idx + 1}</span>
                      </div>
                    </div>

                    {/* Timeline Content */}
                    <div className="space-y-8 relative pl-6 border-l-2 border-slate-100 ml-3 mb-8">
                      {prog.blocks.map((block, i) => {
                        const parts = block.includes(":") ? block.split(":") : [block, ""];
                        const weekTitle = block.includes(":") ? parts[0].trim() : `Module ${i + 1}`;
                        const weekContent = block.includes(":") ? parts.slice(1).join(":").trim() : block;

                        return (
                          <div key={i} className="relative">
                            {/* Dot */}
                            <div className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-[3px] border-white ${i === 0 ? 'bg-nexus-blue' : 'bg-slate-300 group-hover:bg-nexus-blue transition-colors duration-500 delay-100'} shadow-sm`} />

                            <div className={`text-xs font-extrabold uppercase tracking-widest mb-2 ${i === 0 ? 'text-nexus-blue' : 'text-slate-400 group-hover:text-nexus-blue transition-colors delay-100'}`}>
                              {weekTitle}
                            </div>
                            <div className="text-sm font-medium text-slate-600 leading-relaxed">
                              {weekContent.split("•").map((chunk, k) => (
                                <span key={k} className="block mb-1 last:mb-0">
                                  {chunk.trim()}
                                </span>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Footer */}
                    <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Volume total</span>
                        <span className="text-xs text-slate-500 font-medium">{prog.total.includes("(") ? prog.total.split("(")[1].replace(")", "") : ""}</span>
                      </div>
                      <span className="text-lg font-black text-slate-900 bg-slate-100 px-4 py-2 rounded-xl group-hover:bg-nexus-blue group-hover:text-white transition-colors duration-300 shadow-sm">
                        {prog.total.split("(")[0].trim()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PLANNING */}
        <section id="planning" className="py-24 bg-slate-900 border-y border-white/10 relative overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10" />
          <div className="container mx-auto px-4 md:px-6 relative z-10">
            <h2 className="text-3xl md:text-5xl font-black text-white text-center mb-16 tracking-tight">
              Une Journée <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Commando</span>
            </h2>
            <div className="grid gap-6 md:grid-cols-4 max-w-7xl mx-auto">
              {PLANNING.map((period, i) => (
                <div key={i} className="group relative bg-white/5 border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-colors hover:-translate-y-1 duration-300">
                  <div className="absolute top-0 right-0 p-4 opacity-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{period.day.split('(')[1].replace(')', '')}</div>
                  <div className="text-xl font-bold text-blue-300 mb-6 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    {period.day.split('(')[0].trim()}
                  </div>
                  <ul className="space-y-4">
                    {period.slots.map((slot, k) => (
                      <li key={k} className="flex items-start gap-3 text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
                        <div className="w-1.5 h-1.5 bg-nexus-red rounded-full mt-1.5 flex-shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                        {slot}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <p className="text-slate-400 text-sm font-medium max-w-2xl mx-auto">
                * Le rythme est intensif. Les pauses sont dédiées au networking et à l'échange avec les intervenants.
              </p>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="py-24 bg-white overflow-hidden">
          <div className="container mx-auto px-4 md:px-6">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center justify-center gap-1 p-3 bg-blue-50/50 rounded-full mb-8">
                {[1, 2, 3, 4, 5].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-nexus-blue fill-current" />
                ))}
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-12 tracking-tight">
                Validé par les <span className="text-nexus-blue">Meilleurs</span>
              </h2>
              {TESTIMONIALS.map((t, i) => (
                <div key={i} className="relative bg-slate-50 p-10 md:p-14 rounded-[3rem] border border-slate-100 shadow-xl mx-auto transform hover:scale-[1.02] transition-transform duration-500">
                  <div className="text-xl md:text-3xl font-serif italic text-slate-700 leading-relaxed mb-10">
                    « {t.quote} »
                  </div>
                  <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center font-bold text-slate-600 text-xl shadow-inner">
                        {t.author[0]}
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-slate-900 text-lg">{t.author}</div>
                        <div className="text-sm font-semibold text-nexus-blue uppercase tracking-wide">{t.role}</div>
                      </div>
                    </div>
                    <div className="hidden md:block w-px h-10 bg-slate-200" />
                    <div className="flex flex-wrap justify-center gap-2">
                      {t.stats.map((stat, s) => (
                        <span key={s} className="px-4 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-widest shadow-sm">
                          {stat}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* RESERVATION FORM */}
        <section id="reservation" className="py-24 bg-white relative">
          <div id="inscription" className="absolute -top-24" />
          <div className="container mx-auto px-4 md:px-6 max-w-6xl relative z-10">
            <div className="rounded-[2.5rem] bg-slate-900 overflow-hidden shadow-2xl relative">
              <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-black" />
              <div className="absolute top-0 right-0 p-32 bg-blue-500/10 blur-[100px] rounded-full" />

              <div className="relative grid lg:grid-cols-2">
                <div className="p-10 md:p-14 text-white flex flex-col justify-center">
                  <div className="inline-block self-start px-4 py-2 rounded-full bg-gradient-to-r from-red-600 to-orange-600 text-white text-[10px] font-extrabold uppercase tracking-widest mb-8 shadow-lg shadow-red-900/50 border border-red-500/50">
                    Dernières Places
                  </div>
                  <h2 className="text-4xl md:text-5xl font-extrabold mb-6 leading-tight">Réservation <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">Février 2026</span></h2>
                  <p className="text-blue-200/80 mb-12 text-lg font-medium leading-relaxed max-w-md">
                    L'excellence se prépare maintenant. Rejoignez l'élite des lycéens pour une semaine intensive.
                  </p>

                  <div className="flex gap-8 mb-12 p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <div>
                      <div className="text-4xl font-bold text-white tabular-nums tracking-tight">{countdown.days}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mt-1">Jours</div>
                    </div>
                    <div className="w-px bg-white/10" />
                    <div>
                      <div className="text-4xl font-bold text-white tabular-nums tracking-tight">{countdown.hours}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mt-1">Heures</div>
                    </div>
                    <div className="w-px bg-white/10" />
                    <div>
                      <div className="text-4xl font-bold text-white tabular-nums tracking-tight">{countdown.minutes}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mt-1">Min</div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center gap-4 text-sm font-semibold text-blue-100">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30"><ShieldCheck className="w-5 h-5 text-blue-300" /></div>
                      Garantie Satisfait ou Remboursé
                    </div>
                    <div className="flex items-center gap-4 text-sm font-semibold text-blue-100">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30"><CheckCircle2 className="w-5 h-5 text-blue-300" /></div>
                      Paiement sécurisé sur place ou en ligne
                    </div>
                  </div>
                </div>

                <div className="bg-white p-10 md:p-14 relative">
                  {isSuccess ? (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-green-100 border border-green-100">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      <h3 className="text-3xl font-bold text-slate-900 mb-2">Demande Reçue !</h3>
                      <p className="text-slate-500 text-lg leading-relaxed max-w-xs mx-auto">Un conseiller pédagogique va vous contacter sous 24h.</p>
                      <button onClick={() => setIsSuccess(false)} className="mt-8 text-sm font-bold text-nexus-blue hover:text-blue-700 transition-colors">Nouvelle demande</button>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="mb-8">
                        <h3 className="text-2xl font-bold text-slate-900">Formulaire d'inscription</h3>
                        <p className="text-sm font-medium text-slate-600 mt-1">Pré-inscription sans engagement</p>
                      </div>

                      <form onSubmit={handleSubmit} className="space-y-5 flex-grow">
                        <div>
                          <label className="block text-xs font-bold !text-slate-700 uppercase tracking-wider mb-2">Académie sélectionnée</label>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-nexus-blue font-bold flex justify-between items-center shadow-sm">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-nexus-blue animate-pulse" />
                              {selectedAcademy.title}
                            </span>
                            <span className="text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm text-sm">{selectedAcademy.early} TND</span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <input
                            required
                            placeholder="Nom du Parent"
                            value={formData.parent}
                            onChange={e => setFormData({ ...formData, parent: e.target.value })}
                            className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-nexus-blue focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-slate-900 placeholder:text-slate-500"
                          />
                          <input
                            required
                            placeholder="Numéro de Téléphone"
                            value={formData.phone}
                            onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-nexus-blue focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-slate-900 placeholder:text-slate-500"
                          />
                          <input
                            required
                            placeholder="Classe (ex: 1ère - Lycée PMF)"
                            value={formData.classe}
                            onChange={e => setFormData({ ...formData, classe: e.target.value })}
                            className="w-full px-5 py-4 rounded-xl bg-slate-50 border-2 border-transparent focus:bg-white focus:border-nexus-blue focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-slate-900 placeholder:text-slate-500"
                          />
                        </div>

                        {errorMsg && <div className="text-red-500 text-sm font-medium">{errorMsg}</div>}

                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="w-full mt-6 bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-black transition-all shadow-lg hover:shadow-xl disabled:opacity-70"
                        >
                          {isSubmitting ? "Envoi en cours..." : "Valider ma demande"}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="container mx-auto px-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 md:p-10 text-center">
              <p className="marketing-eyebrow">
                Prochaine étape
              </p>
              <h2 className="marketing-cta-title">
                Réservez votre place en 2 minutes
              </h2>
              <p className="marketing-cta-copy max-w-2xl mx-auto">
                Un conseiller vous rappelle pour valider l'académie et personnaliser le programme.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
                <a href="#inscription" className="btn-primary">
                  Démarrer ma demande
                </a>
                <Link href="/bilan-gratuit" className="btn-outline">
                  Commencer par un bilan
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <CorporateFooter />
    </div>
  );
}
