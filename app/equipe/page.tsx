"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Users, GraduationCap, BookOpen, Compass, HeadphonesIcon } from "lucide-react"

// Données des profils d'équipe selon la documentation
const TEAM_PROFILES = {
  mathematiques: [
    {
      id: "helios",
      pseudonym: "Hélios",
      tag: "🎓 Agrégé",
      title: "Professeur Agrégé de Mathématiques, Mentor d'Excellence",
      tagline: "Une démonstration est une œuvre d'art logique. Mon but est de vous apprendre à devenir l'artiste.",
      points: ["Agrégé de Mathématiques", "Spécialiste Maths Expertes", "Préparation Concours Post-Bac"],
      summary: "Expert des mathématiques d'excellence. Il transforme les bons élèves en candidats brillants, capables de faire la différence dans les filières les plus sélectives.",
      expertise: "Agrégé de Mathématiques, Hélios est notre référence pour les défis les plus complexes. Fort d'une solide expérience en classes préparatoires, il maîtrise le programme de spécialité et l'option \"Maths Expertes\" à la perfection.",
      philosophy: "Hélios voit la beauté dans l'abstraction. Sa méthode vise à construire une compréhension profonde des concepts, bien au-delà de l'application de formules. Il pousse ses élèves à penser comme des mathématiciens, en développant leur rigueur et leur intuition.",
      nexusPlus: "Sa capacité à élever le niveau. Il est le coach idéal pour les élèves ambitieux qui visent les classes préparatoires, les écoles d'ingénieurs et les parcours universitaires les plus exigeants."
    },
    {
      id: "zenon",
      pseudonym: "Zénon",
      tag: "🎯 Stratège",
      title: "Professeur Certifié, Stratège de la Performance",
      tagline: "Le jour J, la méthode fait la différence. Apprenons à travailler plus intelligemment, pas seulement plus durement.",
      points: ["Professeur Certifié de Maths", "Optimisation des méthodes", "Gestion du temps en examen"],
      summary: "Stratège de la performance. Il n'enseigne pas seulement les maths, il enseigne comment réussir en maths, avec méthode, efficacité et sans stress inutile.",
      expertise: "Professeur Certifié et passionné par les sciences cognitives, Zénon se spécialise dans l'optimisation des stratégies d'apprentissage et de révision.",
      philosophy: "Zénon fournit à ses élèves des techniques concrètes pour organiser leurs révisions, gérer leur temps en épreuve, vérifier leurs résultats et éviter les erreurs les plus communes. Son approche est pragmatique et orientée vers la performance le jour de l'examen.",
      nexusPlus: "Son impact direct sur les notes. Il donne aux élèves un avantage stratégique qui leur permet de gagner en confiance et en efficacité, transformant le stress en concentration."
    },
    {
      id: "pythagore",
      pseudonym: "Pythagore",
      tag: "🤝 Confiance",
      title: "Professeur Certifié, Spécialiste de la Confiance en Soi",
      tagline: "Il n'y a pas de 'mauvais en maths', seulement de mauvaises fondations. Reconstruisons-les ensemble, brique par brique.",
      points: ["Professeur Certifié de Maths", "Spécialiste Déblocage", "Remise à niveau des bases"],
      summary: "Le \"réparateur\" de la relation avec les maths. Patient et encourageant, il déconstruit les blocages pour rebâtir des bases solides et restaurer la confiance.",
      expertise: "Professeur Certifié de Mathématiques, Pythagore a développé une expertise unique dans l'accompagnement des élèves ayant perdu pied ou développé une anxiété face à la matière.",
      philosophy: "Écoute, patience et valorisation. Il excelle à diagnostiquer l'origine précise d'un blocage (une lacune ancienne, une règle mal comprise) et à y remédier avec des explications claires et des exercices progressifs.",
      nexusPlus: "Sa capacité à opérer des \"déblocages\" spectaculaires. Il est le coach idéal pour les élèves qui pensent que les maths \"ne sont pas pour eux\"."
    }
  ],
  nsi: [
    {
      id: "turing",
      pseudonym: "Turing",
      tag: "💻 DIU NSI",
      title: "Professeur de NSI, Architecte Logiciel",
      tagline: "Un bon code n'est pas seulement un code qui fonctionne, c'est un code qui est bien pensé. Apprenons à construire proprement.",
      points: ["Diplômé DIU NSI", "Expert Algorithmique & Python", "Architecte de Projets"],
      summary: "L'architecte du code. Structuré et passionné, il enseigne l'informatique avec la rigueur d'un ingénieur et la passion d'un bâtisseur de projets concrets.",
      expertise: "Issu d'une formation d'ingénieur et titulaire du DIU \"Enseigner l'Informatique au Lycée\", Turing possède une vision qui allie la rigueur académique à la réalité du développement logiciel.",
      philosophy: "Apprendre par la construction et la méthode. Il met l'accent sur la logique algorithmique et les bonnes pratiques de programmation.",
      nexusPlus: "Sa préparation solide pour les études supérieures. Il forme des élèves qui non seulement excellent au Bac, mais qui possèdent aussi des bases méthodologiques qui leur donneront une longueur d'avance."
    },
    {
      id: "vinci",
      pseudonym: "Vinci",
      tag: "💡 Créatif",
      title: "Professeur de NSI, Explorateur Créatif",
      tagline: "Si vous pouvez l'imaginer, vous pouvez le coder. Transformons vos idées les plus folles en projets concrets.",
      points: ["Spécialiste NSI", "Expert Projets Créatifs", "Préparation Grand Oral NSI"],
      summary: "L'explorateur créatif. Il transforme la NSI en un terrain de jeu pour l'innovation, aidant les élèves à développer des projets originaux et passionnants.",
      expertise: "Passionné par l'innovation et l'intersection entre la technologie et la créativité, Vinci a une approche très dynamique de la NSI.",
      philosophy: "La curiosité comme moteur. Il encourage l'expérimentation et est expert pour aider les élèves à trouver un sujet de projet qui les passionne et à le valoriser brillamment pour le Grand Oral.",
      nexusPlus: "Sa capacité à transformer une matière en une passion. Il est le coach parfait pour les élèves qui veulent voir au-delà du programme."
    }
  ],
  lettres: [
    {
      id: "athena",
      pseudonym: "Athéna",
      tag: "🎤 Grand Oral",
      title: "Professeure de Français, Stratège du Bac et de l'Éloquence",
      tagline: "La maîtrise de la langue, c'est la maîtrise de la pensée. C'est votre meilleur atout pour convaincre et réussir.",
      points: ["Professeure Certifiée de Lettres", "Stratège Bac de Français", "Experte en éloquence"],
      summary: "La stratège de l'argumentation. Méthodique et exigeante, elle livre les clés pour maîtriser les épreuves écrites et orales avec brio et confiance.",
      expertise: "Professeure Certifiée de Lettres Modernes et fine connaisseuse des attentes des jurys d'examen, Athéna est notre experte de la performance en français.",
      philosophy: "La méthode est la clé de la liberté. Elle fournit des \"boîtes à outils\" infaillibles pour la dissertation, le commentaire et l'oral, permettant à l'élève d'exprimer une réflexion personnelle, riche et structurée.",
      nexusPlus: "Son coaching redoutable pour le Grand Oral. Elle travaille le fond (l'argumentation) et la forme (la posture, la voix, la gestion du stress) pour transformer un bon élève en un candidat marquant."
    },
    {
      id: "calliope",
      pseudonym: "Calliope",
      tag: "📚 Culture",
      title: "Professeure de Français, Passeuse de Culture",
      tagline: "Un livre n'est qu'un objet d'étude, c'est une porte ouverte sur le monde. Osons la franchir ensemble.",
      points: ["Professeure Certifiée de Lettres", "Spécialiste analyse littéraire", "Éveil à la culture générale"],
      summary: "La passeuse de culture. Passionnée et passionnante, elle donne vie aux textes et connecte la littérature au monde pour éveiller la curiosité et l'esprit critique.",
      expertise: "Professeure Certifiée de Lettres Modernes et amoureuse des arts, Calliope croit au pouvoir de la culture pour former les esprits.",
      philosophy: "Donner du sens et du plaisir. Elle excelle à rendre les œuvres classiques pertinentes pour les jeunes d'aujourd'hui en créant des ponts avec le cinéma, la musique et l'actualité.",
      nexusPlus: "Sa capacité à construire une solide culture générale. Au-delà du Bac, elle donne aux élèves des références et une ouverture d'esprit précieuses pour leurs études supérieures."
    }
  ],
  transversal: [
    {
      id: "kairos",
      pseudonym: "Kairos",
      tag: "🧠 Méthodologie",
      title: "Coach Scolaire & Spécialiste des Méthodes d'Apprentissage",
      tagline: "Le succès n'est pas un sprint, c'est un marathon de bonnes habitudes. Courons-le ensemble.",
      points: ["Coach scolaire certifié", "Organisation & Gestion du temps", "Concentration & Motivation"],
      summary: "L'architecte de l'autonomie. Il n'enseigne pas une matière, il enseigne à mieux apprendre toutes les matières.",
      expertise: "Certifié en coaching professionnel et formé aux neurosciences de l'éducation, Kairos accompagne les élèves sur tous les aspects qui dépassent le cadre purement académique.",
      philosophy: "\"Apprendre à apprendre\". Kairos ne se focalise pas sur le \"quoi\" mais sur le \"comment\" : organisation, gestion du temps, concentration, mémorisation, gestion du stress et motivation.",
      nexusPlus: "Son rôle de catalyseur. Il intervient en soutien des coachs de matière pour débloquer le plein potentiel de l'élève."
    },
    {
      id: "orion",
      pseudonym: "Orion",
      tag: "🧭 Parcoursup",
      title: "Conseiller d'Orientation, Navigateur d'Avenir",
      tagline: "L'orientation n'est pas une destination à trouver sur une carte, c'est un chemin qui vous ressemble. Bâtissons-le ensemble.",
      points: ["Expert Orientation Post-Bac", "Stratégie de vœux", "Préparation aux entretiens"],
      summary: "Le navigateur d'avenir. Il transforme l'angoisse de Parcoursup en un projet stratégique, cohérent et personnalisé.",
      expertise: "Consultant expert des filières post-bac et du fonctionnement de Parcoursup, il guide les élèves et leurs familles dans la construction de leur projet.",
      philosophy: "Son approche en plusieurs étapes (bilan, exploration, stratégie) permet de construire un projet de manière sereine et réfléchie, en adéquation avec la personnalité de l'élève et les réalités des formations.",
      nexusPlus: "Sa vision stratégique à 360°. Il aide à rédiger des \"projets de formation motivés\" percutants et prépare aux entretiens des écoles les plus sélectives."
    }
  ],
  operationnel: [
    {
      id: "clea",
      pseudonym: "Cléa",
      tag: "📞 Votre Contact",
      title: "Assistante Pédagogique & Coordinatrice de Réussite",
      tagline: "Ma mission ? Que vous n'ayez à vous soucier que d'une seule chose : la réussite de votre enfant.",
      points: ["Coordinatrice de réussite", "Organisation & Planning", "Liaison Familles-Coachs"],
      summary: "Le pilier de votre expérience Nexus. Réactive et bienveillante, elle assure la fluidité de votre parcours au quotidien.",
      expertise: "Cléa est le cœur opérationnel de Nexus. Son expertise réside dans sa capacité à organiser, anticiper les besoins et répondre rapidement et efficacement à toutes les demandes.",
      philosophy: "Elle est la garante d'une expérience client sans friction. Elle gère les plannings, les aspects administratifs, et assure une communication parfaite entre les familles et les coachs.",
      nexusPlus: "Sa présence rassurante. Elle est le premier point de contact qui vous accueille et vous accompagne à chaque étape, garantissant que tout se déroule parfaitement."
    }
  ]
}

