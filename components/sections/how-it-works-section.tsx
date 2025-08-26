'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

const STEPS = [
  {
    number: '01',
    iconPath: '/images/Icon_Etape1_Bilan.png',
    title: 'Bilan Stratégique',
    shortTitle: 'Bilan Gratuit',
  },
  {
    number: '02',
    iconPath: '/images/Icon_Etape2_Formule.png',
    title: 'Choisissez Votre Formule',
    shortTitle: 'Votre Formule',
  },
  {
    number: '03',
    iconPath: '/images/Icon_Etape3_Reservation.png',
    title: 'Réservez Vos Sessions',
    shortTitle: 'Réservation',
  },
  {
    number: '04',
    iconPath: '/images/Icon_Etape4_Coaching.png',
    title: 'Rencontrez Vos Coachs',
    shortTitle: 'Coaching',
  },
  {
    number: '05',
    iconPath: '/images/Icon_Etape5_ARIA.png',
    title: 'ARIA, Votre IA 24/7',
    shortTitle: 'IA ARIA',
  },
  {
    number: '06',
    iconPath: '/images/Icon_Etape6_Progres.png',
    title: 'Suivez Vos Progrès',
    shortTitle: 'Progression',
  },
];

export function HowItWorksSection() {
  return (
    <section className="bg-gradient-to-br from-blue-50 to-indigo-50/50 py-24">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
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
            Un processus simple et transparent, conçu pour vous accompagner de la découverte jusqu'à
            la <span className="text-blue-600">réussite au Baccalauréat</span> et l'
            <span className="text-blue-600">excellence à Parcoursup</span>.
          </p>
        </motion.div>

        {/* Grille horizontale des étapes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 mb-16"
        >
          {STEPS.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="text-center"
            >
              {/* Icône */}
              <div className="flex justify-center mb-4">
                <Image
                  src={step.iconPath}
                  alt={step.title}
                  width={64}
                  height={64}
                  className="w-16 h-16 hover:scale-110 transition-transform duration-300"
                />
              </div>
              {/* Titre court */}
              <h3 className="font-heading text-lg font-bold text-gray-900 mb-2">
                {step.shortTitle}
              </h3>
              {/* Numéro d'étape */}
              <span className="text-sm text-blue-600 font-semibold">Étape {step.number}</span>
            </motion.div>
          ))}
        </motion.div>

        {/* Section Partenariat Familial */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="grid lg:grid-cols-2 gap-12 items-center mb-16"
        >
          {/* Image */}
          <div className="order-2 lg:order-1">
            <Image
              src="/images/Image_PartenariatFamilial.png"
              alt="Un Accompagnement Humain à Chaque Étape"
              width={600}
              height={400}
              className="w-full h-auto rounded-2xl shadow-lg"
            />
          </div>
          {/* Contenu */}
          <div className="order-1 lg:order-2">
            <h3 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Un Accompagnement Humain à Chaque Étape
            </h3>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Notre approche unique combine la puissance de la technologie avec la chaleur humaine.
              À chaque étape de votre parcours, nos experts vous accompagnent personnellement pour
              garantir votre réussite.
            </p>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span className="text-gray-700">Suivi personnalisé par des experts</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span className="text-gray-700">Communication transparente avec les familles</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <span className="text-gray-700">Adaptation continue selon vos besoins</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <Card className="bg-white border border-slate-200 shadow-lg rounded-2xl p-12 max-w-4xl mx-auto">
            <CardContent className="p-0">
              <h3 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Prêt à Commencer Votre Transformation ?
              </h3>
              <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
                Faites le premier pas vers l'excellence. Votre bilan stratégique gratuit vous
                attend.
              </p>
              <Button
                asChild
                className="bg-blue-600 hover:bg-blue-700 text-white h-16 px-8 text-lg font-semibold group"
              >
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
