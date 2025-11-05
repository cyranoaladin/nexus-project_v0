'use client';

import { motion } from 'framer-motion';
import { Beaker, Brain, Calculator, Code, Target, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from './badge';
import { Card, CardContent, CardHeader, CardTitle } from './card';

interface Expert {
  pseudonyme: string;
  titre: string;
  citation: string;
  competences: string[];
  specialites: string[];
  icon: LucideIcon;
  color: string;
}

const experts: Expert[] = [
  {
    pseudonyme: "Axiom",
    titre: "Mentor Agrégé en Mathématiques",
    citation: "La véritable élégance mathématique ne réside pas dans la complexité des calculs, mais dans la pureté du raisonnement. Je vous apprends à construire cette élégance.",
    competences: [
      "Professeur Agrégé de Mathématiques",
      "Spécialiste de l'algèbre abstraite",
      "+20 ans d'expérience en classes préparatoires"
    ],
    specialites: ["Option Maths Expertes", "Préparation aux Concours", "Programme Odyssée"],
    icon: Calculator,
    color: "from-blue-600 to-cyan-500"
  },
  {
    pseudonyme: "Vector",
    titre: "Coach Certifié en Mathématiques Appliquées",
    citation: "Un problème de Bac est un jeu avec des règles précises. Je ne vous apprends pas seulement à jouer, je vous apprends à gagner en anticipant chaque coup.",
    competences: [
      "Professeur Certifié (CAPES) de Mathématiques",
      "Spécialiste de la méthodologie des épreuves",
      "Expert en statistiques et probabilités"
    ],
    specialites: ["Académies des Vacances", "Suivi Hebdomadaire", "Préparation au Bac Blanc"],
    icon: Target,
    color: "from-green-600 to-emerald-500"
  },
  {
    pseudonyme: "Flux",
    titre: "Spécialiste en Physique-Chimie Expérimentale",
    citation: "La science est un dialogue avec la nature. Pour comprendre ses lois, il faut apprendre à lui poser les bonnes questions, paillasse à la main.",
    competences: [
      "Professeur Certifié de Physique-Chimie",
      "Responsable de laboratoire et des épreuves ECE",
      "Expertise en chimie organique"
    ],
    specialites: ["Soutien en Spécialité PC", "Préparation aux Épreuves Pratiques"],
    icon: Beaker,
    color: "from-purple-600 to-pink-500"
  },
  {
    pseudonyme: "Scriptor",
    titre: "Spécialiste des Épreuves Écrites de Français",
    citation: "Chaque texte est une énigme. Je vous donne les clés pour la déchiffrer, analyser sa structure, et révéler sa richesse dans une argumentation claire et structurée.",
    competences: [
      "Professeure Certifiée de Lettres Modernes",
      "Correctrice des épreuves écrites du Bac",
      "Spécialiste de la méthodologie"
    ],
    specialites: ["Grand Oral", "Dissertation", "Commentaire composé"],
    icon: Brain,
    color: "from-orange-600 to-red-500"
  },
  {
    pseudonyme: "Recursiv",
    titre: "Développeur & Pédagogue du Code",
    citation: "Écrire un programme, c'est comme écrire un poème : la beauté réside dans l'efficacité, l'élégance et la clarté. Je vous apprends la syntaxe et la poésie.",
    competences: [
      "Titulaire du DIU 'Enseigner l'Informatique au Lycée'",
      "Ingénieur spécialisé en développement logiciel",
      "Expert en algorithmique et structures de données"
    ],
    specialites: ["Académie Python & NSI", "Projets NSI"],
    icon: Code,
    color: "from-indigo-600 to-blue-500"
  },
  {
    pseudonyme: "Kernel",
    titre: "Spécialiste des Systèmes et Réseaux",
    citation: "Un programme ne vit jamais seul. Pour vraiment maîtriser le numérique, il faut comprendre l'écosystème dans lequel il évolue : le système d'exploitation, le réseau, la base de données.",
    competences: [
      "Titulaire du DIU 'Enseigner l'Informatique au Lycée'",
      "Expérience en administration système",
      "Expert des interactions matériel-logiciel"
    ],
    specialites: ["Suivi de Spécialité NSI", "Programme Odyssée"],
    icon: Users,
    color: "from-teal-600 to-cyan-500"
  }
];

export function ExpertsShowcase() {
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
          <Badge variant="outline" className="mb-4 bg-or-stellaire text-bleu-nuit border-or-stellaire">
            <Users className="w-4 h-4 mr-2" />
            Notre Équipe d'Experts
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-4">
            Les Maîtres de l'Excellence
          </h2>
          <p className="text-lg text-gris-noble max-w-3xl mx-auto">
            Découvrez notre panthéon d'experts, chacun spécialisé dans son domaine d'excellence pour vous accompagner vers la réussite
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {experts.map((expert, index) => (
            <motion.div
              key={expert.pseudonyme}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full border-2 border-gray-200 hover:border-or-stellaire transition-all duration-300 hover:shadow-xl hover:scale-105">
                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-4">
                    <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${expert.color} flex items-center justify-center`}>
                      <expert.icon className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-xl font-bold text-bleu-nuit mb-2">
                    {expert.pseudonyme}
                  </CardTitle>
                  <p className="text-sm text-gris-noble mb-4">
                    {expert.titre}
                  </p>

                  <blockquote className="text-sm text-blue-800 italic mb-4 border-l-2 border-blue-300 pl-3">
                    "{expert.citation}"
                  </blockquote>
                </CardHeader>

                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold text-bleu-nuit mb-2">Compétences Clés</h4>
                      <div className="space-y-1">
                        {expert.competences.map((competence, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <div className="w-1.5 h-1.5 bg-or-stellaire rounded-full"></div>
                            <span className="text-xs text-gris-noble">
                              {competence}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold text-bleu-nuit mb-2">Spécialités</h4>
                      <div className="flex flex-wrap gap-1">
                        {expert.specialites.map((specialite, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-300">
                            {specialite}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
