"use client";

import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";
import { AriaChat } from "@/components/ui/aria-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
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

const ARIA_SUBJECTS = [
  { name: "Mathématiques", icon: "📐", desc: "Analyse, algèbre, probabilités, géométrie" },
  { name: "NSI", icon: "💻", desc: "Algorithmique, structures de données, Python, SQL" },
  { name: "Physique-Chimie", icon: "⚗️", desc: "Mécanique, thermodynamique, chimie organique" },
  { name: "Français", icon: "📖", desc: "Commentaire, dissertation, oral du bac" },
  { name: "Philosophie", icon: "🤔", desc: "Dissertation, explication de texte" },
  { name: "Histoire-Géo", icon: "🌍", desc: "Composition, étude de documents" },
  { name: "SVT", icon: "🧬", desc: "Génétique, écologie, géologie" },
  { name: "SES", icon: "📊", desc: "Économie, sociologie, science politique" },
  { name: "Anglais", icon: "🇬🇧", desc: "Compréhension, expression, méthodologie" },
  { name: "Espagnol", icon: "🇪🇸", desc: "Compréhension, expression, civilisation" },
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
    <div className="min-h-screen bg-white">
      <CorporateNavbar />
      <main>
        {/* Hero ARIA */}
        <section className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 py-20 md:py-32">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-400 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-400 rounded-full blur-3xl" />
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
              Rencontrez <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-300">ARIA</span>
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
              <Button asChild size="lg" className="h-14 px-8 text-lg bg-white text-blue-900 hover:bg-blue-50 font-semibold group">
                <Link href="/bilan-gratuit">
                  Essayer ARIA gratuitement
                  <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-14 px-8 text-lg border-white/30 text-white hover:bg-white/10">
                <Link href="/offres">
                  Voir les offres ARIA
                </Link>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex justify-center gap-8 text-white/80 text-sm"
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
        <section className="py-20 bg-white">
          <div className="container mx-auto max-w-6xl px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <Badge variant="outline" className="mb-4 text-blue-600 border-blue-200">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Qu'est-ce qu'ARIA ?
                </Badge>
                <h2 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                  Votre professeur particulier <span className="text-blue-600">propulsé par l'IA</span>
                </h2>
                <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                  ARIA (<strong>A</strong>ssistant de <strong>R</strong>évision <strong>I</strong>ntelligent et <strong>A</strong>daptatif) est l'intelligence artificielle
                  pédagogique développée par Nexus Réussite. Elle est entraînée spécifiquement sur les programmes
                  du lycée français et nos contenus pédagogiques exclusifs.
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700">Répond à vos questions dans <strong>10 matières</strong> du lycée</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700">Explications <strong>adaptées à votre niveau</strong> (2nde, 1ère, Tle)</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700">Basée sur les <strong>programmes officiels</strong> de l'Éducation Nationale</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-gray-700">Enrichie par notre <strong>base de connaissances RAG</strong> exclusive</p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-8 border border-blue-100">
                  <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                        <BrainCircuit className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">ARIA</p>
                        <p className="text-xs text-gray-500">Assistant IA Pédagogique 24/7</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-blue-50 rounded-lg p-3 text-sm text-gray-700">
                        <p className="font-medium text-blue-800 mb-1">Élève :</p>
                        Comment résoudre une équation du second degré ?
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                        <p className="font-medium text-purple-800 mb-1">ARIA :</p>
                        Pour résoudre ax² + bx + c = 0, on calcule le discriminant Δ = b² - 4ac.
                        <br />• Si Δ &gt; 0 : deux solutions x₁ = (-b-√Δ)/2a et x₂ = (-b+√Δ)/2a
                        <br />• Si Δ = 0 : une solution double x = -b/2a
                        <br />• Si Δ &lt; 0 : pas de solution réelle
                        <br /><br />Voulez-vous un exemple concret ? 😊
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Fonctionnalités ARIA */}
        <section className="py-20 bg-slate-50">
          <div className="container mx-auto max-w-6xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4 text-blue-600 border-blue-200">
                <Zap className="w-4 h-4 mr-2" />
                Fonctionnalités
              </Badge>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Pourquoi ARIA est <span className="text-blue-600">différente</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                ARIA n'est pas un chatbot générique. C'est une IA spécialisée dans l'accompagnement scolaire du lycée français.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {ARIA_FEATURES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="font-heading text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                    <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Matières couvertes */}
        <section className="py-20 bg-white">
          <div className="container mx-auto max-w-6xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4 text-blue-600 border-blue-200">
                <GraduationCap className="w-4 h-4 mr-2" />
                10 Matières
              </Badge>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                Toutes les matières du <span className="text-blue-600">lycée français</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                ARIA couvre l'ensemble des matières du tronc commun et des spécialités les plus demandées.
              </p>
            </motion.div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {ARIA_SUBJECTS.map((subject, index) => (
                <motion.div
                  key={subject.name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  viewport={{ once: true }}
                  className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100 text-center hover:shadow-md transition-shadow"
                >
                  <span className="text-3xl mb-2 block">{subject.icon}</span>
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{subject.name}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{subject.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Comment ça marche */}
        <section className="py-20 bg-gradient-to-br from-blue-900 to-indigo-900 text-white">
          <div className="container mx-auto max-w-6xl px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <Badge className="bg-white/10 text-white border-white/20 mb-4">
                <MessageCircle className="w-4 h-4 mr-2" />
                Comment ça marche
              </Badge>
              <h2 className="font-heading text-3xl md:text-4xl font-bold mb-4">
                Simple comme une conversation
              </h2>
              <p className="text-lg text-blue-200 max-w-2xl mx-auto">
                Pas de configuration compliquée. Ouvrez le chat, choisissez votre matière, posez votre question.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {ARIA_STEPS.map((step, index) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.15 }}
                  viewport={{ once: true }}
                  className="text-center"
                >
                  <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-blue-300">{step.step}</span>
                  </div>
                  <h3 className="font-heading text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-blue-200 text-sm leading-relaxed">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Final */}
        <section className="py-20 bg-white">
          <div className="container mx-auto max-w-4xl px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Prêt à rencontrer votre <span className="text-blue-600">assistant IA</span> ?
              </h2>
              <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                Essayez ARIA gratuitement dès maintenant. Cliquez sur la bulle en bas à droite
                pour démarrer une conversation de démonstration.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" className="h-14 px-8 text-lg bg-blue-600 hover:bg-blue-700 font-semibold group">
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
            </motion.div>
          </div>
        </section>
      </main>
      <CorporateFooter />
      <AriaChat />
    </div>
  );
}
