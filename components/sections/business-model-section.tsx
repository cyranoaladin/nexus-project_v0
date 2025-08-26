'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Award, Calendar, Check, CreditCard, Sparkles, Zap } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

// Formules d'abonnement selon les spécifications exactes
const SUBSCRIPTION_PLANS = {
  ACCES_PLATEFORME: {
    name: 'ACCÈS PLATEFORME',
    description: "L'essentiel pour commencer votre parcours d'excellence",
    price: 150,
    credits: 0,
    features: [
      'Accès 24/7 à la plateforme',
      'Suivi personnalisé',
      '0 crédits/mois',
      'ARIA (1 matière)',
    ],
  },
  HYBRIDE: {
    name: 'HYBRIDE',
    description: "L'équilibre parfait entre autonomie et suivi humain personnalisé",
    price: 450,
    credits: 4,
    popular: true,
    features: ['Tout de la Plateforme', '4 crédits/mois', 'Coach référent', 'Support prioritaire'],
  },
  IMMERSION: {
    name: 'IMMERSION',
    description: "L'accompagnement premium pour une réussite exceptionnelle",
    price: 750,
    credits: 8,
    features: ["Tout de l'Hybride", '8 crédits/mois', 'Support prioritaire', 'Bilan trimestriel'],
  },
};

// Matières disponibles pour ARIA
const AVAILABLE_SUBJECTS = [
  { id: 'math', name: 'Mathématiques', included: true },
  { id: 'physics', name: 'Physique-Chimie', included: false },
  { id: 'nsi', name: 'NSI', included: false },
  { id: 'french', name: 'Français', included: false },
  { id: 'philosophy', name: 'Philosophie', included: false },
  { id: 'history', name: 'Histoire-Géographie', included: false },
  { id: 'english', name: 'Anglais', included: false },
  { id: 'spanish', name: 'Espagnol', included: false },
];

