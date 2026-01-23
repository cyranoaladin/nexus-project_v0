"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Award,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const ACADEMIES = [
  {
    id: "maths-bac-garanti",
    title: "Maths Bac Garanti",
    badge: "🎯 OBJECTIF BAC",
    price: 590,
    early: 502,
    tier: "essentielle",
    audience: "Terminale EDS Maths",
    duration: "24h (20h Maths + 4h Python)",
    group: "8 élèves max",
    expert: "Agrégé Maths",
    category: ["terminale", "maths", "essentielle", "budget"],
    description: "Sécuriser 14+ au Bac avec un rattrapage intensif.",
    features: [
      "Suites, dérivabilité, géométrie espace",
      "Intégrales, équations diff, probas",
      "Python NumPy pour vérifications",
      "Bac Blanc final",
    ],
    seats: 5,
    tone: "essential",
    cta: "Sécuriser son Bac",
  },
  {
    id: "maths-mention-max",
    title: "Maths Mention Max",
    badge: "👑 MENTION TB",
    price: 990,
    early: 842,
    tier: "premium",
    audience: "Terminale Maths Expertes + Prépas",
    duration: "32h",
    group: "6 élèves max",
    expert: "Agrégé Maths",
    category: ["terminale", "maths", "premium"],
    description: "Arithmétique, complexes, suites avancées + TESCIA + Grand Oral.",
    features: [
      "Arithmétique, nombres complexes",
      "Suites avancées",
      "Préparation TESCIA (logique & raisonnement)",
      "Grand Oral mathématique",
    ],
    seats: 3,
    tone: "premium",
    cta: "Viser l'excellence",
  },
  {
    id: "nsi-pratique-ecrit",
    title: "NSI Pratique & Écrit",
    badge: "💻 ÉPREUVE NSI",
    price: 590,
    early: 502,
    tier: "essentielle",
    audience: "Terminale EDS NSI",
    duration: "24h (16h théorie + 8h pratique)",
    group: "8 élèves max",
    expert: "DIU NSI",
    category: ["terminale", "nsi", "essentielle", "budget"],
    description: "Maîtriser l'épreuve pratique (ECE) et l'écrit.",
    features: [
      "POO avancée",
      "SQL & bases de données",
      "Graphes, récursivité",
      "Banque de sujets ECE guidée",
    ],
    seats: 4,
    tone: "essential",
    cta: "Sécuriser l'épreuve",
  },
  {
    id: "nsi-excellence",
    title: "NSI Excellence",
    badge: "🚀 INGÉNIEUR",
    price: 990,
    early: 842,
    tier: "premium",
    audience: "Terminale NSI (objectif Ingénieur/MPI)",
    duration: "32h",
    group: "6 élèves max",
    expert: "DIU NSI",
    category: ["terminale", "nsi", "premium"],
    description: "Architecture, réseaux, algorithmique distribuée, optimisation.",
    features: [
      "Architecture système",
      "Réseaux (routage/TCP)",
      "Algorithmique distribuée",
      "Projet full stack guidé",
    ],
    seats: 3,
    tone: "premium",
    cta: "Viser l'excellence",
  },
  {
    id: "maths-fondations",
    title: "Maths Fondations",
    badge: "📈 BASE SOLIDE",
    price: 490,
    early: 417,
    tier: "essentielle",
    audience: "Première EDS Maths",
    duration: "20h",
    group: "8 élèves max",
    expert: "Agrégé Maths",
    category: ["premiere", "maths", "essentielle", "budget"],
    description: "Dérivation, suites, probas + Python (SymPy).",
    features: [
      "Dérivation & applications",
      "Suites numériques",
      "Probabilités conditionnelles",
      "Python SymPy",
    ],
    seats: 6,
    tone: "essential",
    cta: "Sécuriser les bases",
  },
  {
    id: "nsi-decouverte",
    title: "NSI Découverte",
    badge: "🚀 PRISE D'AVANCE",
    price: 490,
    early: 417,
    tier: "essentielle",
    audience: "Première EDS NSI",
    duration: "18h",
    group: "8 élèves max",
    expert: "DIU NSI",
    category: ["premiere", "nsi", "essentielle", "budget"],
    description: "Python fondamental, algorithmique, représentation des données.",
    features: [
      "Python bases à avancé",
      "Tri / recherche",
      "Données & circuits logiques",
      "Mini-projet guidé",
    ],
    seats: 6,
    tone: "essential",
    cta: "Prendre de l'avance",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Grâce au stage Nexus, Karim est passé de 9 à 15 en maths. La préparation TESCIA lui a ouvert les portes de la prépa qu'il visait.",
    author: "Mme Ben Ammar",
    role: "Mère de Karim, Terminale",
    stats: ["+6 points", "Admis en Prépa"],
  },
  {
    quote:
      "En une semaine, ma fille a repris confiance et structuré sa méthode. Son Bac blanc a décollé.",
    author: "M. Karray",
    role: "Parent, Première",
    stats: ["+4,1 points", "Mention visée"],
  },
  {
    quote:
      "L'entraînement sur la banque de sujets ECE m'a sauvé. J'ai eu le sujet exact du stage à l'examen !",
    author: "Yassine",
    role: "Élève Terminale NSI",
    stats: ["20/20 en Pratique", "Oral réussi"],
  },
];

