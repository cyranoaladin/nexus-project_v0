"use client";

import { useMemo, useRef, useState } from "react";
import { Outfit, Space_Grotesk } from "next/font/google";
import Image from "next/image";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Layers,
  Plus,
  Printer,
  Sparkles,
  X,
} from "lucide-react";

type ProgramDay = {
  day: string;
  title: string;
  points: string[];
  badges: string[];
};

type SkillMetric = {
  label: string;
  score: number;
};

type Html2PdfApi = {
  set: (options: Record<string, unknown>) => {
    from: (element: HTMLElement) => {
      save: () => Promise<void>;
    };
  };
};

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "600", "800"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["300", "500", "700"],
});

const PROGRAM_DAYS: ProgramDay[] = [
  {
    day: "JOUR 1",
    title: "Diagnostic & Fondations",
    points: [
      "Audit complet des competences (Algorithme Nexus)",
      "Analyse : Tangente glissante et derivation",
      "Introduction aux limites (anticipation Terminale)",
    ],
    badges: ["Nexus Lab", "Python Start"],
  },
  {
    day: "JOUR 2",
    title: "Optimisation & Parametres",
    points: [
      "Etude de fonctions avec parametres",
      "Problemes d'optimisation geometrique",
      "Drill : calcul litteral rapide",
    ],
    badges: ["GeoGebra", "Formalisme"],
  },
  {
    day: "JOUR 3",
    title: "La Fonction Exponentielle",
    points: [
      "Proprietes algebriques fondamentales",
      "Modelisation de croissance",
      "Resolution d'equations transcendantes",
    ],
    badges: ["Modelisation", "Calcul"],
  },
  {
    day: "JOUR 4",
    title: "Trigonometrie Expert",
    points: [
      "Cercle trigonometrique et enroulement",
      "Formules d'addition et duplication",
      "Equations complexes",
    ],
    badges: ["Module Enrouleur", "Rigueur"],
  },
  {
    day: "JOUR 5",
    title: "Algorithmique & NSI",
    points: [
      "Logique booleenne et boucles while/for",
      "Implementation : dichotomie et suites",
      "Debogage de scripts Python",
    ],
    badges: ["Python IDE", "Code"],
  },
  {
    day: "JOUR 6",
    title: "Geometrie Vectorielle",
    points: [
      "3 definitions du produit scalaire",
      "Projection orthogonale",
      "Applications physiques (travail)",
    ],
    badges: ["VectorProjector", "3D"],
  },
  {
    day: "JOUR 7",
    title: "Lignes de Niveau",
    points: [
      "Theoreme d'Al-Kashi",
      "Ensembles de points (cercles/droites)",
      "Problemes de lieu geometrique",
    ],
    badges: ["Mafs", "Geometrie"],
  },
  {
    day: "JOUR 8",
    title: "Probabilites & Data",
    points: [
      "Probabilites conditionnelles",
      "Variables aleatoires et esperance",
      "Simulation Monte Carlo",
    ],
    badges: ["MonteCarloSim", "Data Science"],
  },
  {
    day: "JOUR 9",
    title: "Suites & Infini",
    points: [
      "Suites arithmetiques/geometriques",
      "Visualisation toile d'araignee",
      "Notion intuitive de limite",
    ],
    badges: ["Module Toile", "Analyse"],
  },
  {
    day: "JOUR 10",
    title: "Grand Chelem (Exam)",
    points: [
      "Simulation epreuve anticipee 2026",
      "Partie automatismes + problemes",
      "Bilan et orientation Terminale",
    ],
    badges: ["Certification", "Bilan"],
  },
];

const SKILL_METRICS: SkillMetric[] = [
  { label: "Analyse Reelle & Asymptotique", score: 95 },
  { label: "Geometrie Vectorielle & Analytique", score: 90 },
  { label: "Probabilites & Simulation", score: 88 },
  { label: "Algorithmique Appliquee (Python / NSI)", score: 85 },
  { label: "Raisonnement Deductif & Demonstration", score: 92 },
];

const html2PdfCdn = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";

