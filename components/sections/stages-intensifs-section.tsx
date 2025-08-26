'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowRight, BrainCircuit, Clock, Target, Users } from 'lucide-react';
import Link from 'next/link';

export function StagesIntensifsSection() {
  return (
    <section className="py-20 bg-slate-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* En-tête */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-white mb-6">
            Nos <span className="text-blue-300">Stages Intensifs</span> : Prenez une Longueur
            d'Avance
          </h2>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto">
            Pendant les vacances, nous transformons le temps en une opportunité. 10 jours pour
            consolider, approfondir et exceller avant la rentrée.
          </p>
        </motion.div>

        {/* Stage d'Excellence */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <Card className="bg-white border-slate-200 shadow-xl">
            <CardHeader className="text-center pb-6">
              <Badge variant="default" className="mb-4 mx-auto">
                <Target className="w-4 h-4 mr-2" />
                Stage d'Été 2025
              </Badge>
              <CardTitle className="font-heading text-2xl font-bold text-slate-900 mb-2">
                Stage d'Excellence - Spécial Rentrée
              </CardTitle>
              <div className="text-lg font-semibold text-blue-600">
                Du lundi 16 au vendredi 27 août
              </div>
            </CardHeader>

            <CardContent className="space-y-8">
              {/* Caractéristiques */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 mt-1">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Groupes de Niveau Homogènes</h4>
                      <p className="text-sm text-slate-600">(sélection après bilan)</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 mt-1">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        20 Heures de Cours en Profondeur
                      </h4>
                      <p className="text-sm text-slate-600">(2h/jour)</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 mt-1">
                      <BrainCircuit className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">
                        Focus sur la Méthodologie du Bac
                      </h4>
                      <p className="text-sm text-slate-600">Techniques d'examen éprouvées</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 mt-1">
                      <Target className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">Matière au choix</h4>
                      <p className="text-sm text-slate-600">Maths, Physique-Chimie ou NSI</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tarif et CTA */}
              <div className="bg-slate-50 rounded-xl p-6 text-center">
                <div className="mb-4">
                  <span className="text-4xl md:text-5xl font-bold text-slate-900">850 TND</span>
                  <span className="text-slate-600 ml-2 text-lg">(paiement unique)</span>
                </div>

                <Button
                  asChild
                  size="lg"
                  className="bg-red-500 hover:bg-red-600 text-white font-semibold group"
                >
                  <Link href="/contact">
                    Je réserve ma place
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>

                <p className="text-xs text-slate-500 mt-3">
                  Places limitées - Inscription sur entretien préalable
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
