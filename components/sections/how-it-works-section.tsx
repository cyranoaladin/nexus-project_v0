"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, CreditCard, MessageCircle, TrendingUp, UserPlus, Users } from "lucide-react";
import Link from "next/link";

const STEPS = [
  {
    number: "01",
    icon: UserPlus,
    title: "Bilan Stratégique Gratuit",
    description: "Créez votre compte et celui de votre enfant en quelques minutes. Notre équipe analyse le profil et vous contacte sous 24h.",
    phase: "discovery"
  },
  {
    number: "02",
    icon: CreditCard,
    title: "Choisissez Votre Formule",
    description: "Sélectionnez l'abonnement qui correspond à vos besoins. Chaque formule inclut un budget mensuel de crédits.",
    phase: "discovery"
  },
  {
    number: "03",
    icon: Calendar,
    title: "Réservez Vos Sessions",
    description: "Utilisez vos crédits pour réserver des cours particuliers, ateliers ou sessions de coaching selon vos disponibilités.",
    phase: "action"
  },
  {
    number: "04",
    icon: Users,
    title: "Rencontrez Vos Coachs",
    description: "Nos experts vous accompagnent avec des méthodes personnalisées, en ligne ou en présentiel selon vos préférences.",
    phase: "action"
  },
  {
    number: "05",
    icon: MessageCircle,
    title: "ARIA, Votre IA 24/7",
    description: "Posez vos questions à tout moment à ARIA, notre assistant IA entraîné sur nos contenus pédagogiques exclusifs.",
    phase: "follow"
  },
  {
    number: "06",
    icon: TrendingUp,
    title: "Suivez Vos Progrès",
    description: "Tableau de bord complet, rapports détaillés, badges de progression et communication fluide avec vos coachs.",
    phase: "follow"
  }
];

export function HowItWorksSection() {
  const getStepColor = (phase: string) => {
    switch (phase) {
      case 'discovery':
        return 'text-blue-600';
      case 'action':
        return 'text-red-500';
      case 'follow':
        return 'text-slate-900';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <section className="bg-gradient-to-br from-blue-50 to-indigo-50/50 py-24">
      <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* En-tête */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="default" className="bg-blue-600 text-white mb-6">
            <ArrowRight className="w-4 h-4 mr-2" />
            Comment ça marche ?
          </Badge>
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-gray-900 mb-8 leading-tight">
            Votre Parcours <span className="text-blue-600">"Tout-en-Un"</span> vers la Réussite
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
            Un processus simple et transparent, conçu pour vous accompagner
            de la découverte jusqu'à la <span className="text-blue-600">réussite au Baccalauréat</span> et l'<span className="text-blue-600">excellence à Parcoursup</span>.
          </p>
        </motion.div>

        {/* Timeline verticale */}
        <div className="relative">
          {/* Ligne de timeline */}
          <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 h-full bg-gradient-to-b from-blue-200 via-red-200 to-slate-300"></div>

          {/* Étapes */}
          <div className="space-y-16">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isEven = index % 2 === 1;
              const stepColor = getStepColor(step.phase);

              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, x: isEven ? 50 : -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className={`relative flex items-center ${isEven ? 'flex-row-reverse' : ''}`}
                >
                  {/* Point d'étape (cercle + icône) */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 z-10">
                    <div className="bg-white border-2 border-slate-300 rounded-full w-16 h-16 flex items-center justify-center shadow-lg">
                      <span className={`text-xl font-bold ${stepColor}`}>
                        {step.number}
                      </span>
                    </div>
                  </div>

                  {/* Icône à côté du cercle */}
                  <div className={`absolute left-1/2 transform -translate-x-1/2 z-10 ${isEven ? '-translate-x-20' : 'translate-x-20'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${step.phase === 'discovery' ? 'bg-blue-100' :
                        step.phase === 'action' ? 'bg-red-100' : 'bg-slate-100'
                      }`}>
                      <Icon className={`w-6 h-6 ${stepColor}`} />
                    </div>
                  </div>

                  {/* Carte de contenu */}
                  <div className={`w-5/12 ${isEven ? 'ml-auto pr-20' : 'mr-auto pl-20'}`}>
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, delay: index * 0.1 + 0.2 }}
                      viewport={{ once: true }}
                    >
                      <Card className="bg-blue-50 border-none shadow-md rounded-xl hover:shadow-lg transition-all duration-300">
                        <CardContent className="p-6">
                          <h3 className="font-heading text-xl font-bold text-slate-900 mb-3 leading-tight">
                            {step.title}
                          </h3>
                          <p className="text-slate-700 leading-relaxed">
                            {step.description}
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-20"
        >
          <Card className="bg-white border border-slate-200 shadow-lg rounded-2xl p-12 max-w-4xl mx-auto">
            <CardContent className="p-0">
              <h3 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Prêt à Commencer Votre Transformation ?
              </h3>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
                Rejoignez les centaines de familles qui nous font déjà confiance.
                Votre bilan stratégique gratuit vous attend.
              </p>
              <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white h-16 px-8 text-lg font-semibold group">
                <Link href="/bilan-gratuit">
                  Commencer mon Bilan Stratégique Gratuit
                  <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
