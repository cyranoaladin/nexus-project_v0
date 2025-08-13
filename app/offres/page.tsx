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
  ArrowRight,
  Award,
  Brain,
  BrainCircuit,
  Check,
  Crown,
  Globe,
  Rocket,
  Shield,
  Star,
  Target,
  Trophy,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import { formatPrice } from '../../lib/utils';

const ANNUAL_PACK = {
  badge: 'Best value',
  name: 'Pack Annuel Candidat Libre',
  description: "Accompagnement annuel complet: cours, coaching, IA, évaluations, suivi parents.",
  originalPrice: 2500,
  price: 1990,
  features: [
    'Suivi pédagogique personnalisé',
    'Accès ARIA illimité (Maths, PC, NSI)',
    'Préparation tronc commun (Philo, ES)',
    'Simulations d’épreuves et méthodologie',
    'Espace parent et reporting mensuel'
  ],
} as const;

const UNIVERS_CORTEX = {
  title: "Univers 1 : Nexus Cortex",
  subtitle: "L'IA Entraînée pour le Bac Français",
  description: "L'IA n'est plus un gadget, elle devient un outil de préparation ciblé.",
  offers: [
    {
      name: 'ARIA Essentiel',
      subtitle: 'Aide 24/7 sur les spécialités',
      price: 'Inclus',
      period: 'dans nos programmes',
      description: "Aide 24/7 (Maths, PC, NSI) avec base d'exercices corrigés.",
      features: [
        'Aide 24/7 sur les spécialités',
        'Base de données d\'exercices corrigés',
        'Inclus dans nos programmes annuels',
        'Support technique dédié',
      ],
      cta: 'Découvrir nos Programmes',
      popular: false,
      icon: Brain,
      color: 'from-blue-600 to-cyan-500',
    },
    {
      name: 'ARIA+ Premium',
      subtitle: 'Solution complète avec tronc commun',
      price: 90,
      period: 'TND/mois',
      description: 'Toutes les fonctionnalités Essentiel + tronc commun.',
      features: [
        'Modules Tronc Commun : Philo, ES',
        'Simulateur de Contrôle Continu',
        'Évaluations Ponctuelles',
      ],
      cta: "Commencer l'Essai Gratuit",
      popular: true,
      icon: BrainCircuit,
      color: 'from-purple-600 to-pink-500',
    },
  ],
} as const;

const UNIVERS_ACADEMIES = {
  title: 'Univers 2 : Les Académies Nexus',
  subtitle: 'Les Sprints de Performance',
  description: 'Stages intensifs thématiques sur l\'année.',
  academies: [
    {
      name: 'Académie de la Toussaint',
      subtitle: 'Objectif Méthodologie',
      target: 'Première/Terminale',
      description: '15h pour maîtriser les méthodes.',
      price: 750,
      duration: 'Vacances de la Toussaint',
      features: [
        'Méthodes dissertation/commentaire',
        'Résolution de problèmes',
        'Techniques d\'analyse et de synthèse',
      ],
      color: 'from-emerald-600 to-green-500',
      icon: Users,
    },
    {
      name: 'Académie d\'Hiver',
      subtitle: 'Objectif Savoirs',
      target: 'Tous niveaux',
      description: 'Consolidation des acquis et examens blancs.',
      price: 750,
      duration: 'Vacances d\'Hiver',
      features: [
        'Revisions intensives',
        'Examens blancs',
        'Feedback personnalisé',
      ],
      color: 'from-blue-600 to-cyan-500',
      icon: Globe,
    },
  ],
} as const;

type Programme = {
  name: string;
  subtitle: string;
  target: string;
  description: string;
  price: number | string;
  period: string;
  features: string[];
  cta: string;
  popular: boolean;
  color: string;
  icon: any;
};