const CONTENTS_BY_TRACK = [
  {
    title: "Terminale EDS Maths (Standard)",
    items: [
      "Suites (limites, récurrence)",
      "Continuité et dérivabilité (théorèmes)",
      "Géométrie dans l'espace (produit scalaire, équations)",
      "Primitives et intégrales",
      "Équations différentielles",
      "Probabilités (conditionnelles, lois continues)",
      "Python pour les maths (NumPy, visualisation)",
    ],
  },
  {
    title: "Terminale Maths Expertes",
    items: [
      "Tout le programme EDS Maths",
      "Arithmétique (divisibilité, congruences)",
      "Nombres complexes (forme, opérations)",
      "Préparation TESCIA intensive",
      "Algorithmique mathématique avancée",
    ],
  },
  {
    title: "Première EDS Maths",
    items: [
      "Dérivation (applications)",
      "Suites numériques",
      "Probabilités (conditionnelles)",
      "Variables aléatoires",
      "Python pour les maths (SymPy, résolution)",
      "Fonctions du second degré",
    ],
  },
  {
    title: "Première EDS NSI",
    items: [
      "Programmation Python (bases à avancé)",
      "Algorithmique (tri, recherche)",
      "Représentation données (binaire, hexa)",
      "Circuits logiques (portes, algèbre booléenne)",
      "Complexité algorithmique (O notation)",
      "Architecture machine",
    ],
  },
  {
    title: "Terminale EDS NSI",
    items: [
      "POO (classes, héritage, encapsulation)",
      "Bases de données SQL",
      "Graphes (parcours, plus court chemin)",
      "Arbres binaires (recherche, équilibrage)",
      "Récursivité",
      "Réseaux et routage (TCP/IP, DNS)",
      "Architecture système",
      "Algorithmique avancée",
    ],
  },
];

const PROGRAMS = [
  {
    title: "Maths Bac Garanti (Terminale EDS Maths)",
    blocks: [
      "Semaine 1 : J1-2 Suites + Python • J3-4 Dérivabilité + applications Python",
      "Semaine 2 : J5-6 Probabilités + simulations • J7-8 Géométrie espace + intégrales",
      "Bac Blanc final avec correction Python",
    ],
    total: "24h (20h maths + 4h Python)",
  },
  {
    title: "Maths Mention Max (Terminale Maths Expertes)",
    blocks: [
      "Semaine 1 : Arithmétique + Python • Nombres complexes • TESCIA logique",
      "Semaine 2 : Suites avancées • TESCIA raisonnement • Simulations • Grand Oral",
    ],
    total: "32h (24h maths expertes + 8h TESCIA)",
  },
  {
    title: "NSI Pratique & Écrit (Terminale EDS NSI)",
    blocks: [
      "Semaine 1 : POO avancée • Bases de données SQL + Python",
      "Semaine 2 : Graphes • Récursivité • Banque de sujets ECE",
    ],
    total: "24h (16h théorie + 8h pratique guidée)",
  },
  {
    title: "NSI Excellence (Terminale NSI Premium)",
    blocks: [
      "Semaine 1 : Architecture + réseaux • Algorithmique distribuée",
      "Semaine 2 : Projet complexe • Optimisation • Prépa écoles d'ingénieurs",
    ],
    total: "32h (24h NSI avancé + 8h ingénierie)",
  },
  {
    title: "Maths Fondations (Première EDS Maths)",
    blocks: [
      "Semaine 1 : Dérivation + Python • Suites + algos Python",
      "Semaine 2 : Probabilités + Monte Carlo • DS final",
    ],
    total: "20h (14h maths + 6h Python)",
  },
  {
    title: "NSI Découverte (Première EDS NSI)",
    blocks: [
      "Semaine 1 : Python fondamental • Algorithmique tri/recherche",
      "Semaine 2 : Représentation données • Mini-projet",
    ],
    total: "18h (12h programmation + 6h théorie)",
  },
];

