'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Crown } from 'lucide-react';
import { Badge } from './badge';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { ExpertProfile } from './expert-profile';

interface SpecializedPack {
  name: string;
  description: string;
  price: string;
  duration: string;
  features: string[];
  expert: {
    pseudonyme: string;
    titre: string;
    citation: string;
    specialites: string[];
  };
  popular?: boolean;
}

const specializedPacks: SpecializedPack[] = [
  {
    name: "Pack Grand Oral",
    description: "Maîtrisez l'art de l'éloquence et de la persuasion pour le Grand Oral du Bac",
    price: "300 TND",
    duration: "8 heures",
    features: [
      "Techniques de prise de parole",
      "Construction d'un exposé structuré",
      "Gestion du stress et de la voix",
      "Simulations d'oraux blancs",
      "Feedback personnalisé"
    ],
    expert: {
      pseudonyme: "Oratora",
      titre: "Coach en Prise de Parole & Rhétorique",
      citation: "Une idée brillante mal exprimée est une idée perdue. Je ne vous entraîne pas à réciter, je vous entraîne à convaincre.",
      specialites: ["Grand Oral", "Prise de parole", "Argumentation"]
    },
    popular: true
  },
  {
    name: "Pack Candidat Libre",
    description: "Votre établissement privé à domicile pour obtenir votre Bac en toute sérénité",
    price: "1200 TND",
    duration: "Accompagnement complet",
    features: [
      "Programme personnalisé sur mesure",
      "Suivi hebdomadaire avec coach dédié",
      "Accès à la plateforme pédagogique",
      "Simulateurs d'examens",
      "Garantie de réussite"
    ],
    expert: {
      pseudonyme: "Vector",
      titre: "Coach Certifié en Mathématiques",
      citation: "Un problème de Bac est un jeu avec des règles précises. Je ne vous apprends pas seulement à jouer, je vous apprends à gagner en anticipant chaque coup.",
      specialites: ["Candidat Libre", "Accompagnement personnalisé", "Méthodologie"]
    }
  },
  {
    name: "Pack Parcoursup",
    description: "Construisez un dossier d'excellence et maximisez vos chances d'admission",
    price: "450 TND",
    duration: "6 heures",
    features: [
      "Analyse de votre profil",
      "Stratégie de choix d'orientation",
      "Rédaction de CV et lettre de motivation",
      "Préparation aux entretiens",
      "Simulation de jury"
    ],
    expert: {
      pseudonyme: "Prospect",
      titre: "Conseiller en Stratégie d'Orientation",
      citation: "Parcoursup n'est pas une destination, c'est un point de départ. Mon rôle est de m'assurer que ce départ soit parfaitement aligné avec qui vous êtes et qui vous voulez devenir.",
      specialites: ["Orientation", "Parcoursup", "Stratégie d'admission"]
    }
  }
];

export function SpecializedPacks() {
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
          <Badge variant="outline" className="mb-4 bg-purple-50 text-purple-700 border-purple-200">
            <Crown className="w-4 h-4 mr-2" />
            Packs Spécialisés
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-4">
            Nos Programmes d'Excellence
          </h2>
          <p className="text-lg text-gris-noble max-w-3xl mx-auto">
            Des parcours sur mesure animés par nos experts pour répondre à vos besoins spécifiques
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {specializedPacks.map((pack, index) => (
            <motion.div
              key={pack.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className={`h-full border-2 transition-all duration-300 hover:shadow-xl hover:scale-105 ${pack.popular ? 'border-or-stellaire shadow-lg' : 'border-gray-200'
                }`}>
                <CardHeader className="pb-4">
                  {pack.popular && (
                    <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-or-stellaire text-bleu-nuit border-0">
                      Recommandé
                    </Badge>
                  )}
                  <CardTitle className="text-xl font-bold text-bleu-nuit mb-2">
                    {pack.name}
                  </CardTitle>
                  <p className="text-gris-noble text-sm mb-4">
                    {pack.description}
                  </p>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-2xl font-bold text-or-stellaire">
                        {pack.price}
                      </p>
                      <p className="text-sm text-gris-noble">
                        {pack.duration}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    {pack.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center space-x-2">
                        <div className="w-1.5 h-1.5 bg-or-stellaire rounded-full"></div>
                        <span className="text-sm text-gris-noble">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* Profil de l'expert */}
                  <ExpertProfile
                    pseudonyme={pack.expert.pseudonyme}
                    titre={pack.expert.titre}
                    citation={pack.expert.citation}
                    specialites={pack.expert.specialites}
                    className="mb-4"
                  />

                  <Button
                    className="w-full bg-or-stellaire hover:bg-or-stellaire-dark text-bleu-nuit font-bold transition-all duration-300 hover:scale-105"
                  >
                    Découvrir ce pack
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
