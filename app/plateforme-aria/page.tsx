"use client";

import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { AriaChat } from "@/components/ui/aria-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import React from "react";
import {
  BrainCircuit,
  MessageCircle,
  BookOpen,
  Clock,
  Shield,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Zap,
  Target,
  Star,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
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
    title: "Disponible 24h/24, 7j/7",
    description: "ARIA ne dort jamais. Posez votre question à 23h la veille d'un contrôle, elle est là.",
  },
  {
    icon: Target,
    title: "Réponses adaptées à votre niveau",
    description: "Seconde, Première ou Terminale — ARIA adapte ses explications à votre programme exact.",
  },
  {
    icon: BookOpen,
    title: "Basée sur les programmes officiels",
    description: "Entraînée sur les programmes de l'Éducation Nationale française et nos contenus exclusifs.",
  },
  {
    icon: Zap,
    title: "Réponses instantanées",
    description: "Pas d'attente. Posez votre question, obtenez une explication claire en quelques secondes.",
  },
  {
    icon: Shield,
    title: "Pédagogie bienveillante",
    description: "ARIA encourage, ne juge pas. Elle propose des méthodes et des exemples concrets.",
  },
  {
    icon: Star,
    title: "Feedback et amélioration continue",
    description: "Évaluez chaque réponse. ARIA s'améliore grâce à vos retours.",
  },
];

const ARIA_STEPS = [
  {
    step: "1",
    title: "Choisissez votre matière",
    description: "Sélectionnez parmi les 10 matières du lycée français disponibles.",
  },
  {
    step: "2",
    title: "Posez votre question",
    description: "Tapez votre question comme vous la poseriez à un professeur particulier.",
  },
  {
    step: "3",
    title: "Recevez une explication claire",
    description: "ARIA vous répond avec des explications structurées, des exemples et des méthodes.",
  },
  {
    step: "4",
    title: "Approfondissez si besoin",
    description: "Continuez la conversation pour approfondir, demander un exercice ou une autre méthode.",
  },
];

