'use client';

import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Award,
  Calendar,
  Check,
  Clock,
  Code2,
  Shield,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Helper pour formater les prix
const formatPrice = (price: number) => `${price} TND`;

// Configuration des abonnements
const SUBSCRIPTION_PLANS = [
  {
    name: 'Essentiel',
    description: 'Accompagnement ponctuel pour commencer',
    price: 150,
    credits: 5,
    features: [
      'Plateforme e-learning complète',
      '5 crédits de coaching/mois',
      'Accès aux ressources exclusives',
      'Suivi personnalisé par email',
      'Support technique inclus',
    ],
    popular: false,
  },
  {
    name: 'Confort',
    description: "L'équilibre parfait entre soutien et autonomie",
    price: 300,
    credits: 12,
    features: [
      'Tout du plan Essentiel',
      '12 crédits de coaching/mois',
      'Sessions individuelles prioritaires',
      'Planning flexible et adaptatif',
      'Bilan mensuel détaillé',
      'Accès aux masterclass',
    ],
    popular: true,
  },
  {
    name: 'Excellence',
    description: "Accompagnement intensif pour viser l'excellence",
    price: 450,
    credits: 20,
    features: [
      'Tout du plan Confort',
      '20 crédits de coaching/mois',
      'Coach personnel dédié',
      'Suivi parental renforcé',
      'Préparation aux examens',
      'Garantie résultats',
    ],
    popular: false,
  },
];

// Configuration du pack annuel
const ANNUAL_PACK = {
  name: 'Pack Réussite "Candidat Libre"',
  badge: 'Offre Complète',
  description:
    "L'accompagnement intégral pour réussir votre Baccalauréat en candidat libre avec un taux de réussite exceptionnel.",
  price: 7200,
  originalPrice: 9000,
  features: [
    "10 mois d'accompagnement personnalisé",
    "80 crédits répartis sur l'année",
    'Coach principal dédié tout au long du parcours',
    'Accès illimité à la plateforme e-learning',
    'Préparation complète aux épreuves du Bac',
    'Suivi parental mensuel détaillé',
    'Garantie "Bac Obtenu ou Remboursé"',
    'Support technique prioritaire 7j/7',
  ],
};

// Configuration des stages intensifs
const INTENSIVE_STAGES = [
  {
    name: 'Stage Révisions Intensives Bac',
    badge: 'Préparation Bac',
    description:
      'Une semaine intensive pour maximiser vos chances de réussite au Baccalauréat avec nos meilleurs coachs.',
    price: 800,
    features: [
      '40h de cours intensifs en petits groupes',
      'Révisions ciblées sur vos matières faibles',
      "Simulations d'épreuves en conditions réelles",
      'Coaching mental et gestion du stress',
      'Supports de révision exclusifs',
      'Suivi post-stage pendant 1 mois',
    ],
    icons: [Clock, Target, Users, Shield, Award, Calendar],
  },
  {
    name: 'Python Bootcamp Intensif',
    badge: 'Nouveau',
    description:
      'Maîtrisez Python en 2 semaines avec notre programme intensif conçu pour les débutants et intermédiaires.',
    price: 1200,
    features: [
      '60h de formation pratique sur 2 semaines',
      'Projets concrets et portfolio professionnel',
      'Mentoring individuel avec développeurs seniors',
      'Certificat de compétences reconnu',
      "Accès plateforme d'exercices à vie",
      'Accompagnement placement en stage/emploi',
    ],
    icons: [Code2, Target, Users, Award, Shield, Calendar],
  },
];

// Configuration des packs spéciaux
const SPECIAL_PACKS = [
  {
    name: 'Pack Parcoursup',
    description: 'Accompagnement complet pour réussir votre orientation post-bac',
    price: 600,
    features: [
      'Aide à la rédaction des lettres de motivation',
      "Préparation aux entretiens d'admission",
      'Stratégie de vœux personnalisée',
      "Suivi jusqu'aux résultats d'admission",
      '10 crédits de coaching dédiés',
    ],
  },
  {
    name: 'Pack Grand Oral',
    description: "Préparation intensive à l'épreuve du Grand Oral du Bac",
    price: 400,
    features: [
      'Méthodologie complète du Grand Oral',
      'Entraînements en conditions réelles',
      'Coaching prise de parole en public',
      'Aide au choix des questions',
      '8 crédits de préparation intensive',
    ],
  },
  {
    name: 'Pack Rattrapage',
    description: 'Remise à niveau express pour rattraper un retard scolaire',
    price: 500,
    features: [
      'Diagnostic complet des lacunes',
      'Plan de rattrapage personnalisé',
      'Sessions intensives de remise à niveau',
      'Suivi des progrès hebdomadaire',
      '15 crédits de soutien ciblé',
    ],
  },
];