function loadHtml2Pdf(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if ((window as Window & { html2pdf?: unknown }).html2pdf) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-html2pdf="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Impossible de charger html2pdf.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = html2PdfCdn;
    script.async = true;
    script.dataset.html2pdf = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossible de charger html2pdf."));
    document.body.appendChild(script);
  });
}

export default function DashboardExcellencePage() {
  const [openDays, setOpenDays] = useState<Record<number, boolean>>({ 0: true });
  const [isPortfolioOpen, setIsPortfolioOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [certificateLabel, setCertificateLabel] = useState("Generer Certificat Officiel");
  const certificateRef = useRef<HTMLDivElement>(null);

  const metrics = useMemo(
    () => [
      { value: "30h", label: "Volume Intensif" },
      { value: "1:1", label: "Ratio Coaching" },
      { value: "Agreg", label: "Certification" },
      { value: "2026", label: "Objectif Bac" },
    ],
    []
  );

  const toggleDay = (index: number) => {
    setOpenDays((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const generateCertificate = async () => {
    if (!certificateRef.current || isGeneratingPdf) {
      return;
    }

    try {
      setIsGeneratingPdf(true);
      setCertificateLabel("Generation en cours...");
      await loadHtml2Pdf();

      const html2pdf = (window as Window & { html2pdf?: (() => Html2PdfApi) | undefined }).html2pdf;
      if (!html2pdf) {
        throw new Error("html2pdf non disponible");
      }

      await html2pdf()
        .set({
          margin: 0,
          filename: "Certificat_Excellence_Nexus.pdf",
          image: { type: "jpeg", quality: 1 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            backgroundColor: "#ffffff",
          },
          jsPDF: {
            unit: "px",
            format: [1123, 794],
            orientation: "landscape",
          },
        })
        .from(certificateRef.current)
        .save();

      setCertificateLabel("Telecharge");
      window.setTimeout(() => setCertificateLabel("Generer Certificat Officiel"), 2200);
    } catch {
      setCertificateLabel("Echec du telechargement");
      window.setTimeout(() => setCertificateLabel("Generer Certificat Officiel"), 2200);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <main
      className={`${outfit.className} ${outfit.variable} ${spaceGrotesk.variable} min-h-screen bg-slate-950 pb-32 text-slate-100`}
    >
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,rgba(99,102,241,0.15),transparent_38%),radial-gradient(circle_at_85%_80%,rgba(244,114,182,0.12),transparent_38%)]" />

      <header className="sticky top-0 z-40 border-b border-white/5 bg-slate-950/80 px-4 py-4 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo_nexus_reussite.png"
              alt="Nexus Reussite"
              width={148}
              height={44}
              priority
              className="h-9 w-auto object-contain"
            />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Nexus Reussite</p>
              <p className="[font-family:var(--font-space-grotesk)] text-base font-bold">Espace Excellence</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Session active : Excellence
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 pt-12 md:px-8">
        <div className="text-center">
          <h1 className="[font-family:var(--font-space-grotesk)] bg-gradient-to-r from-indigo-300 via-violet-300 to-pink-300 bg-clip-text text-4xl font-bold text-transparent md:text-6xl">
            Protocole Excellence
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 md:text-xl">
            Programme intensif de coaching mathematique et algorithmique
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          {metrics.map((metric) => (
            <article
              key={metric.label}
              className="rounded-2xl border border-slate-700/60 bg-slate-900/55 p-6 backdrop-blur-xl transition hover:-translate-y-1 hover:border-indigo-400/60 hover:shadow-[0_18px_40px_-18px_rgba(99,102,241,0.7)]"
            >
              <p className="[font-family:var(--font-space-grotesk)] text-4xl font-bold text-white">{metric.value}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">{metric.label}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-4xl px-4 md:px-8">
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-700/60 bg-slate-900/50 px-4 py-3 backdrop-blur-xl">
          <Image
            src="/images/logo_nexus_reussite.png"
            alt="Nexus Reussite"
            width={132}
            height={40}
            className="h-8 w-auto object-contain"
          />
          <p className="text-xs uppercase tracking-[0.14em] text-slate-300 md:text-sm">Planning officiel - Session Excellence</p>
        </div>

        <div className="relative pl-0 md:pl-12">
          <div className="absolute bottom-4 left-5 top-4 hidden w-px bg-gradient-to-b from-indigo-400/50 to-pink-400/50 md:block" />

          <div className="space-y-4">
            {PROGRAM_DAYS.map((day, index) => {
              const isOpen = !!openDays[index];

              return (
                <article
                  key={day.day}
                  className="group relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/60 backdrop-blur-xl"
                >
                  <button
                    type="button"
                    onClick={() => toggleDay(index)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-300">{day.day}</p>
                      <h3 className="text-lg font-semibold text-white">{day.title}</h3>
                    </div>
                    <span
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-600 bg-slate-950/80 transition ${
                        isOpen ? "rotate-45 border-indigo-300 text-indigo-200" : "text-slate-400"
                      }`}
                    >
                      <Plus className="h-4 w-4" />
                    </span>
                  </button>

                  <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="overflow-hidden border-t border-white/5 bg-slate-950/30">
                      <div className="space-y-4 px-5 py-5">
                        <ul className="space-y-2 text-sm text-slate-300">
                          {day.points.map((point) => (
                            <li key={point} className="flex items-start gap-2">
                              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-pink-300" />
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>

                        <div className="flex flex-wrap gap-2">
                          {day.badges.map((badge) => {
                            const highlight = badge.includes("Lab") || badge.includes("Python");
                            return (
                              <span
                                key={badge}
                                className={`rounded-md border px-3 py-1 text-xs [font-family:var(--font-space-grotesk)] ${
                                  highlight
                                    ? "border-indigo-400/40 bg-indigo-500/10 text-indigo-200"
                                    : "border-slate-600 bg-slate-800/50 text-slate-300"
                                }`}
                              >
                                {badge}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {isPortfolioOpen ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsPortfolioOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsPortfolioOpen(false);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-white/10 bg-gradient-to-r from-slate-800 to-slate-950 p-6">
              <div>
                <h2 className="[font-family:var(--font-space-grotesk)] text-2xl font-bold text-amber-300">
                  Certificat de Competences
                </h2>
                <p className="mt-1 text-sm text-slate-400">Session Hiver 2026 | Nexus Reussite Lab</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPortfolioOpen(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-2">
              <section>
                <h3 className="mb-4 inline-block border-b-2 border-indigo-400 pb-1 text-white">Competences Cles (KPI)</h3>
                <div className="space-y-4">
                  {SKILL_METRICS.map((metric) => (
                    <article key={metric.label}>
                      <div className="mb-1 flex items-center justify-between text-xs text-slate-300 md:text-sm">
                        <span>{metric.label}</span>
                        <span>{metric.score}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-700/60">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-pink-300"
                          style={{ width: `${metric.score}%` }}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="space-y-6">
                <div>
                  <h3 className="mb-3 inline-block border-b-2 border-indigo-400 pb-1 text-white">Projet Capstone</h3>
                  <p className="text-sm text-slate-300">
                    <span className="font-semibold text-white">Theme :</span> Optimisation de trajectoires et modelisation
                    probabiliste.
                  </p>
                  <p className="mt-3 text-sm text-slate-400">
                    L'eleve a modelise un probleme complexe meleant geometrie vectorielle et simulation aleatoire pour
                    determiner une zone optimale, avec verification Python.
                  </p>
                </div>

                <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-indigo-200">
                    <CheckCircle2 className="h-4 w-4" />
                    Mots-cles Parcoursup
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Rigueur academique",
                      "Autonomie",
                      "Capacite d'abstraction",
                      "Immersion intensive (30h)",
                      "Modelisation mathematique",
                    ].map((tag) => (
                      <span key={tag} className="rounded-md border border-white/10 bg-slate-950/80 px-3 py-1 text-xs text-slate-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Certifie par</p>
                  <p className="text-lg font-bold text-white">M. Alaeddine BEN RHOUMA</p>
                  <p className="text-sm text-indigo-300">Professeur Agrege de Mathematiques</p>
                  <p className="text-xs text-slate-400">Lycee Pierre Mendes France de Tunis</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-slate-900/90 px-4 py-4 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 md:flex-row">
          <p className="hidden text-xs text-slate-400 md:block">
            Etudiant : acces premium active • <span className="text-emerald-300">Nexus Lab connected</span>
          </p>

          <div className="flex w-full flex-wrap justify-center gap-2 md:w-auto md:justify-end">
            <button
              type="button"
              onClick={() => setIsPortfolioOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-300 hover:text-slate-900"
            >
              <Layers className="h-4 w-4" />
              Voir Competences
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:-translate-y-0.5"
            >
              <Printer className="h-4 w-4" />
              Planning
            </button>

            <button
              type="button"
              onClick={generateCertificate}
              disabled={isGeneratingPdf}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.45)] transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {certificateLabel === "Telecharge" ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              {certificateLabel}
            </button>
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed -left-[9999px] top-0 z-[-1] h-[794px] w-[1123px] overflow-hidden bg-white opacity-0">
        <div ref={certificateRef} className="h-[794px] w-[1123px] bg-white p-10 text-slate-800">
          <div className="relative flex h-full flex-col items-center justify-center border-[10px] border-double border-amber-400 bg-[radial-gradient(circle,#fffaf0_0%,#ffffff_100%)] p-10">
            <img
              src="/images/logo_nexus_reussite.png"
              alt="Nexus Reussite"
              width="280"
              height="80"
              style={{ width: "240px", height: "auto", marginBottom: "12px" }}
            />
            <p className="[font-family:var(--font-space-grotesk)] text-3xl font-bold tracking-[0.2em] text-slate-900">
              NEXUS REUSSITE ACADEMY
            </p>
            <p className="mt-6 text-2xl italic text-slate-500">Certifie que</p>
            <p className="mt-4 border-b-2 border-amber-400 px-10 pb-2 text-6xl font-bold text-slate-900">Sarah BEN SALAH</p>
            <p className="mt-8 text-5xl font-bold uppercase tracking-[0.15em] text-amber-700">ATTESTATION D'EXCELLENCE</p>

            <p className="mt-8 max-w-4xl text-center font-medium leading-relaxed text-slate-700">
              A complete avec succes le Programme Intensif de Mathematiques Avancees & Algorithmique (Volume : 30 heures).
              Ce cursus de niveau Premiere Generale - Objectif Prepa atteste d'une maitrise approfondie de l'Analyse Reelle,
              de la Geometrie Vectorielle et de la Programmation Scientifique, validee par un Professeur Agrege.
            </p>

            <div className="absolute bottom-10 left-1/2 flex h-28 w-28 -translate-x-1/2 items-center justify-center rounded-full border-4 border-amber-700 text-center text-sm font-bold text-amber-700 shadow-[0_0_0_10px_rgba(180,83,9,0.1)]">
              NEXUS
              <br />
              CERTIFIED
              <br />
              2026
            </div>

            <div className="mt-16 flex w-full justify-between px-12">
              <div className="text-center">
                <p className="font-semibold">Le Responsable Pedagogique</p>
                <div className="mx-auto mt-14 h-px w-64 bg-slate-900" />
                <p className="mt-2 text-4xl italic">A. Ben Rhouma</p>
                <p className="text-sm">Professeur Agrege de Mathematiques</p>
              </div>

              <div className="text-center">
                <p className="font-semibold">Date de delivrance</p>
                <div className="mx-auto mt-14 h-px w-40 bg-slate-900" />
                <p className="mt-2">16 Fevrier 2026</p>
                <p className="text-sm">Tunis, Tunisie</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setIsPortfolioOpen(true)}
        className="fixed bottom-24 right-4 inline-flex items-center gap-2 rounded-full border border-indigo-300/35 bg-indigo-500/20 px-4 py-2 text-xs font-semibold text-indigo-100 backdrop-blur md:hidden"
      >
        <Sparkles className="h-4 w-4" />
        Portfolio
      </button>
    </main>
  );
}
