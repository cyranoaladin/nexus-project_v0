"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Landmark,
  Users,
  FileSearch,
  GraduationCap,
  Compass,
  Bot,
  Code,
  Cpu,
  ServerCog,
  Sparkles,
  LayoutDashboard,
  CheckCircle2,
  X,
} from "lucide-react";

const ICONS = {
  Landmark,
  Users,
  FileSearch,
  GraduationCap,
  Compass,
  Bot,
  Code,
  Cpu,
  ServerCog,
  Sparkles,
  LayoutDashboard,
} as const;

const TABS = [
  {
    id: "etablissements",
    label: "Vous êtes un Établissement",
    items: [
      {
        title: "L'École Augmentée (Studio & Infra)",
        subtitle: "Gouvernance & Outils IA Souverains",
        shortDesc:
          "Équipez votre structure avec Korrigo, des Agents Vie Scolaire et une certification sécurisée.",
        fullDesc:
          "Ne laissez pas la tech gérer votre école, utilisez la tech pour la piloter. Nous déployons chez vous : 1) Korrigo pour diviser par deux le temps de correction des profs. 2) Des Agents IA sécurisés pour l'administratif. 3) Une certification sécurisée des diplômes pour votre image de marque.",
        benefits: [
          "Gain de temps administratif (-30%)",
          "Image d'excellence immédiate",
          "Données 100% souveraines",
        ],
        icon: "Landmark",
      },
      {
        title: "Formation des Enseignants",
        subtitle: "Pédagogie de l'IA & Acculturation",
        shortDesc:
          "Transformez vos professeurs en 'Enseignants Augmentés'.",
        fullDesc:
          "L'IA ne remplacera pas le prof, mais le prof qui utilise l'IA remplacera celui qui ne l'utilise pas. Nos formations pratiques apprennent à vos équipes à créer des cours avec l'IA, à détecter le plagiat intelligent et à utiliser ces outils pour personnaliser l'apprentissage en classe.",
        benefits: [
          "Adhésion des équipes",
          "Innovation pédagogique réelle",
          "Certification Qualiopi possible",
        ],
        icon: "Users",
      },
      {
        title: "Audit & Stratégie Numérique",
        subtitle: "Pilotage & Conformité 360°",
        shortDesc: "Un diagnostic complet pour réussir votre transition numérique.",
        fullDesc:
          "Avant d'investir, il faut comprendre. Nous auditons vos infrastructures, la maturité numérique de vos équipes et votre conformité RGPD. Nous livrons une feuille de route claire pour faire de votre établissement un leader technologique sans sacrifier l'humain.",
        benefits: [
          "Plan d'action sur 12 mois",
          "Sécurisation des données élèves",
          "Optimisation des budgets DSI",
        ],
        icon: "FileSearch",
      },
    ],
  },
  {
    id: "parents_eleves",
    label: "Parents & Élèves (Lycée)",
    items: [
      {
        title: "ARIA : Tuteur IA 24/7",
        subtitle: "Assistant pédagogique intelligent",
        shortDesc:
          "Assistant pédagogique intelligent qui connaît le programme et répond aux questions sans donner la solution brute.",
        fullDesc:
          "Assistant pédagogique intelligent qui connaît le programme et répond aux questions sans donner la solution brute.",
        benefits: [
          "Suivi personnalisé 24/7",
          "Réponses guidées, pas de solution brute",
          "Progression visible pour les familles",
        ],
        icon: "Bot",
      },
      {
        title: "Dashboard de Réussite",
        subtitle: "Pilotage centralisé",
        shortDesc:
          "Notes, planning visio, ressources et replays centralisés dans un espace unique.",
        fullDesc:
          "Notes, planning visio, ressources et replays centralisés dans un espace unique.",
        benefits: [
          "Toutes les données au même endroit",
          "Accès direct aux ressources et replays",
          "Suivi clair pour élèves et parents",
        ],
        icon: "LayoutDashboard",
      },
      {
        title: "Pack Excellence",
        subtitle: "Soutien ciblé Maths/NSI",
        shortDesc:
          "Soutien ciblé Maths/NSI pour viser la Mention Très Bien.",
        fullDesc:
          "Soutien ciblé Maths/NSI pour viser la Mention Très Bien.",
        benefits: [
          "Professeurs agrégés et certifiés",
          "Méthodologie rigoureuse",
          "Préparation aux épreuves écrites",
        ],
        icon: "GraduationCap",
      },
    ],
  },
  {
    id: "formation_tech",
    label: "Formation Pro & Tech",
    items: [
      {
        title: "Bootcamps Deep Tech",
        subtitle: "Web3, Blockchain & Rust",
        shortDesc: "Des compétences rares pour des carrières à haut revenu.",
        fullDesc:
          "Sortez du lot. Nous formons sur les technologies les plus demandées et les moins enseignées : Développement Blockchain (Solana/Rust), Smart Contracts sécurisés et Architecture Décentralisée. Une formation intense pour développeurs voulant changer de dimension.",
        benefits: [
          "Projets réels sur Mainnet",
          "Certification on-chain",
          "Accès réseau écosystème Web3",
        ],
        icon: "Code",
      },
      {
        title: "Masterclass Assistants Intelligents",
        subtitle: "Créez les employés de demain",
        shortDesc: "Apprenez à construire et orchestrer des agents IA autonomes.",
        fullDesc:
          "Le futur n'est plus au Chatbot, mais à l'Agent qui agit. Apprenez à utiliser les frameworks modernes (LangChain, AutoGen) pour créer des agents capables de coder, de faire de la recherche ou de gérer un service client de A à Z.",
        benefits: [
          "Maîtrise des LLMs (OpenAI/Mistral)",
          "Création de workflows complexes",
          "Compétence n°1 demandée en 2025",
        ],
        icon: "Cpu",
      },
      {
        title: "Nexus Labs (Offre Centres)",
        subtitle: "Votre Lab Tech en Marque Blanche",
        shortDesc: "Centres de formation : intégrez nos modules tech dans votre catalogue.",
        fullDesc:
          "Vous êtes un centre de formation ? Ne dépensez pas des fortunes en R&D. Nous déployons chez vous des 'Labs' clés en main (Contenu pédagogique + Environnement technique cloud) pour que vous puissiez vendre des formations IA et Blockchain à vos propres étudiants dès demain.",
        benefits: [
          "Déploiement immédiat",
          "Marque blanche totale",
          "Contenu mis à jour en continu",
        ],
        icon: "ServerCog",
      },
    ],
  },
];

