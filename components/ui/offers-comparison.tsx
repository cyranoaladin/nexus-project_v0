'use client';

import { motion } from 'framer-motion';
import { Brain, Check, Crown, Rocket, Star, X } from 'lucide-react';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardHeader, CardTitle } from './card';
import { GuaranteeSeal } from './guarantee-seal';

interface ComparisonFeature {
  name: string;
  cortex: boolean | string;
  academies: boolean | string;
  odyssee: boolean | string;
}

const features: ComparisonFeature[] = [
  { name: "Accès à l'IA ARIA", cortex: true, academies: false, odyssee: true },
  { name: "Cours en ligne", cortex: false, academies: false, odyssee: true },
  { name: "Cours en centre", cortex: false, academies: true, odyssee: true },
  { name: "Coach référent", cortex: false, academies: true, odyssee: true },
  { name: "Plateforme pédagogique", cortex: true, academies: true, odyssee: true },
  { name: "Suivi personnalisé", cortex: true, academies: true, odyssee: true },
  { name: "Ressources exclusives", cortex: true, academies: true, odyssee: true },
  { name: "Simulateurs d'examens", cortex: true, academies: true, odyssee: true },
  { name: "Dashboard de progression", cortex: true, academies: true, odyssee: true },
  { name: "Support 24/7", cortex: true, academies: true, odyssee: true },
  { name: "Garantie de réussite", cortex: false, academies: false, odyssee: true },
  { name: "Mention garantie", cortex: false, academies: false, odyssee: true }
];

const plans = [
  {
    name: "Nexus Cortex",
    icon: Brain,
    color: "from-blue-600 to-cyan-500",
    price: "90 TND/mois",
    description: "IA prédictive pour optimiser votre préparation",
    popular: false,
    credits: "20 Crédits/mois",
    valueBreakdown: "Inclus : 20 crédits (valeur 140 TND) + Accès ARIA (valeur 50 TND). Valeur totale : 190 TND, votre prix : 90 TND.",
    dailyCost: "soit ~3 TND/jour"
  },
  {
    name: "Académies Nexus",
    icon: Rocket,
    color: "from-green-600 to-emerald-500",
    price: "450 TND/mois",
    description: "Stages spécialisés avec nos experts",
    popular: true,
    credits: "40 Crédits/mois",
    valueBreakdown: "Inclus : 40 crédits (valeur 280 TND) + Accès Plateforme & Coaching (valeur 250 TND). Valeur totale : 530 TND, votre prix : 450 TND.",
    dailyCost: "soit ~15 TND/jour"
  },
  {
    name: "Programme Odyssée",
    icon: Crown,
    color: "from-blue-700 to-slate-700",
    price: "750 TND/mois",
    description: "Accompagnement complet vers l'excellence",
    popular: false,
    credits: "80 Crédits/mois",
    valueBreakdown: "Inclus : 80 crédits (valeur 560 TND) + Coaching Premium & Garantie (valeur 390 TND). Valeur totale : 950 TND, votre prix : 750 TND.",
    dailyCost: "soit ~25 TND/jour"
  }
];

export function OffersComparison() {
  return (
    <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <Badge variant="outline" className="mb-4 bg-blue-50 text-blue-700 border-blue-200">
            <Star className="w-4 h-4 mr-2" />
            Comparaison des Offres
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-4">
            Choisissez Votre Parcours de Réussite
          </h2>
          <p className="text-lg text-gris-noble max-w-3xl mx-auto">
            Comparez nos trois univers pour trouver la solution qui correspond le mieux à vos besoins et objectifs.
          </p>
        </motion.div>

        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* En-têtes des plans */}
            <div className="grid grid-cols-4 gap-4 mb-8">
              <div className="text-center">
                <h3 className="font-bold text-bleu-nuit mb-2">Fonctionnalités</h3>
              </div>
              {plans.map((plan, index) => (
                <motion.div
                  key={plan.name}
                  className="text-center relative"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className={`border-2 transition-all duration-300 hover:shadow-xl ${plan.popular ? 'border-or-stellaire shadow-lg' : 'border-gray-200'}`}>
                    <CardHeader className="text-center pb-3 px-3 pt-6 relative">
                      {plan.popular && (
                        <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-or-stellaire text-bleu-nuit border-0 text-xs px-2 py-1 whitespace-nowrap">
                          Le plus populaire
                        </Badge>
                      )}

                      {/* Sceau de garantie pour les offres premium */}
                      {(plan.name === "Programme Odyssée" || plan.name === "Académies Nexus") && (
                        <div className="absolute top-2 right-2">
                          <GuaranteeSeal size="sm" />
                        </div>
                      )}

                      <div className="flex justify-center mb-2">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${plan.color} flex items-center justify-center`}>
                          <plan.icon className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <CardTitle className="text-sm font-bold text-bleu-nuit mb-1">
                        {plan.name}
                      </CardTitle>
                      <div className="space-y-1">
                        <p className="text-lg font-bold text-or-stellaire">
                          {plan.price}
                        </p>
                        <p className="text-xs text-gris-noble mb-1">
                          {plan.description}
                        </p>
                        <div className="bg-blue-50 p-2 rounded border border-blue-200">
                          <p className="text-xs font-semibold text-blue-800">
                            {plan.credits}
                          </p>
                          <p className="text-xs text-blue-600 leading-tight">
                            {plan.valueBreakdown}
                          </p>
                          <p className="text-xs text-blue-600 font-medium">
                            {plan.dailyCost}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Fonctionnalités */}
            <div className="space-y-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: index * 0.05 }}
                  viewport={{ once: true }}
                  className="grid grid-cols-4 gap-4 items-center p-4 bg-white rounded-lg border border-gray-100 hover:shadow-md transition-all duration-200"
                >
                  <div className="font-medium text-bleu-nuit">
                    {feature.name}
                  </div>
                  <div className="text-center">
                    {feature.cortex === true ? (
                      <Check className="w-5 h-5 text-green-600 mx-auto" />
                    ) : feature.cortex === false ? (
                      <X className="w-5 h-5 text-slate-500 mx-auto" />
                    ) : (
                      <span className="text-sm text-gris-noble">{feature.cortex}</span>
                    )}
                  </div>
                  <div className="text-center">
                    {feature.academies === true ? (
                      <Check className="w-5 h-5 text-green-600 mx-auto" />
                    ) : feature.academies === false ? (
                      <X className="w-5 h-5 text-slate-500 mx-auto" />
                    ) : (
                      <span className="text-sm text-gris-noble">{feature.academies}</span>
                    )}
                  </div>
                  <div className="text-center">
                    {feature.odyssee === true ? (
                      <Check className="w-5 h-5 text-green-600 mx-auto" />
                    ) : feature.odyssee === false ? (
                      <X className="w-5 h-5 text-slate-500 mx-auto" />
                    ) : (
                      <span className="text-sm text-gris-noble">{feature.odyssee}</span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <motion.div
              className="text-center mt-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <p className="text-lg text-gris-noble mb-6">
                Besoin d'aide pour choisir ? Consultez nos experts gratuitement.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button className="bg-or-stellaire hover:bg-or-stellaire-dark text-bleu-nuit font-bold transition-all duration-200 hover:scale-105">
                  Consultation Gratuite
                </Button>
                <Button variant="outline" className="border-bleu-nuit text-bleu-nuit hover:bg-bleu-nuit hover:text-white transition-all duration-200 hover:scale-105">
                  Comparer en Détail
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