// Configuration des matières pour ARIA
const AVAILABLE_SUBJECTS = [
  { id: 'maths', name: 'Mathématiques', included: true },
  { id: 'physics', name: 'Physique-Chimie', included: false },
  { id: 'svt', name: 'SVT', included: false },
  { id: 'history', name: 'Histoire-Géo', included: false },
  { id: 'french', name: 'Français', included: false },
  { id: 'philosophy', name: 'Philosophie', included: false },
  { id: 'english', name: 'Anglais', included: false },
  { id: 'spanish', name: 'Espagnol', included: false },
  { id: 'ses', name: 'SES', included: false },
  { id: 'computer', name: 'NSI', included: false },
];

// Composant ARIA interactif
function ARIAInteractiveModule() {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedSubjects, setSelectedSubjects] = useState(['maths']);
  const [isLoading, setIsLoading] = useState(false);

  // Pour simplifier, on suppose que le parent a un élève.
  // Dans une vraie app, on aurait un sélecteur d'élève.
  const studentId = (session?.user as any)?.studentId;

  const toggleSubject = (subjectId: string) => {
    if (selectedSubjects.includes(subjectId)) {
      setSelectedSubjects(selectedSubjects.filter((id) => id !== subjectId));
    } else {
      setSelectedSubjects([...selectedSubjects, subjectId]);
    }
  };

  // Calculs des prix
  const additionalSubjects = selectedSubjects.length - 1; // -1 car la première est incluse
  const additionalCost = additionalSubjects * 50;
  const packPrice = 120;
  const isPackBetter = additionalSubjects >= 2;
  const savings = additionalCost - packPrice;

  const handleProceed = async () => {
    if (!session) {
      const target = `/offres`; // Rediriger ici après connexion
      const cb = encodeURIComponent(target);
      router.push(`/auth/signin?callbackUrl=${cb}`);
      return;
    }

    if (!studentId) {
      toast.error("Profil élève non trouvé", { description: "Impossible de faire la demande sans élève associé."});
      return;
    }

    setIsLoading(true);
    const price = isPackBetter ? packPrice : additionalCost;
    
    try {
      const response = await fetch('/api/subscriptions/request-aria', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId,
          subjects: selectedSubjects,
          price,
          isPack: isPackBetter,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Une erreur est survenue.');
      }

      toast.success('Demande envoyée !', {
        description: "Votre demande d'abonnement ARIA a été transmise. Un assistant la traitera bientôt.",
        action: {
          label: 'Voir mes demandes',
          onClick: () => router.push('/dashboard/parent/abonnements'),
        },
      });
      // Optionnel: rediriger après un court délai
      setTimeout(() => router.push('/dashboard/parent/abonnements'), 3000);

    } catch (error: any) {
      toast.error('Échec de la demande', { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-blue-900 rounded-2xl p-8 md:p-12 text-white">
      <div className="flex items-center gap-6 mb-8">
        <div className="flex-shrink-0">
          <Image
            src="/images/aria.png"
            alt="ARIA - Assistant IA"
            width={80}
            height={80}
            className="rounded-2xl shadow-lg"
          />
        </div>
        <div>
          <h3 className="font-heading text-3xl md:text-4xl font-bold text-white mb-2">
            Personnalisez Votre Assistant IA ARIA
          </h3>
          <p className="text-slate-300 text-lg">Votre assistant IA personnel, disponible 24/7</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Sélecteur de matières */}
        <div>
          <h4 className="font-heading text-xl font-bold text-white mb-4">
            Choisissez vos matières
          </h4>
          <p className="text-slate-300 mb-6">
            Votre abonnement inclut déjà une matière. Sélectionnez les matières supplémentaires que
            vous souhaitez activer pour votre assistant IA.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {AVAILABLE_SUBJECTS.map((subject) => {
              const isSelected = selectedSubjects.includes(subject.id);
              const isIncluded = subject.included;

              return (
                <button
                  key={subject.id}
                  onClick={() => toggleSubject(subject.id)}
                  disabled={isIncluded}
                  className={`
                    px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                    ${
                      isIncluded
                        ? 'bg-blue-600 text-white border border-blue-500 cursor-default'
                        : isSelected
                          ? 'bg-blue-600 text-white border border-blue-500 hover:bg-blue-700'
                          : 'bg-slate-700 text-slate-300 border border-slate-600 hover:bg-slate-600'
                    }
                  `}
                >
                  {subject.name}
                  {isIncluded && <span className="block text-xs text-blue-200 mt-1">Incluse</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Récapitulatif de prix */}
        <div className="bg-slate-800 rounded-xl p-6">
          <h4 className="font-heading text-xl font-bold text-white mb-6">Récapitulatif</h4>

          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">1ère matière :</span>
              <span className="text-green-400 font-medium">Incluse</span>
            </div>

            {additionalSubjects > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-slate-300">
                  Matières supplémentaires ({additionalSubjects}) :
                </span>
                <span
                  className={`font-medium ${isPackBetter ? 'line-through text-slate-500' : 'text-white'}`}
                >
                  +{additionalSubjects * 50} TND
                </span>
              </div>
            )}

            {isPackBetter && (
              <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Sparkles className="w-5 h-5 text-yellow-400 mr-2" />
                  <span className="text-yellow-400 font-semibold text-sm">Offre Spéciale</span>
                </div>
                <p className="text-white text-sm">
                  Passez au <strong>Pack Toutes Matières</strong> pour seulement{' '}
                  <strong className="text-red-400">120 TND/mois</strong> et économisez{' '}
                  <strong>{savings} TND</strong> !
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-700 pt-4 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-white">Prix Total Mensuel :</span>
              <div className="text-right">
                {isPackBetter && (
                  <div className="text-slate-400 line-through text-sm">{additionalCost} TND</div>
                )}
                <div className="text-2xl font-bold text-blue-400">
                  {isPackBetter ? packPrice : additionalCost} TND
                </div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleProceed}
            disabled={isLoading}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            {isLoading ? 'Envoi en cours...' : (isPackBetter ? 'Choisir le Pack Toutes Matières' : 'Ajouter à mon Abonnement')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function OffresPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="bg-gradient-to-br from-gray-50 to-blue-50/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
          {/* Section 1: Titre de la Page */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-12 md:mb-20"
          >
            <h1 className="font-heading text-3xl md:text-4xl lg:text-6xl font-bold text-gray-900 mb-4 md:mb-8 leading-tight">
              Des Formules Flexibles pour Chaque <span className="text-blue-600">Ambition</span>
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed px-4">
              Découvrez notre écosystème d'offres, de l'abonnement mensuel aux stages spécialisés,
              et construisez le parcours de réussite qui vous correspond.
            </p>
          </motion.div>

          {/* Section 2: Les Abonnements Mensuels */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="mb-12 md:mb-20"
          >
            <div className="text-center mb-12 md:mb-16">
              <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                Nos Formules d'Abonnement : Votre Socle de Réussite
              </h2>
              <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto px-4">
                Un accompagnement régulier adapté à vos besoins avec nos coachs experts
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 max-w-6xl mx-auto auto-rows-fr">
              {SUBSCRIPTION_PLANS.map((plan, index) => (
                <motion.div
                  key={plan.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="relative"
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                      <div className="bg-red-500 text-white px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-semibold shadow-md">
                        <Award className="w-3 h-3 md:w-4 md:h-4 mr-1 inline" />
                        Le plus populaire
                      </div>
                    </div>
                  )}

                  <Card
                    className={`h-full flex flex-col hover:shadow-xl transition-all duration-300 ${
                      plan.popular
                        ? 'bg-white border-2 border-red-500 shadow-2xl transform scale-105 -translate-y-4'
                        : 'bg-white border border-slate-200 shadow-lg'
                    }`}
                  >
                    <CardHeader className="text-center p-6 md:p-8">
                      <CardTitle className="font-heading text-xl md:text-2xl font-bold text-gray-900 mb-3 md:mb-4">
                        {plan.name}
                      </CardTitle>
                      <p className="text-sm md:text-base text-gray-600 mb-4 md:mb-6">
                        {plan.description}
                      </p>

                      {/* Prix avec typographie hiérarchisée */}
                      <div className="mb-4 md:mb-6">
                        <div className="flex items-baseline justify-center">
                          <span
                            className="font-bold text-3xl md:text-5xl lg:text-6xl text-slate-900"
                            style={{ fontFamily: 'Poppins' }}
                          >
                            {plan.price}
                          </span>
                          <span
                            className="font-medium text-lg md:text-xl text-blue-600 ml-2"
                            style={{ fontFamily: 'Inter' }}
                          >
                            TND
                          </span>
                          <span
                            className="font-normal text-sm md:text-base text-slate-500 ml-1"
                            style={{ fontFamily: 'Inter' }}
                          >
                            /mois
                          </span>
                        </div>
                      </div>

                      {plan.credits > 0 && (
                        <div className="mb-3 md:mb-4">
                          <Badge
                            className="bg-blue-600 text-white font-medium text-xs md:text-sm"
                            style={{ fontFamily: 'Inter' }}
                          >
                            {plan.credits} crédits inclus
                          </Badge>
                        </div>
                      )}
                    </CardHeader>

                    <CardContent className="p-6 md:p-8 flex-1 flex flex-col">
                      <ul className="space-y-3 md:space-y-5 mb-6 md:mb-8 flex-1">
                        {plan.features.map((feature, featureIndex) => (
                          <li
                            key={featureIndex}
                            className="flex items-start space-x-3 md:space-x-4"
                          >
                            <Check className="w-4 h-4 md:w-6 md:h-6 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm md:text-base text-gray-700 leading-relaxed">
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        asChild
                        className={`w-full h-12 md:h-14 text-base md:text-lg font-semibold transition-all duration-300 ${
                          plan.popular
                            ? 'bg-red-500 hover:bg-red-600 text-white'
                            : 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white'
                        }`}
                      >
                        <Link href="/bilan-gratuit">Commencer</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Section 3: Le Pack Annuel "Réussite Candidat Libre" */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="mb-12 md:mb-20"
          >
            <div className="text-center mb-12 md:mb-16">
              <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                Notre Offre la Plus Complète : Le Pack Annuel
              </h2>
              <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto px-4">
                L'accompagnement intégral pour réussir votre Baccalauréat en candidat libre
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-2xl">
                <CardContent className="p-6 md:p-12">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 md:mb-8 space-y-4 md:space-y-0">
                    <div>
                      <Badge className="bg-blue-600 text-white mb-3 md:mb-4 text-xs md:text-sm">
                        {ANNUAL_PACK.badge}
                      </Badge>
                      <h3 className="font-heading text-2xl md:text-3xl font-bold text-gray-900 mb-3 md:mb-4">
                        {ANNUAL_PACK.name}
                      </h3>
                      <p className="text-base md:text-lg text-gray-600 mb-4 md:mb-6">
                        {ANNUAL_PACK.description}
                      </p>
                    </div>
                    <div className="text-center md:text-right">
                      <div className="text-base md:text-lg text-gray-500 line-through mb-1 md:mb-2">
                        {formatPrice(ANNUAL_PACK.originalPrice)}
                      </div>
                      <div className="text-3xl md:text-4xl font-bold text-blue-600">
                        {formatPrice(ANNUAL_PACK.price)}
                      </div>
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

                  <Button
                    asChild
                    className="w-full h-12 md:h-16 text-base md:text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Link href="/bilan-gratuit">
                      Découvrir le Pack Candidat Libre
                      <ArrowRight className="ml-2 h-4 w-4 md:h-5 md:w-5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </motion.section>

          {/* Section 4: Les Stages Intensifs Spécialisés */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            viewport={{ once: true }}
            className="mb-12 md:mb-20"
          >
            <div className="text-center mb-12 md:mb-16">
              <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                Nos Stages Intensifs : Accélérez vos Compétences
              </h2>
              <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto px-4">
                Des formations intensives pour acquérir rapidement des compétences clés
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-6xl mx-auto">
              {INTENSIVE_STAGES.map((stage, index) => (
                <motion.div
                  key={stage.name}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="h-full bg-white border border-slate-200 shadow-lg hover:shadow-xl transition-all duration-300">
                    <CardHeader className="p-6 md:p-8">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
                        <Badge className="bg-red-500 text-white text-xs md:text-sm w-fit">
                          {stage.badge}
                        </Badge>
                        <div className="text-center sm:text-right">
                          <div className="text-2xl md:text-3xl font-bold text-blue-600">
                            {formatPrice(stage.price)}
                          </div>
                        </div>
                      </div>
                      <h3 className="font-heading text-xl md:text-2xl font-bold text-gray-900 mb-3 md:mb-4">
                        {stage.name}
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 leading-relaxed">
                        {stage.description}
                      </p>
                    </CardHeader>

                    <CardContent className="p-6 md:p-8 pt-0">
                      <ul className="space-y-3 md:space-y-4 mb-6 md:mb-8">
                        {stage.features.map((feature, featureIndex) => {
                          const IconComponent = stage.icons?.[featureIndex] || Check;
                          return (
                            <li
                              key={featureIndex}
                              className="flex items-start space-x-3 md:space-x-4"
                            >
                              <IconComponent className="w-4 h-4 md:w-6 md:h-6 text-blue-600 mt-0.5 flex-shrink-0" />
                              <span className="text-sm md:text-base text-gray-700 leading-relaxed">
                                {feature}
                              </span>
                            </li>
                          );
                        })}
                      </ul>

                      <Button
                        asChild
                        className="w-full h-12 md:h-14 text-base md:text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Link href="/bilan-gratuit">
                          {index === 0 ? 'Je réserve ma place' : "S'inscrire au Bootcamp"}
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>

          {/* Section 5: Les Packs Spécifiques */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            viewport={{ once: true }}
            className="mb-12 md:mb-20"
          >
            <div className="text-center mb-12 md:mb-16">
              <h2 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
                Nos Packs pour des Objectifs Ciblés
              </h2>
              <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto px-4">
                Des accompagnements spécialisés pour réussir des étapes clés de votre parcours
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <Accordion type="single" collapsible className="w-full space-y-3 md:space-y-4">
                {SPECIAL_PACKS.map((pack) => (
                  <AccordionItem
                    key={pack.name}
                    value={pack.name}
                    className="border border-gray-200 rounded-xl px-4 md:px-6"
                  >
                    <AccordionTrigger className="text-left hover:no-underline py-4 md:py-6">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full mr-4 space-y-2 sm:space-y-0">
                        <div>
                          <h4 className="font-semibold text-lg md:text-xl text-gray-900">
                            {pack.name}
                          </h4>
                          <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">
                            {pack.description}
                          </p>
                        </div>
                        <div className="text-center sm:text-right">
                          <div className="text-xl md:text-2xl font-bold text-blue-600">
                            {formatPrice(pack.price)}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 md:pb-6">
                      <div className="space-y-3 md:space-y-4 mb-4 md:mb-6">
                        {pack.features.map((feature, index) => (
                          <div key={index} className="flex items-start space-x-3">
                            <Check className="w-4 h-4 md:w-5 md:h-5 text-green-500 mt-1 flex-shrink-0" />
                            <span className="text-sm md:text-base text-gray-700">{feature}</span>
                          </div>
                        ))}
                      </div>
                      <Button
                        asChild
                        className="w-full h-10 md:h-12 bg-blue-600 hover:bg-blue-700 text-white text-sm md:text-base"
                      >
                        <Link href="/bilan-gratuit">Réserver ce Pack</Link>
                      </Button>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </motion.section>

          {/* Section 6: Add-ons ARIA */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            viewport={{ once: true }}
            className="mb-12 md:mb-20"
          >
            <ARIAInteractiveModule />
          </motion.section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