export default function DetailedServices() {
  const [active, setActive] = useState(TABS[0].id);
  const [openItem, setOpenItem] = useState<(typeof TABS)[number]["items"][number] | null>(null);
  const current = TABS.find((tab) => tab.id === active) ?? TABS[0];
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash && TABS.some((tab) => tab.id === hash)) {
        setActive(hash);
        window.setTimeout(() => {
          sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 0);
      }
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  return (
    <section ref={sectionRef} className="py-24 bg-surface-darker">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold text-white font-display">
            Détail de l’Offre
          </h2>
          <p className="mt-4 text-slate-300 max-w-3xl mx-auto">
            Des livrables concrets, pensés pour la direction, l’IT et les équipes pédagogiques.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md p-6 md:p-10">
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                id={tab.id}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition border ${
                  active === tab.id
                    ? "bg-brand-accent text-slate-950 border-brand-accent"
                    : "bg-white/5 text-slate-300 border-white/10 hover:border-brand-accent/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {current.items.map((item) => {
              const Icon = ICONS[item.icon as keyof typeof ICONS];
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md transition hover:border-brand-accent/50 hover:bg-white/10"
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-brand-accent/10 p-2 text-brand-accent">
                      {Icon ? <Icon className="h-5 w-5" strokeWidth={1.5} /> : null}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1 font-display">
                        {item.title}
                      </h3>
                      <p className="text-sm text-brand-accent font-semibold mb-2">
                        {item.subtitle}
                      </p>
                      <p className="text-sm text-slate-300">
                        {item.shortDesc}
                      </p>
                      <button
                        onClick={() => setOpenItem(item)}
                        className="mt-4 text-sm text-brand-accent underline-offset-4 hover:underline"
                      >
                        En savoir plus
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {active === "parents_eleves" && (
            <div className="mt-12 flex flex-col items-center justify-center gap-6 rounded-2xl border border-brand-accent/30 bg-white/5 p-8 text-center backdrop-blur-md md:p-12">
              <h3 className="text-2xl font-bold font-display text-white">
                Prêt à exceller ?
              </h3>
              <p className="text-slate-300 max-w-xl">
                Accédez à votre espace complet : Tuteur ARIA, Cours en Visio et
                Suivi de progression.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <a
                  href="/famille"
                  className="rounded-full bg-brand-accent px-8 py-3 font-bold text-black hover:bg-brand-accent-dark transition"
                >
                  Me connecter à mon Espace
                </a>
                <a
                  href="/famille"
                  className="rounded-full border border-brand-accent px-8 py-3 font-bold text-white hover:bg-brand-accent/10 transition"
                >
                  Voir la Démo Interactive
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {openItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-2xl rounded-3xl border border-brand-accent bg-surface-darker p-8 text-white shadow-2xl">
            <button
              onClick={() => setOpenItem(null)}
              className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 hover:text-white"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="text-brand-accent text-xs uppercase tracking-widest">
              {current.label}
            </div>
            <h3 className="mt-2 text-2xl font-bold font-display">
              {openItem.title}
            </h3>
            <p className="text-brand-accent font-semibold mt-1">
              {openItem.subtitle}
            </p>
            <p className="mt-4 text-slate-300 leading-relaxed">
              {openItem.fullDesc}
            </p>

            <div className="mt-6 space-y-3">
              {openItem.benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3 text-slate-300">
                  <CheckCircle2 className="h-5 w-5 text-brand-accent mt-0.5" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
