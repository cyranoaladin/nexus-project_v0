'use client';

import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { AriaComparison } from '@/components/ui/aria-comparison';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditsSystem } from '@/components/ui/credits-system';
import { DiagnosticForm } from '@/components/ui/diagnostic-form';
import { ExpertsShowcase } from '@/components/ui/experts-showcase';
import { FAQSection } from '@/components/ui/faq-section';
import { FloatingNav } from '@/components/ui/floating-nav';
import { GuaranteeSection } from '@/components/ui/guarantee-section';
import { OffersComparison } from '@/components/ui/offers-comparison';
import { SpecializedPacks } from '@/components/ui/specialized-packs';
import { motion, useScroll, useTransform } from 'framer-motion';
import {
  ArrowRight, Award,
  BookMarked,
  BookOpen,
  Brain,
  BrainCircuit,
  Check,
  ChevronDown,
  Crown,
  FileText,
  Globe,
  GraduationCap,
  Rocket,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';

// Configuration des Univers selon la directive stratégique du CEO
const UNIVERS_CORTEX = {
  title: "Univers 1 : Nexus Cortex",
  subtitle: "L'IA Entraînée pour le Bac Français",
  description: "L'IA n'est plus un gadget, elle devient un outil de préparation ciblé pour optimiser chaque point de votre parcours.",
  offers: [
    {
      name: "ARIA Essentiel",
      subtitle: "Aide 24/7 sur les spécialités",
      price: "Inclus",
      period: "dans nos programmes",
      description: "Accès à l'aide 24/7 sur les spécialités (Maths, PC, NSI) avec une base de données d'exercices corrigés.",
      features: [
        "Aide 24/7 sur les spécialités (Maths, PC, NSI)",
        "Base de données d'exercices corrigés",
        "Accès inclus dans nos programmes annuels",
        "Support technique dédié"
      ],
      cta: "Découvrir nos Programmes",
      popular: false,
      icon: Brain,
      color: "from-blue-600 to-cyan-500"
    },
    {
      name: "ARIA+ Premium",
      subtitle: "Solution complète avec tronc commun",
      price: 90,
      period: "TND/mois",
      description: "Toutes les fonctionnalités Essentiel + modules Tronc Commun et outils avancés de préparation.",
      features: [
        "Toutes les fonctionnalités Essentiel",
        "Modules Tronc Commun : Philo, Enseignement Scientifique",
        "Simulateur de Contrôle Continu",
        "Module Évaluations Ponctuelles",
        "Correcteur de Méthodologie Français/Philo"
      ],
      cta: "Commencer l'Essai Gratuit",
      popular: true,
      icon: BrainCircuit,
      color: "from-purple-600 to-pink-500"
    }
  ]
};

const UNIVERS_ACADEMIES = {
  title: "Univers 2 : Les Académies Nexus",
  subtitle: "Les Sprints de Performance",
  description: "Nos stages intensifs deviennent des rendez-vous thématiques incontournables du calendrier scolaire.",
  academies: [
    {
      name: "Académie de la Toussaint",
      subtitle: "Objectif Méthodologie",
      target: "Première/Terminale",
      description: "15h pour maîtriser les méthodes de dissertation, commentaire, et résolution de problèmes complexes.",
      price: 750,
      duration: "Vacances de la Toussaint",
      features: [
        "Méthodes de dissertation et commentaire",
        "Résolution de problèmes complexes",
        "Techniques d'analyse et de synthèse",
        "Simulations d'épreuves"
      ],
      icon: BookOpen,
      color: "from-green-600 to-emerald-500"
    },
    {
      name: "Académie de Noël",
      subtitle: "Spécial Bac Blanc",
      target: "Première/Terminale",
      description: "20h d'entraînement intensif en conditions d'examen pour préparer les épreuves blanches de janvier.",
      price: 850,
      duration: "Vacances de Noël",
      features: [
        "Entraînement en conditions d'examen",
        "Préparation aux épreuves blanches",
        "Correction personnalisée",
        "Stratégies de gestion du temps"
      ],
      icon: Target,
      color: "from-orange-600 to-red-500"
    },
    {
      name: "Académie de Février",
      subtitle: "Booster de Spécialité",
      target: "Terminale",
      description: "15h d'approfondissement dans une spécialité au choix (incluant des ateliers Maths Expertes).",
      price: 900,
      duration: "Vacances de Février",
      features: [
        "Approfondissement spécialité choisie",
        "Ateliers Maths Expertes",
        "Techniques avancées",
        "Préparation aux épreuves finales"
      ],
      icon: TrendingUp,
      color: "from-blue-600 to-indigo-500"
    },
    {
      name: "Académie de Pâques",
      subtitle: "Sprint Final",
      target: "Terminale",
      description: "25h de révisions intensives et d'annales pour être prêt pour les épreuves finales.",
      price: 1200,
      duration: "Vacances de Pâques",
      features: [
        "Révisions intensives complètes",
        "Annales et corrigés",
        "Simulations d'épreuves finales",
        "Coaching de dernière ligne droite"
      ],
      icon: Rocket,
      color: "from-purple-600 to-pink-500"
    },
    {
      name: "Académie du Français",
      subtitle: "Objectif EAF",
      target: "Première",
      description: "Stage dédié à la réussite des Épreuves Anticipées de Français (écrit et oral).",
      price: 1200,
      duration: "Sessions en juin",
      features: [
        "Préparation écrit et oral",
        "Méthodes de commentaire et dissertation",
        "Simulations d'oral",
        "Techniques de présentation"
      ],
      icon: FileText,
      color: "from-yellow-600 to-orange-500"
    },
    {
      name: "Académie d'Été",
      subtitle: "Le Pont vers l'Excellence",
      target: "Futurs Première/Terminale",
      description: "Dès le 16 août. 20h pour consolider les acquis et anticiper le programme de l'année à venir.",
      price: 850,
      duration: "Été 2025",
      features: [
        "Consolidation des acquis",
        "Anticipation du programme",
        "Méthodes de travail",
        "Préparation à la transition"
      ],
      icon: GraduationCap,
      color: "from-teal-600 to-cyan-500"
    }
  ]
};

const UNIVERS_ODYSSEE = {
  title: "Univers 3 : Le Programme Odyssée",
  subtitle: "L'Accompagnement Annuel d'Excellence",
  description: "C'est ici que notre stratégie de personnalisation prend tout son sens. Nous ne vendons plus un pack, nous vendons un parcours de réussite nommé et ciblé.",
  programmes: [
    {
      name: "Odyssée Première",
      subtitle: "Le Parcours Anticipé",
      target: "Élève de Première scolarisé",
      description: "Visant une transition réussie vers la Terminale avec optimisation du contrôle continu.",
      price: 6500,
      period: "TND/an",
      features: [
        "Suivi continu dans les 3 spécialités",
        "Préparation spécifique à l'EAF (Français)",
        "Coaching d'orientation",
        "ARIA Essentiel inclus",
        "Budget de crédits Flex",
        "Suivi par un coach référent"
      ],
      cta: "Démarrer l'Odyssée",
      popular: false,
      icon: BookMarked,
      color: "from-green-600 to-emerald-500"
    },
    {
      name: "Odyssée Terminale",
      subtitle: "La Stratégie Mention",
      target: "Élève de Terminale scolarisé",
      description: "Visant une mention et un excellent dossier Parcoursup avec maîtrise des spécialités.",
      price: 8000,
      period: "TND/an",
      features: [
        "Maîtrise des 2 spécialités (6h/semaine)",
        "Préparation complète au Grand Oral",
        "Préparation à la Philosophie",
        "Stratégie Parcoursup intégrée",
        "ARIA Essentiel inclus",
        "Suivi hebdomadaire"
      ],
      cta: "Démarrer l'Odyssée",
      popular: true,
      icon: Trophy,
      color: "from-amber-600 to-yellow-500"
    },
    {
      name: "Odyssée Individuel",
      subtitle: "La Préparation Intégrale",
      target: "CANDIDAT LIBRE",
      description: "L'offre qui remplace le lycée. Un programme complet sur mesure couvrant tout le cursus.",
      price: "Sur Devis",
      period: "Personnalisé",
      features: [
        "Programme complet sur mesure",
        "Couvre 2 spécialités ET tronc commun",
        "Préparation évaluations ponctuelles",
        "Aide démarches administratives",
        "Notre Sceau de Garantie",
        "Accompagnement total"
      ],
      cta: "Demander un Devis",
      popular: false,
      icon: Award,
      color: "from-red-600 to-pink-500"
    }
  ]
};

// Composant de navigation fluide
const SmoothScrollLink = ({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string; }) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
};

