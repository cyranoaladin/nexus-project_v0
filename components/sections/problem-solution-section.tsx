'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';

export function ProblemSolutionSection() {
  return (
    <section className="py-16 bg-gradient-to-br from-gray-50 to-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            Le Soutien Scolaire a Évolué. Votre Exigence Aussi.
          </h2>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 max-w-7xl mx-auto">
          {/* Colonne de Gauche - Ancienne Méthode */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            viewport={{ once: true }}
            className="relative flex"
          >
            <div className="card-enhanced bg-gray-50/80 border-gray-300 backdrop-blur-sm relative overflow-hidden flex-1 flex flex-col">
              {/* Effet "vieilli" */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-100/50 to-gray-200/30 pointer-events-none"></div>

              <div className="relative z-10 p-8 flex-1 flex flex-col">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-300/60 rounded-full mb-4">
                    <XCircle className="w-8 h-8 text-gray-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-700 mb-2">L'Ancienne Méthode</h3>
                  <p className="text-gray-600">
                    Le Soutien Scolaire Classique : Les Pièges à Éviter
                  </p>
                </div>

                <div className="space-y-6 flex-1">
                  <div className="flex items-start space-x-4">
                    <XCircle className="w-6 h-6 text-red-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-1">Un Suivi Opaque</h4>
                      <p className="text-gray-600 leading-relaxed">
                        Des heures de cours sans tableau de bord pour mesurer les progrès réels.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <XCircle className="w-6 h-6 text-red-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-1">
                        Des Répétiteurs, pas des Pédagogues
                      </h4>
                      <p className="text-gray-600 leading-relaxed">
                        Souvent des intervenants sans certification ni expérience avérée dans
                        l'Éducation Nationale française.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <XCircle className="w-6 h-6 text-red-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-1">
                        Du Bachotage, pas de l'Apprentissage
                      </h4>
                      <p className="text-gray-600 leading-relaxed">
                        Une mémorisation à court terme qui néglige l'autonomie et les compétences
                        pour le supérieur.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <XCircle className="w-6 h-6 text-red-500 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-800 mb-1">Un Manque de Flexibilité</h4>
                      <p className="text-gray-600 leading-relaxed">
                        Des emplois du temps rigides qui ajoutent du stress au lieu d'en enlever.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Colonne de Droite - Notre Solution */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            viewport={{ once: true }}
            className="relative flex"
          >
            <div className="card-premium relative overflow-hidden flex-1 flex flex-col border-2 border-blue-600 shadow-lg">
              {/* Effet premium */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 pointer-events-none"></div>

              <div className="relative z-10 p-8 flex-1 flex flex-col">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <CheckCircle2 className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-2xl font-bold text-blue-900 mb-2">Notre Révolution</h3>
                  <p className="text-blue-700">
                    L'Écosystème Nexus Réussite : La Solution Tout-en-Un
                  </p>
                </div>

                <div className="space-y-6 flex-1">
                  <div className="flex items-start space-x-4">
                    <CheckCircle2 className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-1">Un Suivi Analytique</h4>
                      <p className="text-blue-800 leading-relaxed">
                        Un dashboard qui mesure l'effort, suit la progression et vous donne une
                        visibilité totale.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <CheckCircle2 className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-1">
                        Des Experts, pas des Amateurs
                      </h4>
                      <p className="text-blue-800 leading-relaxed">
                        Une équipe d'Agrégés, de Certifiés et d'experts de l'enseignement français.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <CheckCircle2 className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-1">
                        Des Compétences, pas du Bachotage
                      </h4>
                      <p className="text-blue-800 leading-relaxed">
                        Une pédagogie qui vise le Bac ET prépare activement aux exigences des études
                        supérieures.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <CheckCircle2 className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-blue-900 mb-1">Une Flexibilité Maximale</h4>
                      <p className="text-blue-800 leading-relaxed">
                        Une plateforme accessible 24/7 et des cours que vous réservez à votre
                        rythme.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
