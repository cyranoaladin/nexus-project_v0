"use client";

import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { Award, BrainCircuit, CheckCircle2, GitBranch, HelpCircle, ShieldCheck, Users, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

const pillars = [
  {
    icon: Users,
    title: "Des Coachs d'Exception",
    category: "La Garantie Humaine",
    description: "Nous ne recrutons que l'élite. Chaque intervenant est rigoureusement sélectionné pour son expertise et son expérience du système éducatif français.",
    features: [
      "Professeurs **Agrégés et Certifiés** de l'Éducation Nationale française",
      "Riche expérience dans **l'enseignement français à l'étranger**",
      "Spécialistes NSI titulaires du **DIU NSI**",
      "Pédagogie active et suivi **bienveillant**"
    ]
  },
  {
    icon: BrainCircuit,
    title: "Une Technologie Qui Fait la Différence",
    category: "Le Levier Technologique",
    description: "Nous avons développé des outils propriétaires qui vous donnent un avantage décisif, disponibles 24/7 pour ne jamais être bloqué.",
    features: [
      "**IA ARIA** entraînée sur nos contenus exclusifs",
      "Plateforme de suivi de progression **en temps réel**",
      "Visioconférence intégrée et **sécurisée**",
      "Ressources et quiz **interactifs**"
    ]
  },
  {
    icon: GitBranch,
    title: "Votre Parcours, Votre Stratégie",
    category: "La Stratégie Personnalisée",
    description: "Il n'y a pas de solution unique pour la réussite. Nous construisons avec vous un plan d'action sur-mesure, du premier jour jusqu'à Parcoursup.",
    features: [
      "**Bilan Stratégique** initial complet et gratuit",
      "Constitution de groupes de travail **homogènes**",
      "**Flexibilité totale** grâce au système de crédits",
      "Accompagnement **dédié à l'orientation**"
    ]
  },
  {
    icon: Award,
    title: "Des Résultats Concrets",
    category: "Les Résultats Concrets",
    description: "Notre accompagnement ne s'arrête pas aux bonnes notes. Nous préparons activement vos enfants à leur avenir et nous nous engageons sur leurs résultats.",
    features: [
      "Préparation stratégique aux concours **post-bac**",
      "Accompagnement expert et intégré à **Parcoursup**",
      "Développement de **compétences transversales** pour le supérieur",
      "**Garantie \"Bac Obtenu ou Remboursé\"** sous conditions"
    ]
  }
];

// Composant Tooltip pour DIU NSI
function DIUTooltip() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="inline-flex items-center justify-center w-4 h-4 ml-1 text-blue-600 hover:text-blue-700 transition-colors"
      >
        <HelpCircle size={16} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl p-4 w-80 text-left">
            <div className="flex items-start justify-between mb-2">
              <h4 className="font-semibold text-slate-900 text-sm">
                Qu'est-ce que le DIU NSI ?
              </h4>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 ml-2"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Le DIU "Enseigner l'informatique au lycée" est un diplôme national qui garantit
              que l'enseignant possède les connaissances et les compétences pédagogiques requises
              pour enseigner la spécialité Numérique et Sciences Informatiques (NSI) en classes
              de 1ère et de Terminale, conformément aux exigences de la réforme du lycée.
            </p>
            {/* Flèche du tooltip */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2">
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-200 -mt-1"></div>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

// Fonction pour parser le texte avec markdown simple
function parseMarkdownText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2);
      if (content === 'DIU NSI') {
        return (
          <span key={index} className="font-semibold text-orange-600">
            {content}
            <DIUTooltip />
          </span>
        );
      }
      return (
        <span key={index} className="font-semibold text-orange-600">
          {content}
        </span>
      );
    }
    return part;
  });
}

export function PillarsSection() {
  return (
    <section className="py-20 bg-slate-50">
      <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* En-tête de section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge variant="default" className="bg-blue-600 text-white mb-6">
            <ShieldCheck className="w-4 h-4 mr-2" />
            Notre Promesse
          </Badge>
          <h2 className="font-heading text-4xl md:text-5xl font-bold text-gray-900 mb-8 leading-tight max-w-4xl mx-auto">
            L'<span className="text-blue-600">Excellence</span> Augmentée
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
            Nous avons construit un écosystème unique où l'expertise humaine, la puissance technologique
            et la stratégie personnalisée convergent vers un seul objectif : votre réussite.
          </p>
        </motion.div>

        {/* Structure en colonne unique avec cartes */}
        <div className="flex flex-col space-y-8">
          {pillars.map((pillar, index) => {
            const Icon = pillar.icon;

            return (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="bg-white border border-slate-200 shadow-md rounded-lg p-8"
              >
                {/* Structure en deux colonnes avec images pour tous les piliers */}
                <div className="grid lg:grid-cols-2 gap-8 items-center">
                  {/* Colonne de gauche - Contenu */}
                  <div>
                    {/* En-tête du pilier */}
                    <div className="flex items-center mb-6">
                      <Icon className="h-10 w-10 text-orange-500 mr-4" />
                      <div>
                        <p className="text-sm font-semibold text-orange-600 uppercase tracking-wide mb-1">
                          {pillar.category}
                        </p>
                        <h3 className="font-heading text-2xl font-bold text-gray-900">
                          {pillar.title}
                        </h3>
                      </div>
                    </div>

                    {/* Texte descriptif */}
                    <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                      {pillar.description}
                    </p>

                    {/* Liste à puces améliorée */}
                    <div className="space-y-3">
                      {pillar.features.map((feature, featureIndex) => (
                        <div key={featureIndex} className="flex items-start">
                          <CheckCircle2 className="h-5 w-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700 leading-relaxed">
                            {parseMarkdownText(feature)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Colonne de droite - Image */}
                  <div className="lg:order-last">
                    {pillar.category === "La Garantie Humaine" ? (
                      <Image
                        src="/images/Image_AccompagnementBienveillant.png"
                        alt="Accompagnement bienveillant par nos experts"
                        width={500}
                        height={400}
                        className="w-full h-auto rounded-lg shadow-lg"
                      />
                    ) : pillar.category === "Le Levier Technologique" ? (
                      <Image
                        src="/images/aria_mascotte.png"
                        alt="ARIA - Notre Intelligence Artificielle"
                        width={500}
                        height={400}
                        className="w-full h-auto rounded-lg shadow-lg"
                      />
                    ) : pillar.category === "La Stratégie Personnalisée" ? (
                      <Image
                        src="/images/asisstante_parents.png"
                        alt="Accompagnement personnalisé des familles"
                        width={500}
                        height={400}
                        className="w-full h-auto rounded-lg shadow-lg"
                      />
                    ) : pillar.category === "Les Résultats Concrets" ? (
                      <Image
                        src="/images/coach_parcoursup.png"
                        alt="Coaching Parcoursup et orientation"
                        width={500}
                        height={400}
                        className="w-full h-auto rounded-lg shadow-lg"
                      />
                    ) : null}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
