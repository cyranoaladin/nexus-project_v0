'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const OFFERS_PREVIEW = [
  {
    id: 'cortex',
    title: 'Nexus Cortex',
    subtitle: 'L\'Intelligence Artificielle au service de votre réussite',
    description: 'Votre tuteur personnel IA, disponible 24/7 pour répondre à vos questions, corriger vos méthodes et vous entraîner avec des quiz sur mesure.',
    whyPoints: [
      'Disponibilité 24/7 sans interruption',
      'Correction instantanée de vos méthodes',
      'Quiz personnalisés selon vos lacunes',
      'Progression mesurée et optimisée'
    ],
    cta: 'Découvrir notre IA',
    iconPath: '/images/Icon_NexusCortex.png',
    iconColor: 'text-purple-600',
    buttonColor: 'bg-purple-600 hover:bg-purple-700',
    gradientBg: 'from-purple-50 to-white',
    isPopular: false
  },
  {
    id: 'flex',
    title: 'Le Studio Flex',
    subtitle: 'La flexibilité absolue pour un accompagnement sur-mesure',
    description: 'Accédez à la demande à nos experts. Réservez un cours individuel, une session de coaching ou un atelier de groupe, précisément quand vous en avez besoin.',
    whyPoints: [
      'Réservation à la demande selon vos besoins',
      'Accès direct à nos experts certifiés',
      'Formats variés : individuel, groupe, coaching',
      'Flexibilité totale dans votre planning'
    ],
    cta: 'Explorer les prestations à la carte',
    iconPath: '/images/Icon_StudioFlex.png',
    iconColor: 'text-orange-500',
    buttonColor: 'bg-orange-500 hover:bg-orange-600',
    gradientBg: 'from-orange-50 to-white',
    isPopular: true
  },
  {
    id: 'academies',
    title: 'Les Académies Nexus',
    subtitle: 'Des stages intensifs pour une progression accélérée',
    description: 'Des stages intensifs pendant chaque vacance scolaire pour maîtriser une matière, préparer une épreuve clé (Bac de Français, Grand Oral) et prendre une avance considérable.',
    whyPoints: [
      'Stages pendant chaque période de vacances',
      'Préparation ciblée des épreuves clés',
      'Progression intensive et mesurable',
      'Avance considérable sur le programme'
    ],
    cta: 'Voir tous nos stages',
    iconPath: '/images/Icon_AcademiesNexus.png',
    iconColor: 'text-purple-600',
    buttonColor: 'bg-purple-600 hover:bg-purple-700',
    gradientBg: 'from-purple-50 to-white',
    isPopular: false
  },
  {
    id: 'odyssee',
    title: 'Le Programme Odyssée',
    subtitle: 'L\'accompagnement annuel intégral vers l\'excellence',
    description: 'L\'accompagnement annuel intégral qui structure toute l\'année de Première ou de Terminale pour viser la mention, sécuriser Parcoursup et réussir en candidat libre.',
    whyPoints: [
      'Structuration complète de votre année scolaire',
      'Accompagnement vers la mention au Bac',
      'Préparation stratégique de Parcoursup',
      'Support intégral pour candidats libres'
    ],
    cta: 'Découvrir les parcours annuels',
    iconPath: '/images/Icon_ProgrammeOdyssee.png',
    iconColor: 'text-orange-500',
    buttonColor: 'bg-orange-500 hover:bg-orange-600',
    gradientBg: 'from-orange-50 to-white',
    isPopular: false
  }
];

export function OffersPreviewSection() {
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
          <Badge variant="outline" className="marketing-badge mb-4 bg-orange-50 text-orange-600 border-orange-200 normal-case">
            <ArrowRight className="w-4 h-4 mr-2" />
            Nos Solutions
          </Badge>
          <h2 className="marketing-section-title-light mb-6">
            Des Parcours Adaptés à Chaque Ambition
          </h2>
          <p className="marketing-section-copy-light max-w-3xl mx-auto">
            Découvrez nos quatre univers de solutions conçus pour répondre précisément à vos besoins,
            que vous soyez élève autonome ou famille en quête d'excellence.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {OFFERS_PREVIEW.map((offer, index) => (
            <motion.div
              key={offer.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Link href={offer.id === 'flex' ? '/offres' : `/offres#${offer.id}`}>
                <motion.div
                  whileHover={{
                    scale: 1.03,
                    y: -8,
                    transition: { duration: 0.2 }
                  }}
                  className="h-full relative"
                >
                  {/* Badge "Le plus populaire" pour Le Studio Flex */}
                  {offer.isPopular && (
                    <div className="absolute -top-3 -right-3 z-10">
                      <Badge className="bg-orange-500 text-white px-3 py-1 font-semibold shadow-lg">
                        Le plus populaire
                      </Badge>
                    </div>
                  )}

                  <Card className={`h-full border-0 shadow-xl hover:shadow-2xl bg-gradient-to-br ${offer.gradientBg} transition-all duration-300 cursor-pointer group relative overflow-hidden`}>
                    <CardHeader className="pb-4">
                      {/* Icône thématique centrée en haut avec couleur personnalisée */}
                      <div className="flex justify-center mb-6">
                        <div className={`p-3 rounded-full bg-white shadow-md ${offer.iconColor}`}>
                          <Image
                            src={offer.iconPath}
                            alt={offer.title}
                            width={56}
                            height={56}
                            className="w-14 h-14 group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>
                      </div>

                      <div className="text-center">
                        {/* Titre principal avec Poppins Bold et taille augmentée */}
                        <h3 className="font-heading text-2xl font-bold text-gray-900 mb-2 group-hover:text-orange-600 transition-colors duration-300">
                          {offer.title}
                        </h3>

                        {/* Sous-titre en italique avec taille augmentée */}
                        <h4 className="text-lg italic text-gray-700 mb-4">
                          {offer.subtitle}
                        </h4>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      {/* Description avec police Inter */}
                      <p className="text-gray-600 mb-6 leading-relaxed">
                        {offer.description}
                      </p>

                      {/* Liste "Pourquoi" avec icônes Check vertes */}
                      <div className="mb-6">
                        <div className="text-sm font-semibold text-gray-900 mb-3">
                          Pourquoi choisir cette solution ?
                        </div>
                        <ul className="space-y-2">
                          {offer.whyPoints.map((point, pointIndex) => (
                            <li key={pointIndex} className="flex items-start">
                              <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-gray-700">
                                {point}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Bouton avec couleur personnalisée par univers */}
                      <Button
                        className={`w-full ${offer.buttonColor} text-white font-bold group-hover:shadow-lg transition-all duration-300`}
                        size="lg"
                      >
                        {offer.cta}
                        <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Bouton global en style secondaire */}
        <motion.div
          className="text-center mt-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <Link href="/offres">
            <Button
              variant="outline"
              size="lg"
              className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-bold"
            >
              Voir Toutes Nos Offres
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
