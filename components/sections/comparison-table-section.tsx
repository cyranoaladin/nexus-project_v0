"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function ComparisonTableSection() {
  const comparisonData = [
    {
      criteria: "Profil des Enseignants",
      standard: "Souvent des \"répétiteurs\" non certifiés.",
      nexus: "Agrégés & Certifiés de l'Éducation Nationale Française."
    },
    {
      criteria: "Connaissance du Programme",
      standard: "Maîtrise approximative des attentes.",
      nexus: "Nos coachs ont enseigné dans des lycées français à l'étranger."
    },
    {
      criteria: "Expertise NSI",
      standard: "Pas de qualification spécifique requise.",
      nexus: "Titulaires du DIU NSI (diplôme officiel)."
    },
    {
      criteria: "Approche Pédagogique",
      standard: "Du bachotage répétitif.",
      nexus: "Pédagogie individualisée qui développe l'autonomie."
    },
    {
      criteria: "Aide 24/7",
      standard: "Inexistante.",
      nexus: "Plateforme intelligente & IA ARIA."
    },
    {
      criteria: "Préparation à l'Orientation",
      standard: "Service séparé, si proposé.",
      nexus: "Intégrée à notre écosystème \"tout-en-un\"."
    },
    {
      criteria: "Garantie de Réussite",
      standard: "Aucune.",
      nexus: "Garantie \"Bac Obtenu ou Remboursé\"."
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
            La Différence Nexus en Détail
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Une comparaison factuelle qui démontre pourquoi nous sommes le choix de l'excellence
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="max-w-6xl mx-auto"
        >
          <div className="card-enhanced overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-6 px-6 font-bold text-lg text-gray-900">
                      Critère d'Exigence
                    </th>
                    <th className="text-center py-6 px-6 font-bold text-lg text-gray-600">
                      Le Soutien Scolaire Standard
                    </th>
                    <th className="text-center py-6 px-6">
                      <span className="bg-blue-50 text-blue-700 p-3 rounded-lg font-bold text-lg">
                        L'Excellence Nexus Réussite
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, index) => (
                    <motion.tr
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="py-6 px-6 font-semibold text-gray-900">
                        {row.criteria}
                      </td>
                      <td className="py-6 px-6 text-center">
                        <div className="flex items-center justify-center space-x-3">
                          <X className="w-5 h-5 text-red-500" />
                          <span className="text-gray-600">{row.standard}</span>
                        </div>
                      </td>
                      <td className="py-6 px-6 text-center">
                        <div className="flex items-center justify-center space-x-3">
                          <Check className="w-5 h-5 text-blue-600" />
                          <span className="text-blue-800 font-medium">{row.nexus}</span>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Call to Action intégré */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            viewport={{ once: true }}
            className="mt-12 text-center"
          >
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-4">
                Prêt à Découvrir la Différence ?
              </h3>
              <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
                Rejoignez les familles qui ont fait le choix de l'excellence et transformé le parcours scolaire de leur enfant.
              </p>
              <Button asChild className="bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 px-8 py-4 rounded-xl font-semibold text-lg">
                <Link href="/offres">
                  Découvrir Nos Offres
                </Link>
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