export default function PlateformeAriaPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <CorporateNavbar />
      <main>
        {/* Hero ARIA */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 py-14 md:py-24">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-300 rounded-full blur-3xl" />
          </div>

          <div className="relative container mx-auto max-w-6xl px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Badge className="bg-white/10 text-white border-white/20 mb-6">
                <BrainCircuit className="w-4 h-4 mr-2" />
                Intelligence Artificielle Pédagogique
              </Badge>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-heading text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight"
            >
              Rencontrez <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-slate-200">ARIA</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-xl md:text-2xl text-blue-100 max-w-3xl mx-auto mb-8 leading-relaxed"
            >
              Votre assistante IA pédagogique personnelle, disponible <strong className="text-white">24h/24</strong> pour
              vous aider dans <strong className="text-white">10 matières du lycée</strong>. Comme un professeur particulier
              qui ne dort jamais.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
            >
              <Button asChild size="lg" className="h-14 px-8 text-lg bg-white text-slate-900 hover:bg-slate-100 font-semibold group">
                <Link href="/bilan-gratuit">
                  Essayer ARIA gratuitement
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-14 px-8 text-lg border-white/40 text-white hover:bg-white/15">
                <Link href="/offres">
                  Voir les offres ARIA
                </Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-wrap justify-center gap-4 sm:gap-8 text-white/90 text-sm"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>Démonstration gratuite</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>Sans engagement</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span>Programmes officiels</span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Qu'est-ce qu'ARIA */}
        <section className="py-14 md:py-20 bg-white">
          <div className="container mx-auto max-w-6xl px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <Badge variant="outline" className="mb-4 text-blue-700 border-blue-200 bg-blue-50">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Qu'est-ce qu'ARIA ?
                </Badge>
                <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                  Votre professeur particulier <span className="text-blue-600">propulsé par l'IA</span>
                </h2>
                <p className="text-lg text-slate-700 mb-6 leading-relaxed">
                  ARIA (<strong>A</strong>ssistant de <strong>R</strong>évision <strong>I</strong>ntelligent et <strong>A</strong>daptatif) est l'intelligence artificielle
                  pédagogique développée par Nexus Réussite. Elle est entraînée spécifiquement sur les programmes
                  du lycée français et nos contenus pédagogiques exclusifs.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-slate-700">Répond à vos questions dans <strong>10 matières</strong> du lycée</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-slate-700">Explications <strong>adaptées à votre niveau</strong> (2nde, 1ère, Tle)</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-slate-700">Basée sur les <strong>programmes officiels</strong> de l'Éducation Nationale</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-slate-700">Enrichie par notre <strong>base de connaissances RAG</strong> exclusive</p>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-8 border border-blue-100">
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-slate-600 rounded-full flex items-center justify-center">
                        <BrainCircuit className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">ARIA</p>
                        <p className="text-xs text-slate-600">Assistant IA Pédagogique 24/7</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-blue-50 rounded-lg p-3 text-sm text-slate-700">
                        <p className="font-medium text-blue-800 mb-1">Élève :</p>
                        Comment résoudre une équation du second degré ?
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700">
                        <p className="font-medium text-slate-800 mb-1">ARIA :</p>
                        Pour résoudre ax² + bx + c = 0, on calcule le discriminant Δ = b² - 4ac.
                        <br />• Si Δ &gt; 0 : deux solutions x₁ = (-b-√Δ)/2a et x₂ = (-b+√Δ)/2a
                        <br />• Si Δ = 0 : une solution double x = -b/2a
                        <br />· Si Δ &lt; 0 : pas de solution réelle
                        <br /><br />Voulez-vous un exemple concret ?
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Fonctionnalités ARIA */}
        <section className="py-14 md:py-20 bg-slate-50">
          <div className="container mx-auto max-w-6xl px-4">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4 text-blue-700 border-blue-200 bg-blue-50">
                <Zap className="w-4 h-4 mr-2" />
                Fonctionnalités
              </Badge>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Pourquoi ARIA est <span className="text-blue-600">différente</span>
              </h2>
              <p className="text-lg text-slate-700 max-w-2xl mx-auto">
                ARIA n'est pas un chatbot générique. C'est une IA spécialisée dans l'accompagnement scolaire du lycée français.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {ARIA_FEATURES.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="font-heading text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                    <p className="text-slate-700 text-sm leading-relaxed">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Matières couvertes */}
        <section className="py-14 md:py-20 bg-white">
          <div className="container mx-auto max-w-6xl px-4">
            <div className="text-center mb-16">
              <Badge variant="outline" className="mb-4 text-blue-700 border-blue-200 bg-blue-50">
                <GraduationCap className="w-4 h-4 mr-2" />
                10 Matières
              </Badge>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Toutes les matières du <span className="text-blue-600">lycée français</span>
              </h2>
              <p className="text-lg text-slate-700 max-w-2xl mx-auto">
                ARIA couvre l'ensemble des matières du tronc commun et des spécialités les plus demandées.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {ARIA_SUBJECTS.map((subject) => (
                (() => {
                  const SubjectIcon = resolveSubjectIcon(subject.value);
                  return (
                    <div
                      key={subject.name}
                      className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-4 border border-blue-100 text-center hover:shadow-md transition-shadow"
                    >
                      <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                        <SubjectIcon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <h3 className="font-semibold text-slate-900 text-sm mb-1">{subject.name}</h3>
                      <p className="text-xs text-slate-700 leading-relaxed">{subject.desc}</p>
                    </div>
                  );
                })()
              ))}
            </div>
          </div>
        </section>

        {/* Comment ça marche */}
        <section className="py-14 md:py-20 bg-gradient-to-br from-blue-900 to-slate-800 text-white">
          <div className="container mx-auto max-w-6xl px-4">
            <div className="text-center mb-16">
              <Badge className="bg-white/10 text-white border-white/20 mb-4">
                <MessageCircle className="w-4 h-4 mr-2" />
                Comment ça marche
              </Badge>
              <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
                Simple comme une conversation
              </h2>
              <p className="text-lg text-slate-200 max-w-2xl mx-auto">
                Pas de configuration compliquée. Ouvrez le chat, choisissez votre matière, posez votre question.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {ARIA_STEPS.map((step) => (
                <div
                  key={step.step}
                  className="text-center"
                >
                  <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-blue-300">{step.step}</span>
                  </div>
                  <h3 className="font-heading text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-slate-200 text-sm leading-relaxed">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="py-14 md:py-20 bg-white">
          <div className="container mx-auto max-w-4xl px-4 text-center">
            <div>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 mb-6">
                Prêt à rencontrer votre <span className="text-blue-600">assistant IA</span> ?
              </h2>
              <p className="text-lg text-slate-700 mb-8 max-w-2xl mx-auto">
                Essayez ARIA gratuitement dès maintenant. Cliquez sur la bulle en bas à droite
                pour démarrer une conversation de démonstration.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="h-14 px-8 text-lg bg-brand-primary hover:bg-brand-primary-dark font-semibold group">
                  <Link href="/bilan-gratuit">
                    Commencer mon Bilan Gratuit
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="h-14 px-8 text-lg">
                  <Link href="/offres">
                    Voir les offres avec ARIA
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <CorporateFooter />
      <AriaChat />
    </div>
  );
}
