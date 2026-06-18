"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  GraduationCap,
  MessageCircle,
  Shield,
  Sparkles,
  Star,
  Target,
  Zap,
  Clock,
} from "lucide-react";
import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { AriaChat } from "@/components/ui/aria-chat";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { resolveSubjectIcon } from "@/lib/ui-icons";

const ARIA_SUBJECTS = [
  { name: "Mathématiques", value: "MATHEMATIQUES", desc: "Analyse, algèbre, probabilités, géométrie" },
  { name: "NSI", value: "NSI", desc: "Algorithmique, structures de données, Python, SQL" },
  { name: "Physique-Chimie", value: "PHYSIQUE_CHIMIE", desc: "Mécanique, thermodynamique, chimie organique" },
  { name: "Français", value: "FRANCAIS", desc: "Commentaire, dissertation, oral du bac" },
  { name: "Philosophie", value: "PHILOSOPHIE", desc: "Dissertation, explication de texte" },
  { name: "Histoire-Géo", value: "HISTOIRE_GEO", desc: "Composition, étude de documents" },
  { name: "SVT", value: "SVT", desc: "Génétique, écologie, géologie" },
  { name: "SES", value: "SES", desc: "Économie, sociologie, science politique" },
  { name: "Anglais", value: "ANGLAIS", desc: "Compréhension, expression, méthodologie" },
  { name: "Espagnol", value: "ESPAGNOL", desc: "Compréhension, expression, civilisation" },
];

const ARIA_FEATURES = [
  {
    icon: Clock,
    title: "Accès selon formule",
    description: "ARIA complète certains parcours ou add-ons selon la formule choisie.",
  },
  {
    icon: Target,
    title: "Réponses adaptées au niveau",
    description: "Seconde, Première ou Terminale: les explications restent alignées sur le programme.",
  },
  {
    icon: BookOpen,
    title: "Basée sur les programmes officiels",
    description: "ARIA s’appuie sur les contenus pédagogiques validés par Nexus Réussite.",
  },
  {
    icon: Zap,
    title: "Réponses instantanées",
    description: "Posez votre question et obtenez une explication claire sans attendre un créneau.",
  },
  {
    icon: Shield,
    title: "Complément de l’humain",
    description: "ARIA aide à clarifier, pas à remplacer le travail pédagogique ni la relecture.",
  },
  {
    icon: Star,
    title: "Amélioration continue",
    description: "Chaque retour aide à rendre l’outil plus utile et plus précis.",
  },
];

const ARIA_STEPS = [
  {
    step: "1",
    title: "Choisissez la matière",
    description: "Sélectionnez la discipline concernée parmi les matières du lycée français.",
  },
  {
    step: "2",
    title: "Posez une question",
    description: "Formulez votre besoin comme vous le feriez avec un assistant pédagogique.",
  },
  {
    step: "3",
    title: "Lisez la réponse",
    description: "ARIA propose une explication structurée, puis un exemple ou une méthode.",
  },
  {
    step: "4",
    title: "Travaillez avec méthode",
    description: "Reprenez la réponse avec un cadre clair et l’appui de l’accompagnement humain.",
  },
];

