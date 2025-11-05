"use client"

import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Trophy, Users, Calendar, Award } from "lucide-react"
import Link from "next/link"

export function CandidatLibreSection() {
  const features = [
    "Accès Illimité à la Plateforme & ARIA+ (Toutes matières)",
    "Un budget annuel de 90 Crédits de cours (équivalent à ~2h de suivi par semaine)",
    "Un Coach Pédagogique Principal pour le suivi stratégique hebdomadaire",
    "Accès inclus au Pack Grand Oral",
    "Accès inclus au Pack Orientation & Parcoursup"
  ]

  return (
    <section className="py-20 bg-blue-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="default" className="mb-4">
            <Trophy className="w-4 h-4 mr-2" />
            Solution Premium
          </Badge>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Pack <span className="text-blue-600">Réussite Candidat Libre</span>
          </h2>
          <p className="text-xl text-slate-900 max-w-3xl mx-auto">
            La solution annuelle tout-en-un pour préparer le <span className="text-blue-600 font-semibold">Baccalauréat</span> en candidat libre 
            avec la structure, le soutien et l'expertise d\'un établissement d\'excellence.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          viewport={{ once: true }}
          className="max-w-4xl mx-auto"
        >
          <Card className="bg-white border-2 border-slate-900 shadow-2xl relative overflow-hidden">
            {/* Badge Premium */}
            <div className="absolute top-0 right-0 bg-red-500 text-white px-4 py-2 text-sm font-semibold">
              🏆 Accompagnement Annuel Complet
            </div>
            
            <CardHeader className="text-center pb-6 pt-12">
              <CardTitle className="font-heading text-2xl font-bold text-slate-900 mb-4">
                Pack Réussite Candidat Libre
              </CardTitle>
              <div className="space-y-2">
                <div className="text-4xl font-bold text-blue-600">7200 TND</div>
                <div className="text-slate-600">Payable en 3 fois sans frais</div>
                <div className="text-sm text-slate-500">(3 x 2400 TND)</div>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-8">
              {/* Contenu du Pack */}
              <div className="space-y-4">
                <h3 className="font-heading font-semibold text-lg text-slate-900 text-center mb-6">
                  Contenu du Pack Annuel
                </h3>
                
                <div className="grid gap-4">
                  {features.map((feature, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      viewport={{ once: true }}
                      className="flex items-start space-x-3 p-3 rounded-lg bg-blue-50"
                    >
                      <Check className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-slate-900 text-sm font-medium">{feature}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Avantages Exclusifs */}
              <div className="bg-slate-50 rounded-xl p-6">
                <h4 className="font-semibold text-slate-900 mb-4 text-center">
                  ✨ Avantages Exclusifs Candidat Libre
                </h4>
                <div className="grid md:grid-cols-3 gap-4 text-center">
                  <div className="space-y-2">
                    <Users className="w-8 h-8 text-blue-600 mx-auto" />
                    <p className="text-sm font-medium text-slate-900">Suivi Personnalisé</p>
                  </div>
                  <div className="space-y-2">
                    <Calendar className="w-8 h-8 text-blue-600 mx-auto" />
                    <p className="text-sm font-medium text-slate-900">Planning Adapté</p>
                  </div>
                  <div className="space-y-2">
                    <Award className="w-8 h-8 text-blue-600 mx-auto" />
                    <p className="text-sm font-medium text-slate-900">Garantie Réussite</p>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <div className="text-center">
                <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700 font-semibold">
                  <Link href="/contact">
                    Demander un entretien
                  </Link>
                </Button>
                <p className="text-xs text-slate-500 mt-3">
                  Ce pack nécessite un entretien préalable pour personnaliser l'accompagnement
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  )
}