'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Brain, Check, Crown, Sparkles, X } from 'lucide-react';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';

interface AriaFeature {
  feature: string;
  aria: boolean | string;
  ariaPlus: boolean | string;
}

const ariaFeatures: AriaFeature[] = [
  { feature: "Aide aux devoirs 24/7", aria: true, ariaPlus: true },
  { feature: "Explications personnalisées", aria: true, ariaPlus: true },
  { feature: "Correction d'exercices", aria: true, ariaPlus: true },
  { feature: "Matières disponibles", aria: "1 au choix", ariaPlus: "Toutes disponibles" },
  { feature: "Suivi de progression", aria: false, ariaPlus: true },
  { feature: "Dashboard personnalisé", aria: false, ariaPlus: true },
  { feature: "Simulateur d'oral", aria: false, ariaPlus: true },
  { feature: "Analyses de textes", aria: false, ariaPlus: true },
  { feature: "Préparation aux examens", aria: "Basique", ariaPlus: "Avancée" },
  { feature: "Support prioritaire", aria: false, ariaPlus: true }
];

export function AriaComparison() {
  return (
    <section className="py-20 bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <Badge variant="outline" className="mb-4 bg-purple-50 text-purple-700 border-purple-200">
            <Brain className="w-4 h-4 mr-2" />
            Intelligence Artificielle
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-4">
            Passez à la Vitesse Supérieure avec ARIA+
          </h2>
          <p className="text-lg text-gris-noble max-w-3xl mx-auto">
            Notre IA révolutionnaire s'adapte à votre niveau et vous accompagne vers l'excellence
          </p>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* ARIA Essentiel */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-2 border-blue-200">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4">
                    <Brain className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-bleu-nuit mb-2">
                    ARIA Essentiel
                  </CardTitle>
                  <p className="text-sm text-gris-noble mb-4">
                    Inclus dans tous nos abonnements
                  </p>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p className="text-2xl font-bold text-blue-600">
                      Gratuit
                    </p>
                    <p className="text-xs text-blue-600">
                      Avec votre abonnement
                    </p>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>

            {/* ARIA+ Premium */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-2 border-or-stellaire shadow-lg relative">
                <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-or-stellaire text-bleu-nuit border-0">
                  Recommandé
                </Badge>
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-or-stellaire to-or-stellaire-dark flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-bleu-nuit" />
                  </div>
                  <CardTitle className="text-xl font-bold text-bleu-nuit mb-2">
                    ARIA+ Premium
                  </CardTitle>
                  <p className="text-sm text-gris-noble mb-4">
                    L'expérience ultime d'apprentissage
                  </p>
                  <div className="bg-gradient-to-r from-or-stellaire to-or-stellaire-dark p-4 rounded-lg">
                    <p className="text-2xl font-bold text-bleu-nuit">
                      50 TND/mois
                    </p>
                    <p className="text-xs text-bleu-nuit">
                      Soit ~1,7 TND/jour
                    </p>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>

            {/* Comparaison */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-2 border-purple-200">
                <CardHeader className="text-center pb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4">
                    <Crown className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl font-bold text-bleu-nuit mb-2">
                    Valeur Ajoutée
                  </CardTitle>
                  <p className="text-sm text-gris-noble mb-4">
                    Pourquoi choisir ARIA+ ?
                  </p>
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <p className="text-sm font-semibold text-purple-800">
                      +300% de fonctionnalités
                    </p>
                    <p className="text-xs text-purple-600">
                      Accès illimité à toutes les matières
                    </p>
                  </div>
                </CardHeader>
              </Card>
            </motion.div>
          </div>

          {/* Tableau comparatif */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            viewport={{ once: true }}
          >
            <Card className="border-2 border-gray-200">
              <CardHeader>
                <CardTitle className="text-center text-xl font-bold text-bleu-nuit">
                  Comparaison Détaillée
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-bleu-nuit">
                          Fonctionnalités
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-blue-600">
                          ARIA Essentiel
                        </th>
                        <th className="text-center py-3 px-4 font-semibold text-or-stellaire">
                          ARIA+ Premium
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ariaFeatures.map((feature, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-sm text-gris-noble">
                            {feature.feature}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {typeof feature.aria === 'boolean' ? (
                              feature.aria ? (
                                <Check className="w-5 h-5 text-green-500 mx-auto" />
                              ) : (
                                <X className="w-5 h-5 text-red-500 mx-auto" />
                              )
                            ) : (
                              <span className="text-xs text-blue-600 font-medium">
                                {feature.aria}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {typeof feature.ariaPlus === 'boolean' ? (
                              feature.ariaPlus ? (
                                <Check className="w-5 h-5 text-green-500 mx-auto" />
                              ) : (
                                <X className="w-5 h-5 text-red-500 mx-auto" />
                              )
                            ) : (
                              <span className="text-xs text-or-stellaire font-medium">
                                {feature.ariaPlus}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* CTA */}
          <motion.div
            className="text-center mt-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <Button
              size="lg"
              className="bg-gradient-to-r from-or-stellaire to-or-stellaire-dark hover:from-or-stellaire-dark hover:to-or-stellaire text-bleu-nuit font-bold px-8 py-4 text-lg transition-all duration-300 hover:scale-105 shadow-lg"
            >
              <Sparkles className="w-5 h-5 mr-3" />
              Activer ARIA+ Premium
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-sm text-gris-noble mt-3">
              Débloquez tout le potentiel de notre IA pour 50 TND/mois
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
