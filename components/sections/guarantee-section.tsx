"use client";

import { motion } from "framer-motion";
import { Award, Shield, Star } from "lucide-react";
import Image from "next/image";

export function GuaranteeSection() {
  return (
    <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="max-w-7xl mx-auto"
        >
          <div className="card-premium border-t-4 border-blue-600 relative overflow-hidden">
            {/* Effet de brillance */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-blue-600 to-indigo-600"></div>

            <div className="grid lg:grid-cols-2 gap-12 items-center p-12">
              {/* Colonne de gauche - Contenu textuel */}
              <div>
                {/* Icône principale */}
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  viewport={{ once: true }}
                  className="mb-8"
                >
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full">
                    <Award className="w-12 h-12 text-blue-600" />
                  </div>
                </motion.div>

                {/* Titre principal */}
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  viewport={{ once: true }}
                  className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6"
                >
                  Notre Engagement est Votre Réussite
                </motion.h2>

                {/* Paragraphe central */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                  viewport={{ once: true }}
                  className="text-xl text-gray-700 mb-8 leading-relaxed"
                >
                  Nous sommes tellement convaincus de l'excellence de notre écosystème que nous lions notre succès au vôtre.
                </motion.p>

                {/* Bloc de garantie principal */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  viewport={{ once: true }}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white mb-8 shadow-inner"
                >
                  <div className="flex items-center mb-6">
                    <Shield className="w-8 h-8 mr-4" />
                    <h4 className="text-2xl md:text-3xl font-bold">
                      Garantie "Bac Obtenu ou Remboursé Intégralement"
                    </h4>
                  </div>

                  <p className="text-blue-100 text-lg leading-relaxed">
                    Si votre enfant, inscrit à notre formule annuelle "Immersion" ou "Candidat Libre",
                    suit assidûment notre programme et n'obtient pas son Baccalauréat, nous vous
                    remboursons l'intégralité des frais de scolarité de l'année.
                  </p>
                </motion.div>

                {/* Mention légale */}
                <motion.p
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                  viewport={{ once: true }}
                  className="text-sm text-gray-500"
                >
                  *Soumis à conditions de participation et de validation du parcours de suivi.
                  Voir nos conditions générales de vente.
                </motion.p>
              </div>

              {/* Colonne de droite - Sceau de garantie */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                viewport={{ once: true }}
                className="flex justify-center lg:justify-end"
              >
                <div className="relative">
                  <Image
                    src="/images/BlasonConfiance_SceauGarantie.png"
                    alt="Sceau de Garantie Nexus Réussite"
                    width={400}
                    height={400}
                    className="w-full h-auto max-w-md drop-shadow-2xl"
                  />
                  {/* Effet de brillance sur l'image */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent rounded-full"></div>
                </div>
              </motion.div>
            </div>

            {/* Avantages supplémentaires - Maintenant en bas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              viewport={{ once: true }}
              className="grid md:grid-cols-3 gap-6 px-12 pb-12"
            >
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                  <Star className="w-6 h-6 text-blue-600" />
                </div>
                <h5 className="font-semibold text-gray-900 mb-2">Excellence Garantie</h5>
                <p className="text-gray-600 text-sm">
                  Notre équipe d'experts s'engage personnellement sur vos résultats
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <h5 className="font-semibold text-gray-900 mb-2">Sécurité Totale</h5>
                <p className="text-gray-600 text-sm">
                  Votre investissement est protégé par notre garantie unique
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4">
                  <Award className="w-6 h-6 text-blue-600" />
                </div>
                <h5 className="font-semibold text-gray-900 mb-2">Confiance Mutuelle</h5>
                <p className="text-gray-600 text-sm">
                  Nous partageons les risques pour maximiser votre réussite
                </p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