const POLE_ICONS = {
  mathematiques: GraduationCap,
  nsi: BookOpen,
  lettres: Users,
  transversal: Compass,
  operationnel: HeadphonesIcon
}

const POLE_TITLES = {
  mathematiques: "Pôle Mathématiques : Les Architectes du Raisonnement",
  nsi: "Pôle Numérique (NSI) : Les Bâtisseurs du Futur",
  lettres: "Pôle Lettres & Humanités : Les Maîtres du Verbe",
  transversal: "Pôle Accompagnement Transversal",
  operationnel: "Le Cœur Opérationnel de Nexus"
}

export default function EquipePage() {
  const [selectedProfile, setSelectedProfile] = useState<any>(null)

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="py-12 md:py-20">
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
            <p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto px-4">
              Une équipe d'élite composée de professeurs agrégés, certifiés et de spécialistes 
              reconnus, tous unis par la passion de transmettre et de faire réussir.
            </p>
          </motion.div>

          {/* Grille des pôles */}
          <div className="space-y-12 md:space-y-16">
            {Object.entries(TEAM_PROFILES).map(([poleKey, profiles], poleIndex) => {
              const Icon = POLE_ICONS[poleKey as keyof typeof POLE_ICONS]
              
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
                            
                            <p className="text-gray-600 text-xs md:text-sm mb-4 md:mb-6 leading-relaxed">
                              {profile.summary}
                            </p>
                            
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  className="w-full group-hover:bg-primary-500 group-hover:text-white transition-colors text-xs md:text-sm"
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
                                
                                <div className="space-y-4 md:space-y-6">
                                  <div className="bg-primary-50 p-3 md:p-4 rounded-lg border-l-4 border-primary-500">
                                    <p className="text-primary-800 italic text-sm md:text-base">
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
                                  
                                  <div className="bg-secondary-50 p-3 md:p-4 rounded-lg">
                                    <h4 className="font-semibold text-secondary-800 mb-2 text-sm md:text-base">Le "Plus" Nexus</h4>
                                    <p className="text-secondary-700 leading-relaxed text-sm md:text-base">{profile.nexusPlus}</p>
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
              )
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
            <p className="text-white/90 mb-4 md:mb-6 max-w-2xl mx-auto text-sm md:text-base">
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
  )
}