const UNIVERS_ODYSSEE: { title: string; subtitle: string; description: string; programmes: Programme[]; } = {
  title: 'Univers 3 : Programme Odyssée',
  subtitle: 'La stratégie pour la Mention',
  description: 'Programmes ancrés dans la réalité du Bac FR.',
  programmes: [
    {
      name: 'Odyssée Première',
      subtitle: 'La Trajectoire',
      target: 'Élève de Première',
      description: 'Optimiser les spécialités avant la Terminale.',
      price: 390,
      period: 'TND/mois',
      features: [
        'Méthodo + Spécialités',
        'Suivi continu',
      ],
      cta: 'Rejoindre',
      popular: false,
      color: 'from-sky-600 to-indigo-500',
      icon: Rocket,
    },
    {
      name: 'Odyssée Terminale',
      subtitle: 'La Stratégie Mention',
      target: 'Élève de Terminale',
      description: 'Objectif mention + Parcoursup fort.',
      price: 490,
      period: 'TND/mois',
      features: [
        'Spécialités + Tronc commun',
        'Grand Oral',
      ],
      cta: "Démarrer l'Odyssée",
      popular: true,
      color: 'from-amber-600 to-yellow-500',
      icon: Trophy,
    },
  ],
} as const;

function SmoothScrollLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string; }) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const el = document.querySelector(href);
    if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth' });
  };
  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}

