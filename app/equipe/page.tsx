"use client";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { BookOpen, Compass, GraduationCap, HeadphonesIcon, Users } from "lucide-react";
import { useState } from "react";

// Données des profils d'équipe selon la documentation officielle
const TEAM_PROFILES = {
  mathematiques: [
    {
      id: "axiom",
      pseudonym: "Axiom",
      tag: "🎓 Agrégé",
      title: "Mentor Agrégé en Mathématiques",
      tagline: "La véritable élégance mathématique ne réside pas dans la complexité des calculs, mais dans la pureté du raisonnement. Je vous apprends à construire cette élégance.",
      points: ["Professeur Agrégé de Mathématiques", "Maîtrise exceptionnelle de la discipline", "Plus de 20 ans d'expérience"],
      summary: "L'Architecte des Théorèmes. Une qualification qui atteste d'une maîtrise exceptionnelle, reconnu pour sa rigueur intellectuelle et sa capacité à rendre les concepts abstraits clairs.",
      expertise: "Professeur Agrégé de Mathématiques, une qualification qui atteste d'une maîtrise exceptionnelle de la discipline. Reconnu dans son établissement pour sa rigueur intellectuelle et sa capacité à rendre les concepts les plus abstraits clairs et limpides.",
      philosophy: "Possède une connaissance profonde des attendus du programme français, se concentrant sur le développement des compétences de raisonnement logique essentielles pour le supérieur. Plus de 20 ans d'expérience dans l'accompagnement d'élèves à fort potentiel.",
      nexusPlus: "Son expertise exceptionnelle pour transformer les bons élèves en candidats brillants, capables de faire la différence dans les filières les plus sélectives."
    },
    {
      id: "vector",
      pseudonym: "Vector",
      tag: "🎯 Stratège",
      title: "Coach Certifié en Mathématiques",
      tagline: "Un problème de Bac est un jeu avec des règles précises. Je ne vous apprends pas seulement à jouer, je vous apprends à gagner en anticipant chaque coup.",
      points: ["Professeur Certifié (CAPES) de Mathématiques", "Expert méthodologie des épreuves", "Expérience enseignement français à l'étranger"],
      summary: "Le Stratège des Épreuves. Une pédagogie bienveillante et encourageante, réputée pour redonner confiance aux élèves en difficulté.",
      expertise: "Professeur Certifié (CAPES) de Mathématiques, garant d'une solide formation pédagogique. Une pédagogie bienveillante et encourageante, réputée pour redonner confiance aux élèves en difficulté.",
      philosophy: "Expert dans la méthodologie des épreuves, il excelle à décortiquer les attentes des examinateurs pour transformer le stress en performance maîtrisée. Riche expérience dans l'enseignement français à l'étranger.",
      nexusPlus: "Sa maîtrise parfaite des enjeux spécifiques à nos élèves et sa capacité à transformer le stress en concentration."
    }
  ],
  physique: [
    {
      id: "flux",
      pseudonym: "Flux",
      tag: "🧪 Expérimentaliste",
      title: "Spécialiste en Pédagogie des Sciences",
      tagline: "La science est un dialogue avec la nature. Pour comprendre ses lois, il faut apprendre à lui poser les bonnes questions, et souvent, la réponse se trouve dans l'expérience.",
      points: ["Professeur Certifié de Physique-Chimie", "Expert ECE", "Approche immersive"],
      summary: "L'Expérimentaliste. Une approche pédagogique concrète et immersive, qui connecte la théorie aux applications du monde réel.",
      expertise: "Professeur Certifié de Physique-Chimie, doté d'une double compétence très recherchée. Une approche pédagogique concrète et immersive, qui connecte la théorie aux applications du monde réel.",
      philosophy: "Expert reconnu dans la préparation des épreuves de compétences expérimentales (ECE), il sait comment transformer une manipulation en une démonstration de compétence.",
      nexusPlus: "Sa patience et sa capacité à vulgariser les phénomènes scientifiques complexes pour une compréhension profonde."
    },
    {
      id: "orion",
      pseudonym: "Orion",
      tag: "🌌 Théoricien",
      title: "Mentor en Physique-Chimie",
      tagline: "De l'infiniment petit à l'infiniment grand, les mêmes lois gouvernent l'univers. Mon but est de vous faire voir cette harmonie cachée pour construire une compréhension profonde et durable.",
      points: ["Professeur Certifié de Physique-Chimie", "Expert modélisation", "Approche structurée"],
      summary: "Le Théoricien. Possède un talent unique pour la modélisation et la conceptualisation, aidant les élèves à prendre de la hauteur sur le programme.",
      expertise: "Professeur Certifié de Physique-Chimie, alliant expertise scientifique et savoir-faire pédagogique. Possède un talent unique pour la modélisation et la conceptualisation.",
      philosophy: "Sa clarté d'explication et son approche structurée sont plébiscitées par les élèves qu'il accompagne. Vaste expérience dans le suivi d'élèves aux profils variés.",
      nexusPlus: "Sa capacité à garantir une adaptabilité à chaque rythme d'apprentissage pour une compréhension profonde et durable."
    }
  ],
  nsi: [
    {
      id: "recursiv",
      pseudonym: "Recursiv",
      tag: "💻 DIU NSI",
      title: "Pédagogue du Code & Développeur",
      tagline: "Écrire un programme, c'est comme écrire un poème : la beauté réside dans l'efficacité, l'élégance et la clarté. Je vous apprends la syntaxe et la poésie.",
      points: ["Titulaire du DIU \"Enseigner l'Informatique au Lycée\"", "Examinateur épreuve pratique NSI", "Double culture ingénieur-enseignant"],
      summary: "L'Algorithmicien. Une pédagogie orientée projet, qui développe l'autonomie et la capacité à \"penser comme un programmeur\".",
      expertise: "Titulaire du DIU \"Enseigner l'Informatique au Lycée\", la certification de référence. Examinateur de l'épreuve pratique de NSI, il connaît de l'intérieur les attentes et les pièges de l'examen.",
      philosophy: "Une pédagogie orientée projet, qui développe l'autonomie et la capacité à \"penser comme un programmeur\". Double culture d'ingénieur et d'enseignant.",
      nexusPlus: "Sa capacité à lier le programme scolaire aux compétences réelles du monde professionnel."
    },
    {
      id: "kernel",
      pseudonym: "Kernel",
      tag: "🖥️ Systèmes",
      title: "Spécialiste des Systèmes Numériques",
      tagline: "Un programme ne vit jamais seul. Pour vraiment maîtriser le numérique, il faut comprendre l'écosystème dans lequel il évolue : le système d'exploitation, le réseau, la base de données.",
      points: ["Titulaire du DIU \"Enseigner l'Informatique au Lycée\"", "Examinateur épreuve pratique", "Vision d'ensemble"],
      summary: "L'Architecte Système. Reconnu pour sa capacité à donner une vision d'ensemble, en expliquant non seulement le \"comment\" mais aussi le \"pourquoi\".",
      expertise: "Titulaire du DIU \"Enseigner l'Informatique au Lycée\", garantissant une expertise certifiée. Également examinateur de l'épreuve pratique, il apporte une vision complète des exigences de l'examen.",
      philosophy: "Reconnu pour sa capacité à donner une vision d'ensemble, en expliquant non seulement le \"comment\" mais aussi le \"pourquoi\" des technologies.",
      nexusPlus: "Sa patience et sa méthode structurée en font un mentor très apprécié pour aborder les concepts les plus techniques."
    }
  ],
  lettres: [
    {
      id: "scriptor",
      pseudonym: "Scriptor",
      tag: "📝 Écriture",
      title: "Spécialiste des Épreuves Écrites de Français",
      tagline: "Chaque texte est une énigme. Je vous donne les clés pour la déchiffrer, analyser sa structure, et révéler sa richesse dans une argumentation claire et structurée.",
      points: ["Professeure Certifiée de Lettres Modernes", "Correctrice épreuves écrites du Bac", "Pédagogie de la rigueur"],
      summary: "L'Analyste Littéraire. Une pédagogie de la rigueur et de la clarté, formant les élèves à construire des raisonnements impeccables et des écrits percutants.",
      expertise: "Professeure Certifiée de Lettres Modernes, une formation d'excellence. Une pédagogie de la rigueur et de la clarté, formant les élèves à construire des raisonnements impeccables et des écrits percutants.",
      philosophy: "Correctrice des épreuves écrites du Bac, elle apporte une connaissance précise des grilles d'évaluation et des attentes des jurys.",
      nexusPlus: "Sa bienveillance et son écoute permettent à chaque élève de trouver sa propre voix et de progresser en confiance."
    },
    {
      id: "oratora",
      pseudonym: "Oratora",
      tag: "🎤 Éloquence",
      title: "Coach en Prise de Parole & Rhétorique",
      tagline: "Une idée brillante mal exprimée est une idée perdue. Je ne vous entraîne pas à réciter, je vous entraîne à convaincre.",
      points: ["Professeure Certifiée de Lettres et de Théâtre", "4 ans jury Grand Oral", "Coaching unique"],
      summary: "La Maîtresse de l'Éloquence. Une approche de coaching unique, qui travaille la posture, la voix, la gestion du stress et la force de l'argumentation.",
      expertise: "Professeure Certifiée de Lettres et de Théâtre, alliant la rigueur académique à l'art de la scène. Forte d'une expérience de quatre ans comme jury du Grand Oral.",
      philosophy: "Elle connaît parfaitement les codes, les attentes et les secrets de cette épreuve. Une approche de coaching unique, qui travaille la posture, la voix, la gestion du stress.",
      nexusPlus: "Sa personnalité inspirante et son énergie communicative transforment une épreuve redoutée en une opportunité de briller."
    }
  ],
  orientation: [
    {
      id: "prospect",
      pseudonym: "Prospect",
      tag: "🧭 Orientation",
      title: "Conseiller en Stratégie d'Orientation",
      tagline: "Parcoursup n'est pas une destination, c'est un point de départ. Mon rôle est de m'assurer que ce départ soit parfaitement aligné avec qui vous êtes et qui vous voulez devenir.",
      points: ["Conseiller d'orientation-psychologue", "Expert Parcoursup", "Approche humaine et structurée"],
      summary: "Le Stratège d'Orientation. Expert de l'écosystème Parcoursup et des filières de l'enseignement supérieur français.",
      expertise: "Solide formation de conseiller d'orientation-psychologue, garantissant une approche humaine et structurée. Expert de l'écosystème Parcoursup et des filières de l'enseignement supérieur français.",
      philosophy: "Une qualité d'écoute exceptionnelle pour aider chaque élève à définir un projet d'orientation qui lui ressemble vraiment.",
      nexusPlus: "Sa vision stratégique et sa capacité à transformer les ambitions en un plan d'action concret et réalisable."
    }
  ],
  operationnel: [
    {
      id: "clea",
      pseudonym: "Cléa",
      tag: "🤝 Partenaire",
      title: "Votre Partenaire Confiance",
      tagline: "Mon objectif est de vous offrir une expérience d'une fluidité absolue, pour que vous et votre enfant puissiez vous concentrer sur l'essentiel : la réussite.",
      points: ["Coordination pédagogique", "Service client premium", "Organisation et réactivité"],
      summary: "La Coordinatrice de Parcours. Un sens du service client premium, plaçant la satisfaction des familles au cœur de ses priorités.",
      expertise: "Compétences avérées en coordination pédagogique et en gestion de projet. Un sens du service client premium, plaçant la satisfaction des familles au cœur de ses priorités.",
      philosophy: "Organisation, réactivité et proactivité pour anticiper vos besoins.",
      nexusPlus: "Elle est le lien bienveillant et efficace entre les familles, les élèves et notre équipe d'experts, garantissant la sérénité de votre parcours."
    }
  ]
};