const PLANNING = [
  {
    day: "Lundi 16 février",
    slots: [
      "08h30 : Maths Fondations (Dérivation)",
      "10h45 : Maths Bac Garanti (Suites)",
      "14h00 : NSI Découverte (Bases Python)",
      "16h15 : NSI Pratique & Écrit (POO)",
    ],
  },
  {
    day: "Mardi 17 février",
    slots: [
      "08h30 : Maths Mention Max (Arithmétique)",
      "10h45 : Maths Bac Garanti (Continuité)",
      "14h00 : NSI Excellence (Architecture Système)",
      "16h15 : NSI Pratique & Écrit (SQL)",
    ],
  },
  {
    day: "Mercredi 18 février",
    slots: [
      "08h30 : Maths Fondations (Suites)",
      "10h45 : Maths Bac Garanti (Probas)",
      "14h00 : NSI Découverte (Tris & Complexité)",
      "16h15 : NSI Excellence (Réseaux & Routage)",
    ],
  },
  {
    day: "Jeudi 19 février",
    slots: [
      "08h30 : Maths Mention Max (Complexes)",
      "10h45 : Prépa TESCIA (Logique)",
      "14h00 : NSI Excellence (Graphes)",
      "16h15 : NSI Pratique & Écrit (Récursivité)",
    ],
  },
  {
    day: "Samedi 21 février (événement spécial)",
    slots: [
      "10h : Atelier Python pour les Maths",
      "14h : Simulation TESCIA Collective",
      "16h : Démonstrations sujets NSI",
    ],
  },
  {
    day: "Lundi 23 février",
    slots: [
      "08h30 : Maths Fondations (Probabilités)",
      "10h45 : Maths Bac Garanti (Géométrie espace)",
      "14h00 : NSI Découverte (Représentation des données)",
      "16h15 : NSI Pratique & Écrit (Arbres binaires)",
      "18h30 : Maths Mention Max (TESCIA raisonnement)",
    ],
  },
  {
    day: "Mardi 24 février",
    slots: [
      "08h30 : Maths Mention Max (Suites avancées)",
      "10h45 : Maths Bac Garanti (Intégrales)",
      "14h00 : NSI Excellence (Algorithmique distribuée)",
      "16h15 : NSI Pratique & Écrit (Entraînement ECE)",
    ],
  },
  {
    day: "Mercredi 25 février",
    slots: [
      "08h30 : Maths Fondations (Révision complète)",
      "10h45 : Maths Bac Garanti (Équations différentielles)",
      "14h00 : NSI Découverte (Mini-projet guidé)",
      "16h15 : NSI Excellence (Optimisation code)",
      "18h30 : NSI Pratique & Écrit (Banque de sujets ECE)",
    ],
  },
  {
    day: "Jeudi 26 février (finale)",
    slots: [
      "09h00-12h00 : Examens finaux (Maths Bac Blanc + NSI épreuve pratique/oral)",
      "14h00-16h00 : Corrections et feedback personnalisé",
      "16h30-18h30 : Cérémonie & remise certificats",
      "19h00-21h00 : Cocktail parents-enseignants",
    ],
  },
];

const PYTHON_STACK = [
  "SymPy : calcul symbolique",
  "NumPy : calcul numérique",
  "Matplotlib : visualisation",
  "SciPy : méthodes numériques",
  "Jupyter Notebook : cahier d'exercices",
];