// Composant interactif ARIA
function ARIAInteractiveModule() {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['math']);

  const toggleSubject = (subjectId: string) => {
    if (subjectId === 'math') return; // La première matière est toujours incluse

    setSelectedSubjects((prev) =>
      prev.includes(subjectId) ? prev.filter((id) => id !== subjectId) : [...prev, subjectId]
    );
  };

  const additionalSubjects = selectedSubjects.length - 1; // -1 car math est incluse
  const isPackBetter = additionalSubjects >= 3;
  const monthlyPrice = isPackBetter ? 120 : additionalSubjects * 50;
  const savings = isPackBetter ? additionalSubjects * 50 - 120 : 0;

  const getButtonText = () => {
    if (additionalSubjects === 0) return 'Sélectionnez une matière supplémentaire';
    if (isPackBetter) return 'Passer au Pack Toutes Matières';
    return `Ajouter ${additionalSubjects} matière${additionalSubjects > 1 ? 's' : ''}`;
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-8 md:p-12">
      {/* En-tête avec ARIA */}
      <div className="flex items-center mb-8">
        <div className="relative w-20 h-20 mr-6 flex-shrink-0">
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
            L'Offre IA "ARIA"
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
                  <span className="block text-sm text-slate-400 line-through">
                    +{additionalSubjects * 50} TND/mois
                  </span>
                )}
                <span className="text-2xl font-bold text-white">
                  +{monthlyPrice} TND
                  <span className="text-base font-normal text-slate-300">/mois</span>
                </span>
              </div>
            </div>
          </div>

          <Button
            disabled={additionalSubjects === 0}
            className={`w-full h-14 text-lg font-semibold transition-all duration-300 ${
              additionalSubjects === 0
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : isPackBetter
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
            asChild={additionalSubjects > 0}
          >
            {additionalSubjects > 0 ? (
              <Link href="/bilan-gratuit">{getButtonText()}</Link>
            ) : (
              <span>{getButtonText()}</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Packs spécifiques selon les spécifications
const SPECIAL_PACKS = {
  GRAND_ORAL: {
    name: 'Pack Grand Oral',
    price: 750,
    description: 'Préparation complète au Grand Oral',
    features: [
      '4 séances de coaching individuel',
      'Préparation des supports visuels',
      "Entraînement à l'oral avec feedback vidéo",
      "Simulation d'épreuve en conditions réelles",
    ],
  },
  BAC_FRANCAIS: {
    name: 'Pack Bac de Français',
    price: 1200,
    description: 'Accompagnement intensif pour le Bac de Français',
    features: [
      '6 séances de méthodologie',
      'Révision complète des œuvres',
      "Entraînement à l'oral avec textes",
      'Correction de 3 devoirs blancs',
    ],
  },
  ORIENTATION: {
    name: 'Pack Orientation & Parcoursup',
    price: 900,
    description: 'Stratégie complète pour Parcoursup',
    features: [
      "Bilan d'orientation personnalisé",
      'Stratégie de vœux optimisée',
      'Rédaction des projets motivés',
      'Préparation aux entretiens',
    ],
  },
};

export function BusinessModelSection() {
  return (
    <section className="section-container bg-white">
      <div className="content-centered">
        {/* En-tête explicative */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="content-centered mb-16 fade-in-up"
        >
          <Badge variant="default" className="badge-enhanced mb-6">
            <CreditCard className="w-4 h-4 mr-2" />
            Modèle Transparent & Flexible
          </Badge>
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-gray-900 mb-8 leading-tight">
            Notre Modèle Unique : Abonnement + Crédits
          </h2>
          <div className="max-w-5xl mx-auto">
            <p className="text-xl md:text-2xl text-gray-600 mb-12 leading-relaxed">
              Nous avons conçu un modèle révolutionnaire qui allie la transparence d'un abonnement à
              la flexibilité totale d'un système de crédits pour vos prestations humaines.
            </p>

            {/* Infographie explicative */}
            <div className="grid-centered grid-cards-2 max-w-4xl mx-auto mb-16">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                viewport={{ once: true }}
                className="card-enhanced"
              >
                <div className="flex items-center mb-6">
                  <Calendar className="w-8 h-8 text-blue-600 mr-4" />
                  <h3 className="font-heading font-bold text-xl text-gray-900">
                    L'Abonnement (Le Socle)
                  </h3>
                </div>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Accès complet à la plateforme, ARIA, suivi personnalisé + un budget mensuel de
                  crédits inclus selon votre formule.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                viewport={{ once: true }}
                className="card-enhanced"
              >
                <div className="flex items-center mb-6">
                  <Zap className="w-8 h-8 text-red-500 mr-4" />
                  <h3 className="font-heading font-bold text-xl text-gray-900">
                    Les Crédits (La Flexibilité)
                  </h3>
                </div>
                <p className="text-lg text-gray-600 leading-relaxed">
                  1 crédit = 1h de cours particulier en ligne. Utilisez vos crédits quand vous en
                  avez besoin, pour les prestations humaines.
                </p>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Règles du Système de Crédits - Remontée */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          viewport={{ once: true }}
          className="card-enhanced bg-gradient-to-r from-blue-50 to-indigo-50 p-8 mb-16"
        >
          <h3 className="font-heading font-bold text-2xl text-gray-900 mb-6 text-center">
            💡 Règles du Système de Crédits
          </h3>
          <div className="text-gray-700 space-y-4 max-w-4xl mx-auto">
            <p className="text-lg leading-relaxed">
              <strong>Coûts des Prestations :</strong> Cours en ligne (1 crédit) • Cours en
              présentiel (1,25 crédit) • Atelier de groupe (1,5 crédit)
            </p>
            <p className="text-lg leading-relaxed">
              <strong>Report :</strong> Les crédits non utilisés sont reportés 1 mois. Notification
              7 jours avant expiration.
            </p>
            <p className="text-lg leading-relaxed">
              <strong>Packs supplémentaires :</strong> Validité 12 mois. Annulation gratuite &gt;
              24h (cours) ou 48h (ateliers).
            </p>
          </div>
        </motion.div>

        {/* Grille des formules d'abonnement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <h3 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-12 text-center">
            Nos Formules d'Abonnement Mensuel
          </h3>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto mb-16 auto-rows-fr">
            {Object.entries(SUBSCRIPTION_PLANS).map(([key, plan], index) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="relative w-full flex"
              >
                {'popular' in plan && plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-red-500 text-white px-4 py-2 rounded-full text-sm font-semibold shadow-md">
                      <Award className="w-4 h-4 mr-1 inline" />
                      Le plus populaire
                    </div>
                  </div>
                )}

                <Card
                  className={`h-full flex flex-col hover:shadow-xl transition-all duration-300 ${
                    'popular' in plan && plan.popular
                      ? 'bg-white border-2 border-red-500 shadow-2xl transform scale-105 -translate-y-4'
                      : 'bg-white border border-slate-200 shadow-lg'
                  }`}
                >
                  <CardHeader className="text-center p-8">
                    <CardTitle className="font-heading text-2xl font-bold text-gray-900 mb-4">
                      {plan.name}
                    </CardTitle>
                    <p className="text-gray-600 mb-6">{plan.description}</p>

                    {/* Prix avec typographie hiérarchisée */}
                    <div className="mb-6">
                      <div className="flex items-baseline justify-center">
                        <span
                          className="font-bold text-5xl md:text-6xl text-slate-900"
                          style={{ fontFamily: 'Poppins' }}
                        >
                          {plan.price}
                        </span>
                        <span
                          className="font-medium text-xl text-blue-600 ml-2"
                          style={{ fontFamily: 'Inter' }}
                        >
                          TND
                        </span>
                        <span
                          className="font-normal text-base text-slate-500 ml-1"
                          style={{ fontFamily: 'Inter' }}
                        >
                          /mois
                        </span>
                      </div>
                    </div>

                    {plan.credits > 0 && (
                      <div className="mb-4">
                        <Badge
                          variant="default"
                          className="bg-blue-600 text-white font-medium"
                          style={{ fontFamily: 'Inter' }}
                        >
                          {plan.credits} crédits inclus
                        </Badge>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="p-8 flex-1 flex flex-col">
                    <ul className="space-y-5 mb-8 flex-1">
                      {plan.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start space-x-4">
                          <Check className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 leading-relaxed">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      asChild
                      className={`w-full h-14 text-lg font-semibold transition-all duration-300 ${
                        'popular' in plan && plan.popular
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
        </motion.div>

        {/* Module ARIA Interactif */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <ARIAInteractiveModule />
        </motion.div>

        {/* Packs Spécifiques */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="card-enhanced p-12">
            <div className="content-centered mb-12">
              <h3 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Les Packs Spécifiques (Paiement Unique)
              </h3>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
                Des accompagnements ciblés pour des objectifs précis
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <Accordion type="single" collapsible className="w-full space-y-4">
                {Object.entries(SPECIAL_PACKS).map(([key, pack]) => (
                  <AccordionItem
                    key={key}
                    value={key}
                    className="border border-gray-200 rounded-xl px-6"
                  >
                    <AccordionTrigger className="text-left hover:no-underline py-6">
                      <div className="flex justify-between items-center w-full mr-4">
                        <div>
                          <h4 className="font-semibold text-xl text-gray-900">{pack.name}</h4>
                          <p className="text-gray-600 mt-2">{pack.description}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-blue-600">
                            {formatPrice(pack.price, 'TND')}
                          </span>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-0">
                      <div className="space-y-6">
                        <ul className="space-y-4">
                          {pack.features.map((feature, index) => (
                            <li key={index} className="flex items-start space-x-4">
                              <Check className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                              <span className="text-gray-700 leading-relaxed">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        <Button className="btn-primary w-full h-14 text-lg font-semibold" asChild>
                          <Link href="/bilan-gratuit">Réserver ce Pack</Link>
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}

                {/* Pack Candidat Libre */}
                <AccordionItem
                  value="candidat-libre"
                  className="border border-gray-200 rounded-xl px-6"
                >
                  <AccordionTrigger className="text-left hover:no-underline py-6">
                    <div className="flex justify-between items-center w-full mr-4">
                      <div>
                        <h4 className="font-semibold text-xl text-gray-900">
                          Pack Spécial Candidat Libre
                        </h4>
                        <p className="text-gray-600 mt-2">
                          Accompagnement sur-mesure pour candidats libres
                        </p>
                      </div>
                      <span className="text-2xl font-bold text-blue-600">Devis personnalisé</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-0">
                    <div className="space-y-6">
                      <p className="text-gray-700 leading-relaxed">
                        Un accompagnement sur-mesure pour les élèves en Terminale ou Première
                        passant le <span className="text-blue-600 font-semibold">Baccalauréat</span>{' '}
                        en candidat libre. Inclut un plan de travail personnalisé, des sessions de
                        suivi hebdomadaires, et un accès complet à la plateforme et à ARIA.
                      </p>
                      <ul className="space-y-4">
                        <li className="flex items-start space-x-4">
                          <Check className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                          <span className="text-gray-700 leading-relaxed">
                            Plan de travail 100% personnalisé
                          </span>
                        </li>
                        <li className="flex items-start space-x-4">
                          <Check className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                          <span className="text-gray-700 leading-relaxed">
                            Sessions de suivi hebdomadaires
                          </span>
                        </li>
                        <li className="flex items-start space-x-4">
                          <Check className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                          <span className="text-gray-700 leading-relaxed">
                            Accès complet plateforme + ARIA toutes matières
                          </span>
                        </li>
                        <li className="flex items-start space-x-4">
                          <Check className="w-6 h-6 text-green-500 mt-1 flex-shrink-0" />
                          <span className="text-gray-700 leading-relaxed">
                            Préparation spécifique aux épreuves
                          </span>
                        </li>
                      </ul>
                      <Button className="btn-primary w-full h-14 text-lg font-semibold" asChild>
                        <Link href="/contact">Contactez-nous pour un bilan et un devis adapté</Link>
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