const POLE_ICONS = {
  mathematiques: GraduationCap,
  physique: BookOpen,
  nsi: BookOpen,
  lettres: Users,
  orientation: Compass,
  operationnel: HeadphonesIcon
};

const POLE_TITLES = {
  mathematiques: "Pôle Mathématiques : La Double Maîtrise",
  physique: "Pôle Sciences Physiques : La Vision Complémentaire",
  nsi: "Pôle NSI & Python : L'Alliance du Code et de l'Architecture",
  lettres: "Pôle Humanités : L'Art de Penser et de Convaincre",
  orientation: "Pôle Stratégie & Support",
  operationnel: "Le Cœur Opérationnel de Nexus"
};

export default function EquipePage() {
  const [selectedProfile, setSelectedProfile] = useState<any>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          {/* En-tête */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 md:mb-16"
          >
            <Badge variant="outline" className="mb-4">
              <Users className="w-4 h-4 mr-2" />
              Notre Équipe d'Excellence
            </Badge>
            <h1 className="font-heading text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 mb-4 md:mb-6">
              Rencontrez Nos Experts
            </h1>

            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Une équipe d'élite composée de professeurs agrégés, certifiés et de spécialistes

              reconnus, tous unis par la passion de transmettre et de faire réussir.
            </p>
          </motion.div>

          {/* Grille des pôles */}
          <div className="space-y-12 md:space-y-16">
            {Object.entries(TEAM_PROFILES).map(([poleKey, profiles], poleIndex) => {
              const Icon = POLE_ICONS[poleKey as keyof typeof POLE_ICONS];

              return (
                <motion.section
                  key={poleKey}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: poleIndex * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-white rounded-xl p-6 md:p-8 shadow-soft"
                >
                  {/* Titre du pôle */}
                  <div className="flex items-center mb-6 md:mb-8">
                    <div className="inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary-100 text-primary-600 mr-3 md:mr-4">
                      <Icon className="w-5 h-5 md:w-6 md:h-6" />
                    </div>
                    <h2 className="font-heading text-xl md:text-2xl font-bold text-gray-900">
                      {POLE_TITLES[poleKey as keyof typeof POLE_TITLES]}
                    </h2>
                  </div>

                  {/* Cartes des profils */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {profiles.map((profile, profileIndex) => (
                      <motion.div
                        key={profile.id}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: profileIndex * 0.1 }}
                        viewport={{ once: true }}
                      >
                        <Card className="h-full hover:shadow-medium transition-all duration-300 cursor-pointer group">
                          <CardHeader className="text-center pb-3 md:pb-4">
                            <div className="mb-3 md:mb-4">
                              <Badge variant="outline" className="mb-2 text-xs md:text-sm">
                                {profile.tag}
                              </Badge>
                            </div>
                            <CardTitle className="font-heading text-lg md:text-xl font-bold text-gray-900 mb-2">
                              {profile.pseudonym}
                            </CardTitle>
                          </CardHeader>

                          <CardContent className="pt-0">
                            <div className="space-y-2 md:space-y-3 mb-4 md:mb-6">
                              {profile.points.map((point, pointIndex) => (
                                <div key={pointIndex} className="flex items-center space-x-2 text-xs md:text-sm text-gray-700">
                                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-primary-500" />
                                  <span className="truncate">{point}</span>
                                </div>
                              ))}
                            </div>


                            <p className="text-gray-600 text-sm mb-6 leading-relaxed">

                              {profile.summary}
                            </p>

                            <Dialog>
                              <DialogTrigger asChild>

                                <Button
                                  variant="outline"
                                  className="w-full group-hover:bg-primary-500 group-hover:text-white transition-colors"

                                  onClick={() => setSelectedProfile(profile)}
                                >
                                  Découvrir le Profil
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <div className="text-center mb-4">
                                    <Badge variant="outline" className="mb-2 text-xs md:text-sm">
                                      {profile.tag}
                                    </Badge>
                                    <DialogTitle className="font-heading text-xl md:text-2xl font-bold text-gray-900">
                                      {profile.pseudonym}
                                    </DialogTitle>
                                    <p className="text-sm md:text-base text-gray-600 mt-2">{profile.title}</p>
                                  </div>
                                </DialogHeader>


                                <div className="space-y-6">
                                  <div className="bg-primary-50 p-4 rounded-lg border-l-4 border-primary-500">
                                    <p className="text-primary-800 italic">

                                      "{profile.tagline}"
                                    </p>
                                  </div>

                                  <div>
                                    <h4 className="font-semibold text-gray-900 mb-2 text-sm md:text-base">Parcours & Expertise</h4>
                                    <p className="text-gray-600 leading-relaxed text-sm md:text-base">{profile.expertise}</p>
                                  </div>

                                  <div>
                                    <h4 className="font-semibold text-gray-900 mb-2 text-sm md:text-base">Philosophie Pédagogique</h4>
                                    <p className="text-gray-600 leading-relaxed text-sm md:text-base">{profile.philosophy}</p>
                                  </div>


                                  <div className="bg-secondary-50 p-4 rounded-lg">
                                    <h4 className="font-semibold text-secondary-800 mb-2">Le "Plus" Nexus</h4>

                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </motion.section>
              );
            })}
          </div>

          {/* CTA Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            viewport={{ once: true }}
            className="text-center mt-12 md:mt-16 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-xl p-6 md:p-8 text-white"
          >
            <h3 className="font-heading text-xl md:text-2xl font-bold mb-3 md:mb-4">
              Prêt à Rejoindre l'Excellence ?
            </h3>

            <p className="text-white/90 mb-6 max-w-2xl mx-auto">
              Nos experts vous attendent pour transformer le potentiel de votre enfant

              en réussite concrète. Commencez par un bilan gratuit.
            </p>
            <Button asChild size="lg" className="bg-white text-primary-600 hover:bg-gray-100">
              <a href="/bilan-gratuit">
                Commencer mon Bilan Gratuit
              </a>
            </Button>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