const NSI_STACK = [
  "Standard Library : bases",
  "SQLite3 : bases de données",
  "NetworkX : graphes",
  "PyTest : tests unitaires",
  "Flask : web (projets avancés)",
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
  const [reservationStep, setReservationStep] = useState(1);
  const [selectedAcademy, setSelectedAcademy] = useState(ACADEMIES[0]);
  const [countdown, setCountdown] = useState({ days: "05", hours: "12", minutes: "45" });
  const [stats, setStats] = useState({ satisfaction: 0, progress: 0, mentions: 0 });
  const [currentAvg, setCurrentAvg] = useState(12);
  const [simAvg, setSimAvg] = useState(12);
  const [formData, setFormData] = useState({ parent: "", phone: "", classe: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [recPulse, setRecPulse] = useState(false);

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
      if (subject === "nsi") return getAcademyById("nsi-decouverte");
      return getAcademyById("maths-fondations");
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

  function noteAcademy(tier: string, premium: boolean) {
    return ACADEMIES.find((a) => a.tier === (premium ? "premium" : "essentielle")) || ACADEMIES[0];
  }

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

  useEffect(() => {
    setRecPulse(true);
    const timer = window.setTimeout(() => setRecPulse(false), 600);
    return () => window.clearTimeout(timer);
  }, [recommendation]);

  const essentialTarget = Math.min(currentAvg + 4, 20);
  const premiumTarget = Math.min(currentAvg + 6, 20);

  const mentionLabel = (avg: number) => {
    if (avg >= 16) return "Très Bien";
    if (avg >= 14) return "Bien";
    if (avg >= 12) return "Assez Bien";
    return "Passable";
  };

  return (
    <div className="min-h-screen bg-deep-midnight text-slate-200">
      <Header />

      <style jsx global>{`
        html {
          scroll-padding-top: 100px;
        }
        header {
          background-color: #020617 !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        header nav a,
        header .font-bold span {
          color: #e2e8f0 !important;
        }
        header span.text-blue-600 {
          color: #ffffff !important;
        }
        header span.text-red-500 {
          color: #eab308 !important;
        }
        .mobile-menu-container {
          background-color: #020617 !important;
          border-top: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        .mobile-menu-container a {
          color: #e2e8f0 !important;
        }
        .mobile-menu-container a:hover {
          background-color: rgba(234, 179, 8, 0.1) !important;
          color: #eab308 !important;
        }
        header button[aria-label="Toggle menu"] {
          color: #e2e8f0 !important;
        }
        .academy-highlight {
          animation: academyPulse 1.2s ease-in-out 2;
          border-color: rgba(234, 179, 8, 0.6) !important;
          box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.25);
        }
        .rec-pulse {
          animation: recPulse 0.6s ease-in-out;
        }
        @keyframes academyPulse {
          0% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0.35); }
          50% { box-shadow: 0 0 0 8px rgba(234, 179, 8, 0); }
          100% { box-shadow: 0 0 0 0 rgba(234, 179, 8, 0); }
        }
        @keyframes recPulse {
          0% { transform: scale(1); color: #e2e8f0; }
          50% { transform: scale(1.02); color: #eab308; }
          100% { transform: scale(1); color: #e2e8f0; }
        }
        footer {
          background-color: #020617 !important;
        }
      `}</style>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden py-20">
          <div className="absolute inset-0 bg-gradient-to-b from-deep-midnight via-deep-midnight/70 to-deep-midnight" />
          <div className="absolute -top-20 right-10 h-72 w-72 rounded-full bg-gold-500/10 blur-[140px]" />
          <div className="container relative z-10 mx-auto px-4 md:px-6">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-gold-500/40 bg-gold-500/10 px-4 py-2 text-xs font-semibold text-gold-400">
                  ⚠️ STAGES FÉVRIER 2026 • Inscriptions ouvertes jusqu&apos;au 10/02
                </div>
                <h1 className="mt-6 text-4xl md:text-6xl font-bold text-white font-serif">
                  STAGES FÉVRIER — L&apos;ACCÉLÉRATEUR DE MENTION{" "}
                  <span className="text-gold-400">(MATHS &amp; NSI)</span>
                </h1>
                <p className="mt-4 text-lg text-slate-300">
                  Février, ce ne sont pas des vacances : c&apos;est un conseil de classe. Vos notes de cette période
                  déterminent votre mention au Bac et votre dossier Parcoursup. Nos stages sont le dernier levier.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row gap-4">
                  <a href="#academies" className="rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-black hover:bg-gold-400 transition">
                    Découvrir les académies
                  </a>
                  <a href="#reservation" className="rounded-full border border-gold-500 px-6 py-3 text-sm font-bold text-white hover:bg-gold-500/10 transition">
                    📅 Réserver une consultation gratuite
                  </a>
                </div>

                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <div className="text-2xl font-bold text-gold-400">{stats.satisfaction}%</div>
                    <div className="text-xs text-slate-300">de satisfaction</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <div className="text-2xl font-bold text-gold-400">{stats.progress}</div>
                    <div className="text-xs text-slate-300">pts de progression moyenne</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                    <div className="text-2xl font-bold text-gold-400">{stats.mentions}+</div>
                    <div className="text-xs text-slate-300">mentions TB obtenues</div>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -inset-6 rounded-full bg-gold-500/10 blur-3xl" />
                <div className="relative rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                  <div className="text-sm text-slate-300">“8 jours qui ont changé mon orientation”</div>
                  <div className="mt-2 text-xs text-gold-400">— Sarah, Terminale</div>
                  <div className="mt-6 grid gap-3">
                    {[
                      "6 à 8 élèves max par groupe",
                      "Experts agrégés et certifiés",
                      "Programme intensif + coaching",
                    ].map((item) => (
                      <div key={item} className="flex items-center gap-2 text-sm text-slate-200">
                        <CheckCircle2 className="h-4 w-4 text-gold-400" /> {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* URGENCE */}
        <section id="programmes" className="py-20 bg-black/20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              ⏰ Février : le mois qui décide de votre mention au Bac
            </h2>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {[
                {
                  date: "16-26 Février",
                  title: "Dernier sprint avant les conseils de classe",
                  text: "Vos notes de février fixent votre moyenne du 2ème trimestre. Cette moyenne détermine votre mention potentielle et vos appréciations.",
                },
                {
                  date: "Fin Février",
                  title: "Conseils de classe du 2ème trimestre",
                  text: "Vos moyennes sont figées. Les professeurs établissent les prévisions de mention. Trop tard pour rattraper.",
                },
                {
                  date: "Mars-Avril",
                  title: "TESCIA & dossiers Parcoursup",
                  text: "Vos bulletins de février sont examinés par les jurys. Mars : TESCIA. Avril : dossiers finalisés.",
                },
              ].map((item) => (
                <div key={item.date} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <div className="text-gold-400 text-sm font-semibold">{item.date}</div>
                  <h3 className="mt-2 text-xl font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm text-slate-300">{item.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                { icon: "📉", title: "Note Bac Blanc : 9-12/20", text: "Comment remonter à 14+ avant les conseils de février ?", solution: "Stage de rattrapage intensif" },
                { icon: "🎯", title: "Objectif : Mention TB", text: "Il a 15 mais veut 18. Comment gagner ces 3 points décisifs ?", solution: "Perfectionnement avec agrégé" },
                { icon: "🚨", title: "Épreuve pratique NSI", text: "L&apos;Épreuve Pratique (ECE) approche. Il ne maîtrise pas la banque de sujets officiels.", solution: "Entraînement intensif ECE" },
              ].map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="text-2xl">{item.icon}</div>
                  <h4 className="mt-2 text-lg font-semibold text-white">{item.title}</h4>
                  <p className="mt-2 text-sm text-slate-300">{item.text}</p>
                  <div className="mt-3 text-xs text-gold-400">Notre solution : {item.solution}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ACADEMIES */}
        <section id="academies" className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              🎯 6 Académies, une pour chaque objectif et budget
            </h2>

            <div className="mt-6 flex flex-col gap-4 items-center">
              <div className="text-sm text-slate-300">Votre enfant est en :</div>
              <div className="flex flex-wrap gap-3">
                {["terminale", "premiere", "both"].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setLevel(lvl)}
                    className={`rounded-full px-4 py-2 border text-sm ${
                      level === lvl
                        ? "border-gold-500 bg-gold-500/10 text-gold-400"
                        : "border-white/10 text-slate-300"
                    }`}
                  >
                    {lvl === "terminale" ? "Terminale" : lvl === "premiere" ? "Première" : "Les deux"}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm">
              {[
                { key: "all", label: "Toutes" },
                { key: "maths", label: "Maths" },
                { key: "nsi", label: "NSI" },
                { key: "budget", label: "~500 TND" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  className={`rounded-full px-4 py-2 border transition ${
                    filter === item.key
                      ? "border-gold-500 bg-gold-500/10 text-gold-400"
                      : "border-white/10 text-slate-300 hover:border-gold-500/40"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredAcademies.map((academy) => (
                <div
                  key={academy.id}
                  id={academy.id}
                  className={`rounded-3xl border ${academy.tone === "premium" ? "border-gold-500/50" : "border-white/10"} bg-white/5 p-6 backdrop-blur-sm hover:border-gold-500/60 transition ${
                    highlightedId === academy.id ? "academy-highlight" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gold-400 font-semibold">{academy.badge}</span>
                    <span className="text-xs text-slate-300">{academy.seats} places restantes</span>
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-white">{academy.title}</h3>
                  <div className="mt-1 text-xs text-slate-400">{academy.tier === "premium" ? "Offre Premium" : "Offre Essentielle"}</div>
                  <div className="mt-2 text-2xl font-bold text-white">
                    {academy.price} <span className="text-sm text-slate-300">TND</span>
                  </div>
                  <div className="text-xs text-emerald-400">Early bird : {academy.early} TND</div>

                  <div className="mt-4 space-y-2 text-sm text-slate-300">
                    <div>🎯 Public : {academy.audience}</div>
                    <div>⏱️ Durée : {academy.duration}</div>
                    <div>👥 Groupe : {academy.group}</div>
                    <div>👨‍🏫 Expert : {academy.expert}</div>
                  </div>

                  <p className="mt-4 text-sm text-slate-300">{academy.description}</p>

                  <ul className="mt-4 space-y-2 text-sm text-slate-200">
                    {academy.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-gold-400 mt-1" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      onClick={() => {
                        setSelectedAcademy(academy);
                        document.getElementById("reservation")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="rounded-full bg-gold-500 px-4 py-3 text-sm font-bold text-black hover:bg-gold-400 transition"
                    >
                      {academy.tier === "premium" ? "👑 Viser l'excellence" : "📈 Sécuriser son Bac"}
                    </button>
                    <button
                      onClick={() => document.getElementById("programmes")?.scrollIntoView({ behavior: "smooth" })}
                      className="rounded-full border border-gold-500 px-4 py-2 text-sm font-semibold text-white hover:bg-gold-500/10"
                    >
                      Voir le programme détaillé
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 rounded-3xl border border-white/10 bg-black/20 p-6">
              <h3 className="text-xl font-semibold text-white">Comment choisir ? Suivez notre guide :</h3>
              <div className="mt-4 grid gap-6 md:grid-cols-4">
                <div>
                  <p className="text-sm text-slate-300">Votre budget ?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[{ key: "500", label: "~500 TND" }, { key: "950", label: "~950 TND" }].map((b) => (
                      <button
                        key={b.key}
                        onClick={() => setHelper((prev) => ({ ...prev, budget: b.key }))}
                        className={`rounded-full px-3 py-1 text-xs border ${
                          helper.budget === b.key ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-white/10 text-slate-300"
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-300">Matière ?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[{ key: "maths", label: "Maths" }, { key: "nsi", label: "NSI" }].map((subjectOption) => (
                      <button
                        key={subjectOption.key}
                        onClick={() => setHelper((prev) => ({ ...prev, subject: subjectOption.key }))}
                        className={`rounded-full px-3 py-1 text-xs border ${
                          helper.subject === subjectOption.key
                            ? "border-gold-500 bg-gold-500/10 text-gold-400"
                            : "border-white/10 text-slate-300"
                        }`}
                      >
                        {subjectOption.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-300">Moyenne actuelle ?</p>
                  <input
                    type="range"
                    min={5}
                    max={18}
                    value={simAvg}
                    onChange={(e) => setSimAvg(Number(e.target.value))}
                    className="mt-3 w-full"
                  />
                  <div className="mt-2 text-sm text-slate-300">{simAvg}/20</div>
                </div>
                <div>
                  <p className="text-sm text-slate-300">Notre recommandation :</p>
                  <div className="mt-2 rounded-2xl border border-gold-500/30 bg-black/20 p-3 text-sm text-slate-200">
                    <strong className={recPulse ? "rec-pulse" : ""}>{recommendation.title}</strong>
                    <div className="text-xs text-slate-400">{recommendation.price} TND • {recommendation.duration}</div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedAcademy(recommendation);
                      focusAcademyCard(recommendation.id);
                    }}
                    className="mt-2 rounded-full bg-gold-500 px-4 py-2 text-xs font-semibold text-black hover:bg-gold-400"
                  >
                    Voir cette académie
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* COMPARAISON */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              ⚖️ Pourquoi 8 jours avec nous valent 2 mois de cours particuliers
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-xl font-semibold text-white">Cours particulier</h3>
                <div className="mt-2 text-sm text-slate-400">~1 200 TND/mois</div>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  <li>📅 1h/semaine dispersée</li>
                  <li>👤 Pas d'émulation de groupe</li>
                  <li>🎯 Objectif non structuré</li>
                  <li>📊 Pas de benchmark</li>
                  <li>🚨 Stress constant</li>
                </ul>
                <div className="mt-4 text-xs text-slate-400">ROI : Faible</div>
              </div>
              <div className="rounded-3xl border border-gold-500/50 bg-white/5 p-6">
                <div className="text-xs text-gold-400">MEILLEUR RAPPORT QUALITÉ/PRIX</div>
                <h3 className="mt-2 text-xl font-semibold text-white">Stage Essentiel Nexus</h3>
                <div className="mt-2 text-sm text-slate-300">590 TND</div>
                <ul className="mt-4 space-y-2 text-sm text-slate-200">
                  <li>⚡ 24h concentrées en 6 jours</li>
                  <li>👥 Groupe de 8 élèves motivés</li>
                  <li>🎯 Objectif clair : 14+ au Bac</li>
                  <li>📈 Benchmark avec pairs</li>
                  <li>😊 Confiance retrouvée</li>
                </ul>
                <div className="mt-4 text-xs text-gold-400">ROI : Excellent</div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <div className="text-xs text-gold-400">INVESTISSEMENT ORIENTATION</div>
                <h3 className="mt-2 text-xl font-semibold text-white">Stage Premium Nexus</h3>
                <div className="mt-2 text-sm text-slate-300">990 TND</div>
                <ul className="mt-4 space-y-2 text-sm text-slate-200">
                  <li>👑 32h avec agrégé</li>
                  <li>🎓 Préparation TESCIA incluse</li>
                  <li>🏆 Objectif : Mention TB</li>
                  <li>📋 Coaching Parcoursup</li>
                  <li>🚀 Avantage concurrentiel</li>
                </ul>
                <div className="mt-4 text-xs text-slate-400">ROI : Exceptionnel</div>
              </div>
            </div>
          </div>
        </section>

        {/* CONTENUS PEDAGOGIQUES */}
        <section className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              📚 Contenus pédagogiques précis par spécialité
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {CONTENTS_BY_TRACK.map((track) => (
                <div key={track.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h3 className="text-lg font-semibold text-white">{track.title}</h3>
                  <ul className="mt-4 space-y-2 text-sm text-slate-300">
                    {track.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-gold-400 mt-1" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PROGRAMMES DETAILLES */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              🧭 Programmes détaillés par stage
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {PROGRAMS.map((program) => (
                <div key={program.title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h3 className="text-lg font-semibold text-white">{program.title}</h3>
                  <div className="mt-4 space-y-2 text-sm text-slate-300">
                    {program.blocks.map((block) => (
                      <div key={block} className="rounded-xl border border-white/10 bg-black/20 p-3">
                        {block}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-sm text-gold-400 font-semibold">{program.total}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PLANNING */}
        <section className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              📅 Planning 16-26 février (optimisé)
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {PLANNING.map((day) => (
                <div key={day.day} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <h3 className="text-lg font-semibold text-white">{day.day}</h3>
                  <ul className="mt-4 space-y-2 text-sm text-slate-300">
                    {day.slots.map((slot) => (
                      <li key={slot} className="flex items-start gap-2">
                        <span className="text-gold-400">•</span>
                        {slot}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PYTHON & MATERIEL */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              💻 Intégration Python & matériel requis
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white">Python pour Maths note 360°</h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  {PYTHON_STACK.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-gold-400 mt-1" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white">Stack NSI</h3>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  {NSI_STACK.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-gold-400 mt-1" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <h3 className="text-lg font-semibold text-white">Matériel requis</h3>
                <div className="mt-4 text-sm text-slate-300">
                  <div className="font-semibold text-white">Maths</div>
                  <ul className="mt-2 space-y-2">
                    {MATERIALS.maths.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                  <div className="mt-4 font-semibold text-white">NSI</div>
                  <ul className="mt-2 space-y-2">
                    {MATERIALS.nsi.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ROI CALCULATOR */}
        <section className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              📊 Simulez l'impact sur la mention
            </h2>
            <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-6">
              <label className="text-sm text-slate-300">Moyenne actuelle (ex: 12/20)</label>
              <input
                type="range"
                min={8}
                max={18}
                value={currentAvg}
                onChange={(e) => setCurrentAvg(Number(e.target.value))}
                className="mt-3 w-full"
              />
              <div className="mt-2 text-sm text-slate-300">{currentAvg}/20</div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-gold-500/30 bg-black/20 p-4">
                  <div className="text-xs text-gold-400">Stage Essentiel (590 TND)</div>
                  <div className="mt-2 text-lg font-semibold text-white">Objectif réaliste : {essentialTarget}/20</div>
                  <div className="text-sm text-slate-300">Mention potentielle : {mentionLabel(essentialTarget)}</div>
                  <div className="mt-2 text-xs text-slate-400">Dossier Parcoursup : moyen → bon</div>
                </div>
                <div className="rounded-2xl border border-gold-500/30 bg-black/20 p-4">
                  <div className="text-xs text-gold-400">Stage Premium (990 TND)</div>
                  <div className="mt-2 text-lg font-semibold text-white">Objectif ambitieux : {premiumTarget}/20</div>
                  <div className="text-sm text-slate-300">Mention potentielle : {mentionLabel(premiumTarget)}</div>
                  <div className="mt-2 text-xs text-slate-400">Dossier Parcoursup : bon → excellent</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedAcademy(recommendation);
                  focusAcademyCard(recommendation.id);
                }}
                className="mt-6 rounded-full bg-gold-500 px-5 py-2 text-sm font-semibold text-black hover:bg-gold-400"
              >
                Voir cette académie
              </button>
            </div>
          </div>
        </section>

        {/* GARANTIES */}
        <section className="py-20 bg-black/20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              🛡️ Votre investissement, notre engagement
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {[
                { title: "Garantie Satisfaction Jour 1", text: "Remboursement intégral si votre enfant n'accroche pas dès le premier jour.", icon: ShieldCheck },
                { title: "Garantie Progression", text: "+2 points au prochain DS ou 2 séances individuelles offertes.", icon: TrendingUp },
                { title: "Garantie TESCIA", text: "Score simulation < 70% = coaching supplémentaire gratuit.", icon: Sparkles },
                { title: "Garantie Continuité", text: "-20% sur l'abonnement annuel si satisfaction stage.", icon: Award },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gold-500/10 text-gold-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 text-sm text-slate-300">{item.text}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-8 flex items-center justify-center gap-3 rounded-2xl border border-gold-500/30 bg-white/5 px-6 py-4 text-sm text-slate-300">
              <Star className="h-5 w-5 text-gold-400" />
              <span><strong className="text-white">98% des parents recommandent Nexus</strong> · Enquête satisfaction décembre 2025</span>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="py-20">
          <div className="container mx-auto px-4 md:px-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white font-serif text-center">
              💬 Ce que disent les parents et élèves
            </h2>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {TESTIMONIALS.map((item) => (
                <div key={item.author} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                  <div className="text-sm text-slate-200">“{item.quote}”</div>
                  <div className="mt-4 text-xs text-slate-400">
                    <strong className="text-white">{item.author}</strong> — {item.role}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-gold-400">
                    {item.stats.map((stat) => (
                      <span key={stat} className="rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1">
                        {stat}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 rounded-2xl border border-white/10 bg-black/20 p-6 text-center">
              <h3 className="text-lg font-semibold text-white">Transformations documentées :</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-3 text-sm text-slate-300">
                <div>Avant : 11/20 moyenne Maths → Après : 15/20</div>
                <div>Avant : 9/20 NSI → Après : 14/20</div>
                <div>Avant : 10/20 Maths → Après : 14/20</div>
              </div>
            </div>
          </div>
        </section>

        {/* RESERVATION */}
        <section id="reservation" className="py-20 bg-black/20">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
                <h2 className="text-3xl font-bold text-white font-serif">
                  ⚠️ Avant les conseils de février : dernières places
                </h2>
                <div className="mt-6 rounded-2xl border border-gold-500/30 bg-black/30 p-4">
                  <div className="text-xs text-slate-300">Early bird se termine dans :</div>
                  <div className="mt-2 flex items-center gap-3 text-center text-white">
                    <div>
                      <div className="text-2xl font-bold text-gold-400">{countdown.days}</div>
                      <div className="text-xs text-slate-400">jours</div>
                    </div>
                    <div className="text-gold-400">:</div>
                    <div>
                      <div className="text-2xl font-bold text-gold-400">{countdown.hours}</div>
                      <div className="text-xs text-slate-400">heures</div>
                    </div>
                    <div className="text-gold-400">:</div>
                    <div>
                      <div className="text-2xl font-bold text-gold-400">{countdown.minutes}</div>
                      <div className="text-xs text-slate-400">minutes</div>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  {reservationStep === 1 && (
                    <div>
                      <h3 className="text-lg font-semibold text-white">Étape 1 : Choisissez l'académie</h3>
                      <div className="mt-4 space-y-3">
                        {ACADEMIES.map((academy) => (
                          <button
                            key={academy.id}
                            onClick={() => setSelectedAcademy(academy)}
                            className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                              selectedAcademy.id === academy.id
                                ? "border-gold-500 bg-gold-500/10"
                                : "border-white/10 bg-black/20"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-white">{academy.title}</div>
                              <div className="text-sm text-slate-300">{academy.price} TND</div>
                            </div>
                            <div className="text-xs text-slate-400">{academy.audience} • {academy.duration}</div>
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setReservationStep(2)}
                        className="mt-6 rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-black hover:bg-gold-400"
                      >
                        Suivant →
                      </button>
                    </div>
                  )}

                  {reservationStep === 2 && (
                    <div>
                      <h3 className="text-lg font-semibold text-white">Étape 2 : Informations personnelles</h3>
                      {isSuccess ? (
                        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                          Réservation reçue ! Un conseiller va vous rappeler rapidement.
                        </div>
                      ) : (
                        <form onSubmit={handleSubmit} className="mt-4">
                          <div className="grid gap-4">
                            <input
                              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                              placeholder="Nom du parent"
                              value={formData.parent}
                              onChange={(e) => setFormData((prev) => ({ ...prev, parent: e.target.value }))}
                            />
                            <input
                              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                              placeholder="Téléphone"
                              value={formData.phone}
                              onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                            />
                            <input
                              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white"
                              placeholder="Classe de l'élève"
                              value={formData.classe}
                              onChange={(e) => setFormData((prev) => ({ ...prev, classe: e.target.value }))}
                            />
                          </div>
                          {errorMsg && (
                            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-200">
                              {errorMsg}
                            </div>
                          )}
                          <div className="mt-6 flex gap-3">
                            <button
                              type="button"
                              onClick={() => setReservationStep(1)}
                              className="rounded-full border border-gold-500 px-6 py-3 text-sm font-semibold text-white"
                            >
                              ← Précédent
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="rounded-full bg-gold-500 px-6 py-3 text-sm font-bold text-black hover:bg-gold-400 disabled:opacity-60"
                            >
                              {isSubmitting ? "Envoi..." : "Réserver maintenant"}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-8 flex flex-wrap gap-3 text-xs text-slate-300">
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">🔒 Paiement sécurisé</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">📄 Facture fournie</span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1">🔄 Annulation gratuite 7j</span>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
                <h3 className="text-xl font-semibold text-white">Votre réservation</h3>
                <div className="mt-4 space-y-3 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Académie :</span>
                    <strong className="text-white">{selectedAcademy.title}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Prix normal :</span>
                    <span className="line-through">{selectedAcademy.price} TND</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Réduction early bird :</span>
                    <strong className="text-emerald-400">-15%</strong>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/10 pt-3">
                    <span>Total à payer :</span>
                    <strong className="text-gold-400">{selectedAcademy.early} TND</strong>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="text-sm font-semibold text-white">Ce qui est inclus :</h4>
                  <ul className="mt-3 space-y-2 text-sm text-slate-300">
                    {selectedAcademy.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-gold-400" /> {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 rounded-2xl border border-gold-500/30 bg-black/30 p-4 text-sm text-slate-300">
                  <strong className="text-white">⚠️ Seulement {selectedAcademy.seats} places restantes</strong>
                  <p>Les inscriptions se font dans l'ordre d'arrivée.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
