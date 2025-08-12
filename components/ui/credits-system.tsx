'use client';

import { motion } from 'framer-motion';
import { Calculator, Clock, Users, Zap } from 'lucide-react';
import { Badge } from './badge';
import { Card, CardContent, CardHeader, CardTitle } from './card';

interface CreditPrestation {
  prestation: string;
  credits: number;
  description: string;
  icon: React.ComponentType<any>;
}

const prestations: CreditPrestation[] = [
  {
    prestation: "Cours Particulier en Ligne (1h)",
    credits: 10,
    description: "Séance individuelle avec un expert",
    icon: Zap
  },
  {
    prestation: "Cours Particulier en Centre (1h)",
    credits: 12,
    description: "Séance en présentiel avec matériel",
    icon: Users
  },
  {
    prestation: "Atelier Thématique en Groupe (2h)",
    credits: 15,
    description: "Session spécialisée en petit groupe",
    icon: Clock
  }
];

export function CreditsSystem() {
  return (
    <section className="py-20 bg-gradient-to-br from-blue-50 to-cyan-50">
      <div className="container mx-auto px-4">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <Badge variant="outline" className="mb-4 bg-blue-50 text-blue-700 border-blue-200">
            <Calculator className="w-4 h-4 mr-2" />
            Comment ça marche ?
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-4">
            Notre Système de Crédits Nexus
          </h2>
          <p className="text-lg text-gris-noble max-w-3xl mx-auto">
            Un système simple et transparent pour accéder à l'excellence éducative
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto">
          {/* Explication du système */}
          <motion.div
            className="mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50">
              <CardHeader className="text-center">
                <CardTitle className="text-xl font-bold text-bleu-nuit mb-4">
                  Le Principe Simple
                </CardTitle>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center mx-auto mb-3">
                      <Calculator className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-semibold text-bleu-nuit mb-2">1. Abonnement</h3>
                    <p className="text-sm text-gris-noble">
                      Choisissez votre formule et recevez vos crédits mensuels
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-or-stellaire flex items-center justify-center mx-auto mb-3">
                      <Zap className="w-6 h-6 text-bleu-nuit" />
                    </div>
                    <h3 className="font-semibold text-bleu-nuit mb-2">2. Crédits</h3>
                    <p className="text-sm text-gris-noble">
                      Utilisez vos crédits pour accéder aux prestations
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-semibold text-bleu-nuit mb-2">3. Excellence</h3>
                    <p className="text-sm text-gris-noble">
                      Progressez avec nos experts et notre plateforme
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Tableau des prestations */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <Card className="border-2 border-gray-200">
              <CardHeader>
                <CardTitle className="text-center text-xl font-bold text-bleu-nuit">
                  Tarification des Prestations
                </CardTitle>
                <p className="text-center text-gris-noble">
                  Système de crédits en base 10 pour plus de clarté
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-4 px-6 font-semibold text-bleu-nuit">
                          Prestation
                        </th>
                        <th className="text-center py-4 px-6 font-semibold text-bleu-nuit">
                          Coût en Crédits Nexus
                        </th>
                        <th className="text-center py-4 px-6 font-semibold text-bleu-nuit">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {prestations.map((prestation, index) => (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-6">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                                <prestation.icon className="w-4 h-4 text-white" />
                              </div>
                              <span className="font-medium text-bleu-nuit">
                                {prestation.prestation}
                              </span>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-center">
                            <Badge className="bg-or-stellaire text-bleu-nuit font-bold text-lg px-4 py-2">
                              {prestation.credits} Crédits
                            </Badge>
                          </td>
                          <td className="py-4 px-6 text-center text-gris-noble">
                            {prestation.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Avantages du système */}
          <motion.div
            className="mt-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            viewport={{ once: true }}
          >
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="border-2 border-green-200 bg-green-50">
                <CardContent className="text-center p-6">
                  <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
                    <Calculator className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-bleu-nuit mb-2">Transparent</h3>
                  <p className="text-sm text-gris-noble">
                    Prix clairs et prévisibles, pas de surprise
                  </p>
                </CardContent>
              </Card>
              <Card className="border-2 border-blue-200 bg-blue-50">
                <CardContent className="text-center p-6">
                  <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-bleu-nuit mb-2">Flexible</h3>
                  <p className="text-sm text-gris-noble">
                    Utilisez vos crédits selon vos besoins
                  </p>
                </CardContent>
              </Card>
              <Card className="border-2 border-purple-200 bg-purple-50">
                <CardContent className="text-center p-6">
                  <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-bleu-nuit mb-2">Professionnel</h3>
                  <p className="text-sm text-gris-noble">
                    Système adapté aux standards internationaux
                  </p>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