export default function OffresPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);

  return (
    <>
      <Header />
      <main ref={containerRef} className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
        <section className="relative py-20 bg-[#F6F9FC] overflow-hidden">
          <motion.div className="absolute inset-0 opacity-10" style={{ y }}>
            <div className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full blur-xl" />
            <div className="absolute top-40 right-20 w-32 h-32 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-xl" />
            <div className="absolute bottom-20 left-1/4 w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full blur-xl" />
          </motion.div>
          <div className="container mx-auto px-4 relative z-10">
            <motion.div className="text-center max-w-5xl mx-auto" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
              <motion.h1 className="font-bold text-[clamp(2.5rem,5vw,3rem)] text-[#0A2540] mb-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
                Pilotez Votre Réussite
              </motion.h1>
              <motion.h2 className="font-medium text-[clamp(1.25rem,3vw,1.5rem)] text-[#334155] mb-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}>
                La Stratégie, l'Expertise, la Mention.
              </motion.h2>
              <motion.hr className="w-20 h-0.5 bg-[#FFD700] mx-auto my-6" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.6 }} />
              <motion.p className="font-normal text-[clamp(1rem,2.5vw,1.125rem)] text-[#334155] leading-[1.7] max-w-[80ch] mx-auto" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.8 }}>
                Le Baccalauréat n'est plus un simple examen, c'est un projet stratégique. Nous combinons l'expertise de professeurs agrégés et l'IA prédictive pour des parcours sur-mesure jusque la mention.
              </motion.p>
              <motion.div className="flex flex-wrap justify-center gap-4 mt-12" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 1 }}>
                <SmoothScrollLink href="#cortex">
                  <Button variant="outline" className="border-or-stellaire text-bleu-nuit hover:bg-or-stellaire hover:text-bleu-nuit">
                    <Brain className="w-4 h-4 mr-2" /> Nexus Cortex
                  </Button>
                </SmoothScrollLink>
                <SmoothScrollLink href="#academies">
                  <Button variant="outline" className="border-or-stellaire text-bleu-nuit hover:bg-or-stellaire hover:text-bleu-nuit">
                    <Rocket className="w-4 h-4 mr-2" /> Académies
                  </Button>
                </SmoothScrollLink>
                <SmoothScrollLink href="#odyssee">
                  <Button variant="outline" className="border-or-stellaire text-bleu-nuit hover:bg-or-stellaire hover:text-bleu-nuit">
                    <Crown className="w-4 h-4 mr-2" /> Programme Odyssée
                  </Button>
                </SmoothScrollLink>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
          <div className="container mx-auto px-4">
            <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}>
              <Badge variant="outline" className="mb-4 bg-or-stellaire text-bleu-nuit border-or-stellaire">
                <Target className="w-4 h-4 mr-2" /> Excellence Sur-Mesure
              </Badge>
              <h1 className="text-4xl md:text-6xl font-bold text-bleu-nuit mb-6">L'Excellence Sur-Mesure</h1>
              <p className="text-xl text-gris-noble max-w-4xl mx-auto leading-relaxed">
                Découvrez nos offres adaptées à chaque profil d'élève. De l'accompagnement personnalisé à la préparation intensive, nous vous proposons des solutions sur mesure pour atteindre l'excellence académique.
              </p>
            </motion.div>
          </div>
        </section>

        <CreditsSystem />

        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <motion.div className="text-center mb-12" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}>
              <Badge variant="outline" className="mb-4 bg-blue-50 text-blue-700 border-blue-200"><Target className="w-4 h-4 mr-2" /> Analyse Stratégique Différentielle</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-6">Deux Réalités, Deux Réponses Sur-Mesure</h2>
            </motion.div>
            <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
              <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}>
                <Card className="h-full border-2 border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 hover:shadow-strong transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 flex items-center justify-center"><Users className="w-6 h-6 text-white" /></div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-bleu-nuit">L'Élève Scolarisé (Lycée français)</CardTitle>
                        <p className="text-gris-noble">Son besoin : L'OPTIMISATION</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3"><Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" /><span className="text-gris-noble">Il a un cadre, des professeurs, et un contrôle continu (40%)</span></div>
                      <div className="flex items-start gap-3"><Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" /><span className="text-gris-noble">Il doit exceller dans ses spécialités à fort coefficient</span></div>
                      <div className="flex items-start gap-3"><Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" /><span className="text-gris-noble">Préparer les épreuves terminales (60%) et se démarquer sur Parcoursup</span></div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}>
                <Card className="h-full border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 hover:shadow-strong transition-all duration-300 hover:scale-105">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 flex items-center justify-center"><Globe className="w-6 h-6 text-white" /></div>
                      <div>
                        <CardTitle className="text-2xl font-bold text-bleu-nuit">Le Candidat Libre</CardTitle>
                        <p className="text-gris-noble">Son besoin : La SUBSTITUTION</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3"><Check className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" /><span className="text-gris-noble">Il est seul, pas de contrôle continu, pas de bulletins</span></div>
                      <div className="flex items-start gap-3"><Check className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" /><span className="text-gris-noble">Évaluations ponctuelles couperet sur tout le programme</span></div>
                      <div className="flex items-start gap-3"><Check className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" /><span className="text-gris-noble">Rattaché à Aix-Marseille, navigation administrative complexe</span></div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        <section id="cortex" className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
          <div className="container mx-auto px-4">
            <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}>
              <Badge variant="outline" className="mb-4 bg-blue-50 text-blue-700 border-blue-200"><Brain className="w-4 h-4 mr-2" /> {UNIVERS_CORTEX.title}</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-4">{UNIVERS_CORTEX.subtitle}</h2>
              <p className="text-lg text-gris-noble max-w-3xl mx-auto">{UNIVERS_CORTEX.description}</p>
            </motion.div>
            <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
              {UNIVERS_CORTEX.offers.map((offer, index) => (
                <motion.div key={offer.name} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: index * 0.1 }} viewport={{ once: true }} whileHover={{ y: -5 }} className="relative">
                  {offer.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                      <div className="bg-red-500 text-white px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold shadow-md">
                        <Award className="w-3 h-3 md:w-4 md:h-4 mr-1 inline" /> Le plus populaire
                      </div>
                    </div>
                  )}
                  <Card className={`h-full flex flex-col hover:shadow-xl transition-all duration-300 ${offer.popular ? 'bg-white border-2 border-red-500 shadow-2xl transform scale-105 -translate-y-4' : 'bg-white border border-slate-200 shadow-lg'}`}>
                    <CardHeader className="text-center p-6 md:p-8">
                      <CardTitle className="font-heading text-xl md:text-2xl font-bold text-gray-900 mb-3 md:mb-4">{offer.name}</CardTitle>
                      <p className="text-sm md:text-base text-gray-600 mb-4 md:mb-6">{offer.description}</p>
                      <div className="mb-4 md:mb-6">
                        <div className="flex items-baseline justify-center">
                          <span className="font-bold text-3xl md:text-5xl lg:text-6xl text-slate-900" style={{ fontFamily: 'Poppins' }}>{typeof offer.price === 'number' ? formatPrice(offer.price) : offer.price}</span>
                          <span className="font-medium text-lg md:text-xl text-blue-600 ml-2" style={{ fontFamily: 'Inter' }}>{offer.period}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 md:p-8 flex-1 flex flex-col">
                      <ul className="space-y-3 md:space-y-5 mb-6 md:mb-8 flex-1">
                        {offer.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start space-x-3 md:space-x-4">
                            <Check className="w-4 h-4 md:w-6 md:h-6 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm md:text-base text-gray-700 leading-relaxed">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button asChild className={`w-full h-12 md:h-14 text-base md:text-lg font-semibold transition-all duration-300 ${offer.popular ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white'}`}>
                        <Link href="/bilan-gratuit">Commencer</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.4 }} viewport={{ once: true }} className="mb-12 md:mb-20">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 md:mb-6">Notre Offre la Plus Complète : Le Pack Annuel</h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto px-4">L'accompagnement intégral pour réussir votre Baccalauréat en candidat libre</p>
          </div>
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-2xl">
              <CardContent className="p-6 md:p-12">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8 space-y-4 md:space-y-0">
                  <div>
                    <Badge className="bg-blue-600 text-white mb-3 md:mb-4 text-xs md:text-sm">{ANNUAL_PACK.badge}</Badge>
                    <h3 className="font-heading text-2xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4">{ANNUAL_PACK.name}</h3>
                    <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">{ANNUAL_PACK.description}</p>
                  </div>
                  <div className="text-center md:text-right">
                    <div className="text-base md:text-lg text-gray-500 line-through mb-1 md:mb-2">{formatPrice(ANNUAL_PACK.originalPrice)}</div>
                    <div className="text-3xl md:text-4xl font-bold text-blue-600">{formatPrice(ANNUAL_PACK.price)}</div>
                    <div className="text-xs md:text-sm text-gray-600">pour l'année</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-6 md:mb-8">
                  {ANNUAL_PACK.features.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <Shield className="w-4 h-4 md:w-5 md:h-5 text-blue-600 mt-1 flex-shrink-0" />
                      <span className="text-sm md:text-base text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
                <Button asChild className="w-full h-12 md:h-16 text-base md:text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white">
                  <Link href="/bilan-gratuit">Découvrir le Pack Candidat Libre <ArrowRight className="ml-2 h-4 w-4 md:h-5 md:w-5" /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        <motion.section id="academies" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6 }} viewport={{ once: true }} className="mb-12 md:mb-20">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 md:mb-6">Nos Stages Intensifs : Accélérez vos Compétences</h2>
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto px-4">Des formations intensives pour acquérir rapidement des compétences clés</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {UNIVERS_ACADEMIES.academies.map((academy, index) => (
              <motion.div key={academy.name} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: index * 0.1 }} viewport={{ once: true }} whileHover={{ y: -5 }}>
                <Card className="relative overflow-hidden border-0 shadow-strong h-full transition-all duration-300 hover:scale-105">
                  <div className={`absolute inset-0 bg-gradient-to-r ${academy.color} opacity-5`} />
                  <CardHeader className="relative">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${academy.color} flex items-center justify-center`}>
                        <academy.icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-bleu-nuit">{academy.name}</CardTitle>
                        <p className="text-sm text-gris-noble">{academy.subtitle}</p>
                      </div>
                    </div>
                    <div className="mb-2">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{academy.target}</Badge>
                    </div>
                    <p className="text-gris-noble text-sm">{academy.description}</p>
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="mb-4">
                      <div className="text-2xl font-black text-bleu-nuit">{formatPrice(academy.price)} TND</div>
                      <div className="text-sm text-gris-noble">{academy.duration}</div>
                    </div>
                    <div className="space-y-2 mb-6">
                      {academy.features.map((feature, idx) => (
                        <motion.div key={idx} className="flex items-start gap-2" initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} viewport={{ once: true }}>
                          <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gris-noble">{feature}</span>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <section id="odyssee" className="py-20 bg-gradient-to-br from-amber-50 to-orange-50">
          <div className="container mx-auto px-4">
            <motion.div className="text-center mb-16" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}>
              <Badge variant="outline" className="mb-4 bg-amber-50 text-amber-700 border-amber-200"><Crown className="w-4 h-4 mr-2" /> {UNIVERS_ODYSSEE.title}</Badge>
              <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-4">{UNIVERS_ODYSSEE.subtitle}</h2>
              <p className="text-lg text-gris-noble max-w-3xl mx-auto">{UNIVERS_ODYSSEE.description}</p>
            </motion.div>
            <div className="grid lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {UNIVERS_ODYSSEE.programmes.map((programme, index) => (
                <motion.div key={programme.name} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: index * 0.1 }} viewport={{ once: true }} whileHover={{ y: -5 }}>
                  <Card className={`relative overflow-hidden border-0 shadow-strong h-full transition-all duration-300 hover:scale-105 ${programme.popular ? 'ring-2 ring-or-stellaire' : ''}`}>
                    {programme.popular && (
                      <motion.div className="absolute top-4 right-4" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 }}>
                        <Badge className="bg-or-stellaire text-bleu-nuit font-bold"><Star className="w-4 h-4 mr-1" /> Plus Populaire</Badge>
                      </motion.div>
                    )}
                    <div className={`absolute inset-0 bg-gradient-to-r ${programme.color} opacity-5`} />
                    <CardHeader className="relative">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${programme.color} flex items-center justify-center`}>
                          <programme.icon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-bleu-nuit">{programme.name}</CardTitle>
                          <p className="text-gris-noble text-sm">{programme.subtitle}</p>
                        </div>
                      </div>
                      <div className="mb-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{programme.target}</Badge>
                      </div>
                      <p className="text-gris-noble text-sm">{programme.description}</p>
                    </CardHeader>
                    <CardContent className="relative">
                      <div className="mb-6">
                        <div className="text-2xl font-black text-bleu-nuit">{typeof programme.price === 'number' ? formatPrice(programme.price) : programme.price} {programme.period}</div>
                      </div>
                      <div className="space-y-3 mb-8">
                        {programme.features.map((feature, idx) => (
                          <motion.div key={idx} className="flex items-start gap-3" initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }} viewport={{ once: true }}>
                            <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-gris-noble">{feature}</span>
                          </motion.div>
                        ))}
                      </div>
                      <Button className="w-full bg-or-stellaire hover:bg-or-stellaire-dark text-bleu-nuit font-bold transition-all duration-200 hover:scale-105">{programme.cta}</Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <OffersComparison />
        <SpecializedPacks />
        <AriaComparison />
        <ExpertsShowcase />
        <GuaranteeSection />
        <FAQSection />

        <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
          <div className="container mx-auto px-4">
            <DiagnosticForm />
          </div>
        </section>

        <section className="py-20 bg-gradient-to-r from-bleu-nuit to-bleu-nuit-light text-white">
          <div className="container mx-auto px-4 text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} viewport={{ once: true }}>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Prêt à Libérer Votre Potentiel ?</h2>
              <p className="text-xl text-white/90 max-w-2xl mx-auto mb-8">Rejoignez l'élite éducative et donnez à votre enfant l'avantage concurrentiel qu'il mérite.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/bilan-gratuit"><Button size="lg" className="bg-or-stellaire hover:bg-or-stellaire-dark text-bleu-nuit font-bold transition-all duration-200 hover:scale-105">Consultation Gratuite <ArrowRight className="ml-2 h-5 w-5" /></Button></Link>
                <Link href="/contact"><Button variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-bleu-nuit transition-all duration-200 hover:scale-105">Nous Contacter</Button></Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      <Footer />
      <FloatingNav />
    </>
  );
}