export default function OffresPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <Header />

      <main>
        {/* Hero Section - Narrative Stratégique "Pilotez Votre Réussite" */}
        <section className="relative py-20 bg-[#F6F9FC] overflow-hidden">
          {/* Background animated elements */}
          <motion.div
            className="absolute inset-0 opacity-10"
            style={{ y }}
          >
            <div className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full blur-xl"></div>
            <div className="absolute top-40 right-20 w-32 h-32 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-xl"></div>
            <div className="absolute bottom-20 left-1/4 w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full blur-xl"></div>
          </motion.div>

          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              className="text-center max-w-5xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              {/* Titre Principal avec effet de brillance */}
              <motion.h1
                className="font-bold text-[clamp(2.5rem,5vw,3rem)] text-[#0A2540] mb-4 relative"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <span className="relative">
                  Pilotez Votre Réussite
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-or-stellaire to-transparent opacity-20"
                    initial={{ x: "-100%" }}
                    animate={{ x: "100%" }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  />
                </span>
              </motion.h1>

              {/* Slogan */}
              <motion.h2
                className="font-medium text-[clamp(1.25rem,3vw,1.5rem)] text-[#334155] mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
              >
                La Stratégie, l'Expertise, la Mention.
              </motion.h2>

              {/* Ligne de séparation animée */}
              <motion.hr
                className="w-20 h-0.5 bg-[#FFD700] mx-auto my-6"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
              />

              {/* Paragraphe de Narrative */}
              <motion.p
                className="font-normal text-[clamp(1rem,2.5vw,1.125rem)] text-[#334155] leading-[1.7] max-w-[80ch] mx-auto"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.8 }}
              >
                Le Baccalauréat n'est plus un simple examen, c'est un projet stratégique qui dessine un avenir. Chez Nexus Réussite, nous ne laissons aucune place au hasard. Nous transformons le stress de l'inconnu en une feuille de route claire et maîtrisée. En combinant l'expertise de nos professeurs agrégés à la puissance de notre IA prédictive, nous construisons pour chaque élève un parcours sur-mesure où chaque étape — du choix des spécialités jusqu'au Grand Oral — est optimisée pour un seul objectif : faire de son potentiel une mention qui lui ouvrira les portes de l'avenir qu'il a choisi.
              </motion.p>

              {/* Navigation rapide */}
              <motion.div
                className="flex flex-wrap justify-center gap-4 mt-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1 }}
              >
                <SmoothScrollLink href="#cortex">
                  <Button variant="outline" className="border-or-stellaire text-bleu-nuit hover:bg-or-stellaire hover:text-bleu-nuit">
                    <Brain className="w-4 h-4 mr-2" />
                    Nexus Cortex
                  </Button>
                </SmoothScrollLink>
                <SmoothScrollLink href="#academies">
                  <Button variant="outline" className="border-or-stellaire text-bleu-nuit hover:bg-or-stellaire hover:text-bleu-nuit">
                    <Rocket className="w-4 h-4 mr-2" />
                    Académies
                  </Button>
                </SmoothScrollLink>
                <SmoothScrollLink href="#odyssee">
                  <Button variant="outline" className="border-or-stellaire text-bleu-nuit hover:bg-or-stellaire hover:text-bleu-nuit">
                    <Crown className="w-4 h-4 mr-2" />
                    Programme Odyssée
                  </Button>
                </SmoothScrollLink>
              </motion.div>

              {/* Indicateur de scroll */}
              <motion.div
                className="mt-16 flex justify-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 1.2 }}
              >
                <motion.div
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="flex flex-col items-center text-gris-noble"
                >
                  <ChevronDown className="w-6 h-6 mb-2" />
                  <span className="text-sm">Découvrez nos offres</span>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Introduction */}
        <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
          <div className="container mx-auto px-4">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Badge variant="outline" className="mb-4 bg-or-stellaire text-bleu-nuit border-or-stellaire">
                <Target className="w-4 h-4 mr-2" />
                Excellence Sur-Mesure
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold text-bleu-nuit mb-6">
                L'Excellence Sur-Mesure
              </h1>
              <p className="text-xl text-gris-noble max-w-4xl mx-auto leading-relaxed">
                Découvrez nos offres adaptées à chaque profil d'élève. De l'accompagnement
                personnalisé à la préparation intensive, nous vous proposons des solutions
                sur mesure pour atteindre l'excellence académique.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Système de Crédits */}
        <CreditsSystem />

        {/* Analyse Stratégique Différentielle */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Badge variant="outline" className="mb-4 bg-blue-50 text-blue-700 border-blue-200">
                <Target className="w-4 h-4 mr-2" />
                Analyse Stratégique Différentielle
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-6">
                Deux Réalités, Deux Réponses Sur-Mesure
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {/* Élève Scolarisé */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <Card className="h-full border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 hover:shadow-strong transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-bleu-nuit">
                          L'Élève Scolarisé (Lycée français)
                        </CardTitle>
                        <p className="text-gris-noble">Son besoin : L'OPTIMISATION</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gris-noble">Il a un cadre, des professeurs, et un contrôle continu (40%)</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gris-noble">Il doit exceller dans ses spécialités à fort coefficient</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gris-noble">Préparer les épreuves terminales (60%) et se démarquer sur Parcoursup</span>
                      </div>
                      <div className="mt-6 p-4 bg-white rounded-lg border border-green-200">
                        <p className="text-sm font-semibold text-green-700">
                          Notre Promesse : "Transformez votre potentiel en excellence. Chaque note compte, nous vous aidons à maximiser chacune d'entre elles."
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Candidat Libre */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <Card className="h-full border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 hover:shadow-strong transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center">
                        <Globe className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-bleu-nuit">
                          Le Candidat Libre
                        </CardTitle>
                        <p className="text-gris-noble">Son besoin : La SUBSTITUTION</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gris-noble">Il est seul, pas de contrôle continu, pas de bulletins</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gris-noble">Évaluations ponctuelles couperet sur tout le programme</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gris-noble">Rattaché à Aix-Marseille, navigation administrative complexe</span>
                      </div>
                      <div className="mt-6 p-4 bg-white rounded-lg border border-blue-200">
                        <p className="text-sm font-semibold text-blue-700">
                          Notre Promesse : "Vous n'êtes plus seul. Nous sommes votre établissement, votre programme et votre coach. Ensemble, nous allons chercher votre Bac."
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Univers 1: Nexus Cortex */}
        <section id="cortex" className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
          <div className="container mx-auto px-4">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Badge variant="outline" className="mb-4 bg-blue-50 text-blue-700 border-blue-200">
                <Brain className="w-4 h-4 mr-2" />
                {UNIVERS_CORTEX.title}
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-4">
                {UNIVERS_CORTEX.subtitle}
              </h2>
              <p className="text-lg text-gris-noble max-w-3xl mx-auto">
                {UNIVERS_CORTEX.description}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {UNIVERS_CORTEX.offers.map((offer, index) => (
                <motion.div
                  key={offer.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -5 }}
                >
                  <Card className={`relative overflow-hidden border-0 shadow-strong h-full transition-all duration-300 hover:scale-105 ${offer.popular ? 'ring-2 ring-or-stellaire' : ''}`}>
                    {offer.popular && (
                      <motion.div
                        className="absolute top-4 right-4"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        <Badge className="bg-or-stellaire text-bleu-nuit font-bold">
                          <Star className="w-4 h-4 mr-1" />
                          Plus Populaire
                        </Badge>
                      </motion.div>
                    )}
                    <div className={`absolute inset-0 bg-gradient-to-r ${offer.color} opacity-5`}></div>
                    <CardHeader className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${offer.color} flex items-center justify-center`}>
                          <offer.icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-2xl font-bold text-bleu-nuit">
                            {offer.name}
                          </CardTitle>
                          <p className="text-gris-noble">{offer.subtitle}</p>
                        </div>
                      </div>
                      <p className="text-lg text-gris-noble">
                        {offer.description}
                      </p>
                    </CardHeader>
                    <CardContent className="relative">
                      <div className="mb-6">
                        <div className="text-3xl font-black text-bleu-nuit">
                          {offer.price} {offer.period}
                        </div>
                      </div>

                      <div className="space-y-3 mb-8">
                        {offer.features.map((feature, idx) => (
                          <motion.div
                            key={idx}
                            className="flex items-start gap-3"
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            viewport={{ once: true }}
                          >
                            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <span className="text-gris-noble">{feature}</span>
                          </motion.div>
                        ))}
                      </div>

                      <Button className="w-full bg-or-stellaire hover:bg-or-stellaire-dark text-bleu-nuit font-bold transition-all duration-200 hover:scale-105">
                        {offer.cta}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Univers 2: Académies Nexus */}
        <section id="academies" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Badge variant="outline" className="mb-4 bg-green-50 text-green-700 border-green-200">
                <Rocket className="w-4 h-4 mr-2" />
                {UNIVERS_ACADEMIES.title}
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-4">
                {UNIVERS_ACADEMIES.subtitle}
              </h2>
              <p className="text-lg text-gris-noble max-w-3xl mx-auto">
                {UNIVERS_ACADEMIES.description}
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {UNIVERS_ACADEMIES.academies.map((academy, index) => (
                <motion.div
                  key={academy.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -5 }}
                >
                  <Card className="relative overflow-hidden border-0 shadow-strong h-full transition-all duration-300 hover:scale-105">
                    <div className={`absolute inset-0 bg-gradient-to-r ${academy.color} opacity-5`}></div>
                    <CardHeader className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${academy.color} flex items-center justify-center`}>
                          <academy.icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold text-bleu-nuit">
                            {academy.name}
                          </CardTitle>
                          <p className="text-sm text-gris-noble">{academy.subtitle}</p>
                        </div>
                      </div>
                      <div className="mb-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {academy.target}
                        </Badge>
                      </div>
                      <p className="text-gris-noble text-sm">
                        {academy.description}
                      </p>
                    </CardHeader>
                    <CardContent className="relative">
                      <div className="mb-4">
                        <div className="text-2xl font-black text-bleu-nuit">
                          {academy.price} TND
                        </div>
                        <div className="text-sm text-gris-noble">{academy.duration}</div>
                      </div>

                      <div className="space-y-2 mb-6">
                        {academy.features.map((feature, idx) => (
                          <motion.div
                            key={idx}
                            className="flex items-start gap-2"
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            viewport={{ once: true }}
                          >
                            <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-gris-noble">{feature}</span>
                          </motion.div>
                        ))}
                      </div>

                      <Button className="w-full bg-or-stellaire hover:bg-or-stellaire-dark text-bleu-nuit font-bold transition-all duration-200 hover:scale-105">
                        Réserver ma Place
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Univers 3: Programme Odyssée */}
        <section id="odyssee" className="py-20 bg-gradient-to-br from-amber-50 to-orange-50">
          <div className="container mx-auto px-4">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <Badge variant="outline" className="mb-4 bg-amber-50 text-amber-700 border-amber-200">
                <Crown className="w-4 h-4 mr-2" />
                {UNIVERS_ODYSSEE.title}
              </Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-4">
                {UNIVERS_ODYSSEE.subtitle}
              </h2>
              <p className="text-lg text-gris-noble max-w-3xl mx-auto">
                {UNIVERS_ODYSSEE.description}
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {UNIVERS_ODYSSEE.programmes.map((programme, index) => (
                <motion.div
                  key={programme.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ y: -5 }}
                >
                  <Card className={`relative overflow-hidden border-0 shadow-strong h-full transition-all duration-300 hover:scale-105 ${programme.popular ? 'ring-2 ring-or-stellaire' : ''}`}>
                    {programme.popular && (
                      <motion.div
                        className="absolute top-4 right-4"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.5 }}
                      >
                        <Badge className="bg-or-stellaire text-bleu-nuit font-bold">
                          <Star className="w-4 h-4 mr-1" />
                          Plus Populaire
                        </Badge>
                      </motion.div>
                    )}
                    <div className={`absolute inset-0 bg-gradient-to-r ${programme.color} opacity-5`}></div>
                    <CardHeader className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${programme.color} flex items-center justify-center`}>
                          <programme.icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-bleu-nuit">
                            {programme.name}
                          </CardTitle>
                          <p className="text-gris-noble text-sm">{programme.subtitle}</p>
                        </div>
                      </div>
                      <div className="mb-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          {programme.target}
                        </Badge>
                      </div>
                      <p className="text-gris-noble text-sm">
                        {programme.description}
                      </p>
                    </CardHeader>
                    <CardContent className="relative">
                      <div className="mb-6">
                        <div className="text-2xl font-black text-bleu-nuit">
                          {programme.price} {programme.period}
                        </div>
                      </div>

                      <div className="space-y-3 mb-8">
                        {programme.features.map((feature, idx) => (
                          <motion.div
                            key={idx}
                            className="flex items-start gap-3"
                            initial={{ opacity: 0, x: -10 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            viewport={{ once: true }}
                          >
                            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-gris-noble">{feature}</span>
                          </motion.div>
                        ))}
                      </div>

                      <Button className="w-full bg-or-stellaire hover:bg-or-stellaire-dark text-bleu-nuit font-bold transition-all duration-200 hover:scale-105">
                        {programme.cta}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparaison des Offres */}
        <OffersComparison />

        {/* Packs Spécialisés */}
        <SpecializedPacks />

        {/* Comparaison ARIA */}
        <AriaComparison />

        {/* Nos Experts */}
        <ExpertsShowcase />

        {/* Garanties */}
        <GuaranteeSection />

        {/* FAQ */}
        <FAQSection />

        {/* Constructeur de Parcours */}
        <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
          <div className="container mx-auto px-4">
            <DiagnosticForm />
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-gradient-to-r from-bleu-nuit to-bleu-nuit-light text-white">
          <div className="container mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-6">
                Prêt à Libérer Votre Potentiel ?
              </h2>
              <p className="text-xl text-white/90 max-w-2xl mx-auto mb-8">
                Rejoignez l'élite éducative et donnez à votre enfant l'avantage concurrentiel qu'il mérite.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/bilan-gratuit">
                  <Button size="lg" className="bg-or-stellaire hover:bg-or-stellaire-dark text-bleu-nuit font-bold transition-all duration-200 hover:scale-105">
                    Consultation Gratuite
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-bleu-nuit transition-all duration-200 hover:scale-105">
                    Nous Contacter
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
      <FloatingNav />
    </div>
  );
}