export default function PlateformeAriaPage() {
  return (
    <main className="luxury min-h-screen" id="main-content">
      <CorporateNavbar />

      <section className="bg-lux-ink px-4 py-16 pt-28 md:px-6">
        <div className="mx-auto max-w-6xl text-center">
          <Badge className="mb-4 border border-lux-line/40 bg-white/5 text-lux-gold-wash">
            <BrainCircuit className="mr-2 h-4 w-4" />
            Intelligence artificielle pédagogique
          </Badge>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="font-fraunces text-4xl font-light tracking-tight text-lux-ivory md:text-6xl"
          >
            Rencontrez <span className="text-lux-gold-wash">ARIA</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mx-auto mt-5 max-w-3xl text-lg text-lux-ivory/75 md:text-xl"
          >
            ARIA complète l’accompagnement humain avec une aide pédagogique structurée,
            disponible selon formule pour réviser, s’entraîner et clarifier les méthodes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.16 }}
            className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"
          >
            <Link href="/bilan-gratuit" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
              Demander un bilan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="/offres" className="lux-cta-secondary rounded-lg px-6 py-3.5 text-sm font-semibold text-lux-ivory border-lux-line/40">
              Voir les offres ARIA
            </Link>
          </motion.div>

          <div className="mt-10 flex flex-wrap justify-center gap-3 text-sm text-lux-ivory/80">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Complément de l’humain</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Relu et travaillé avec méthode</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2">Programmes officiels</span>
          </div>
        </div>
      </section>

      <section className="bg-lux-paper px-4 py-14 md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-lux-line bg-lux-white lux-shadow">
            <CardContent className="p-6 md:p-8">
              <Badge variant="outline" className="mb-4 border-lux-line/70 text-lux-slate">
                <Sparkles className="mr-2 h-4 w-4 text-lux-gold" />
                Qu’est-ce qu’ARIA ?
              </Badge>
              <h2 className="text-3xl font-fraunces text-lux-ivory md:text-4xl">
                Un assistant pédagogique <span className="text-lux-gold-deep">propulsé par l’IA</span>
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-lux-ivory/75 md:text-base">
                ARIA, pour Assistant de Révision Intelligent et Adaptatif, est conçue pour
                compléter le travail humain. Elle aide à reformuler, expliquer et structurer,
                mais les réponses doivent toujours être relues et retravaillées avec méthode.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-lux-line/60 bg-lux-paper/70 p-4">
                  <p className="text-sm font-semibold text-lux-ink">Rôle</p>
                  <p className="mt-1 text-sm text-lux-slate">Outil d’aide à la révision, pas remplacement de l’encadrement humain.</p>
                </div>
                <div className="rounded-2xl border border-lux-line/60 bg-lux-paper/70 p-4">
                  <p className="text-sm font-semibold text-lux-ink">Accès</p>
                  <p className="mt-1 text-sm text-lux-slate">Disponible selon la formule ou l’add-on retenu.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-lux-line bg-lux-ink text-lux-ivory lux-shadow">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-3">
                <MessageCircle className="h-5 w-5 text-lux-gold-wash" />
                <h2 className="text-2xl font-fraunces text-lux-ivory">Exemple de dialogue</h2>
              </div>
              <div className="mt-6 space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-lux-ivory/90">
                  <p className="mb-1 font-semibold text-lux-gold-wash">Élève</p>
                  Comment résoudre une équation du second degré ?
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-lux-ivory/90">
                  <p className="mb-1 font-semibold text-lux-gold-wash">ARIA</p>
                  On calcule le discriminant Δ = b² - 4ac. Si Δ &gt; 0, il y a deux solutions;
                  si Δ = 0, une solution double; si Δ &lt; 0, pas de solution réelle.
                  Voulez-vous un exemple ?
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="bg-lux-paper px-4 py-14 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <Badge variant="outline" className="mb-4 border-lux-line/70 text-lux-slate">
              <Zap className="mr-2 h-4 w-4 text-lux-gold" />
              Fonctionnalités
            </Badge>
            <h2 className="text-3xl font-fraunces text-lux-ink md:text-4xl">
              Pourquoi ARIA apporte un cadre utile
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-lux-slate md:text-base">
              L’outil reste lisible, sobre et orienté méthode, avec un rôle précis dans le parcours d’accompagnement.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {ARIA_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="border-lux-line bg-lux-ink text-lux-ivory lux-shadow">
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lux-gold/12">
                      <Icon className="h-6 w-6 text-lux-gold" />
                    </div>
                    <h3 className="mt-4 text-xl font-fraunces text-lux-ivory">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-lux-ivory/75">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-lux-paper px-4 py-14 md:px-6">
        <div className="mx-auto max-w-6xl rounded-3xl border border-lux-line bg-lux-white p-6 md:p-8 lux-shadow">
          <div className="text-center">
            <Badge variant="outline" className="mb-4 border-lux-line/70 text-lux-slate">
              <GraduationCap className="mr-2 h-4 w-4 text-lux-gold" />
              10 matières
            </Badge>
            <h2 className="text-3xl font-fraunces text-lux-ink md:text-4xl">
              Toutes les matières du lycée français
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-lux-slate md:text-base">
              Mathématiques, français, NSI, physique-chimie, philosophie, histoire-géographie, SVT, SES, anglais et espagnol.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {ARIA_SUBJECTS.map((subject) => {
              const SubjectIcon = resolveSubjectIcon(subject.value);
              return (
                <div
                  key={subject.name}
                  className="rounded-2xl border border-lux-line/60 bg-lux-paper/70 p-4 text-center transition-transform hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <span className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-lux-white text-lux-gold shadow-sm">
                    <SubjectIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="text-sm font-semibold text-lux-ink">{subject.name}</h3>
                  <p className="mt-1 text-xs leading-5 text-lux-slate">{subject.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-lux-ink px-4 py-14 md:px-6">
        <div className="mx-auto max-w-6xl text-center">
          <Badge className="mb-4 border border-lux-line/40 bg-white/5 text-lux-gold-wash">
            <MessageCircle className="mr-2 h-4 w-4" />
            Comment ça marche
          </Badge>
          <h2 className="text-3xl font-fraunces text-lux-ivory md:text-4xl">Simple comme une conversation</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-lux-ivory/75 md:text-base">
            Pas de configuration compliquée. Choisissez la matière, posez votre question, puis travaillez la réponse avec méthode.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {ARIA_STEPS.map((step) => (
              <div key={step.step} className="rounded-3xl border border-white/10 bg-white/5 p-6 text-left backdrop-blur">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-lux-gold/30 bg-lux-gold/10 text-lg font-semibold text-lux-gold-wash">
                  {step.step}
                </div>
                <h3 className="mt-4 text-xl font-fraunces text-lux-ivory">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-lux-ivory/75">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-lux-paper px-4 py-14 md:px-6">
        <div className="mx-auto max-w-4xl rounded-3xl border border-lux-line bg-lux-white p-6 md:p-8 text-center lux-shadow">
          <h2 className="text-3xl font-fraunces text-lux-ink md:text-4xl">
            Prêt à utiliser <span className="text-lux-gold-deep">ARIA</span> dans un cadre clair ?
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-lux-slate md:text-base">
            ARIA complète l’accompagnement humain, elle ne le remplace pas. Demandez un bilan pour savoir si l’accès doit passer par une formule ou un add-on.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/bilan-gratuit" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
              Demander un bilan
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="/offres" className="lux-cta-secondary rounded-lg px-6 py-3.5 text-sm font-semibold text-lux-ink border-lux-line/40">
              Voir les offres avec ARIA
            </Link>
          </div>
        </div>
      </section>

      <CorporateFooter />
      <AriaChat />
    </main>
  );
}
