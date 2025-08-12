'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Lightbulb } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface DiagnosticFormProps {
  className?: string;
}

interface FormData {
  classe: string;
  statut: string;
  priorite: string;
}

interface Recommendation {
  parcours: string;
  description: string;
  academie?: string;
  academieDescription?: string;
  parcoursLink: string;
  academieLink?: string;
}

const DIAGNOSTIC_QUESTIONS = [
  {
    id: 'classe',
    question: 'Votre enfant est en classe de...',
    options: ['Première', 'Terminale']
  },
  {
    id: 'statut',
    question: 'Son statut est...',
    options: ['Élève dans un lycée français', 'Candidat Libre']
  },
  {
    id: 'priorite',
    question: 'Sa priorité absolue cette année est de...',
    options: [
      'Réussir ses épreuves de Français (pour 1ère)',
      'Optimiser son contrôle continu',
      'Obtenir une Mention',
      'Construire un excellent dossier Parcoursup',
      'Avoir un cadre pour obtenir son Bac (pour C. Libre)'
    ]
  }
];

const RECOMMENDATIONS: Record<string, Recommendation> = {
  'Première-Lycée-Français': {
    parcours: 'Odyssée Première : Le Parcours Anticipé',
    description: 'Spécialement conçu pour optimiser le contrôle continu et préparer l\'EAF avec excellence.',
    academie: 'Académie du Français',
    academieDescription: 'Stage dédié à la réussite des Épreuves Anticipées de Français',
    parcoursLink: '/offres#odyssee',
    academieLink: '/offres#academies'
  },
  'Terminale-Lycée-Mention': {
    parcours: 'Odyssée Terminale : La Stratégie Mention',
    description: 'Conçu pour exceller dans les matières à fort coefficient et obtenir une mention.',
    academie: 'Académie de Février',
    academieDescription: 'Booster de spécialité pour approfondir vos matières clés',
    parcoursLink: '/offres#odyssee',
    academieLink: '/offres#academies'
  },
  'Terminale-Lycée-Parcoursup': {
    parcours: 'Odyssée Terminale : La Stratégie Mention',
    description: 'Optimise votre dossier Parcoursup avec une stratégie complète.',
    academie: 'Académie Python',
    academieDescription: 'Atelier de perfectionnement en programmation',
    parcoursLink: '/offres#odyssee',
    academieLink: '/offres#academies'
  },
  'Première-Lycée-Controle': {
    parcours: 'Odyssée Première : Le Parcours Anticipé',
    description: 'Maximisez votre contrôle continu avec un suivi personnalisé.',
    parcoursLink: '/offres#odyssee'
  },
  'CandidatLibre-Cadre': {
    parcours: 'Odyssée Individuel : La Préparation Intégrale',
    description: 'Votre établissement privé à domicile pour obtenir votre Bac.',
    parcoursLink: '/offres#odyssee'
  }
};

export function DiagnosticForm({ className }: DiagnosticFormProps) {
  const [formData, setFormData] = useState<FormData>({
    classe: '',
    statut: '',
    priorite: ''
  });

  const [isComplete, setIsComplete] = useState(false);
  const [isValidated, setIsValidated] = useState(false);

  const handleOptionSelect = (questionId: string, option: string) => {
    const newFormData = { ...formData, [questionId]: option };
    setFormData(newFormData);

    // Vérifier si le formulaire est complet
    const isFormComplete = Boolean(newFormData.classe && newFormData.statut && newFormData.priorite);
    setIsComplete(isFormComplete);

    // Réinitialiser la validation si on change une option
    if (isValidated) {
      setIsValidated(false);
    }
  };

  const handleValidate = () => {
    if (isComplete) {
      setIsValidated(true);
    }
  };

  const getRecommendation = (): Recommendation | null => {
    if (!isValidated) return null;

    // Pour les candidats libres, on ne prend pas en compte la classe
    if (formData.statut === 'Candidat Libre') {
      const priorityKey = getPriorityKey(formData.priorite);
      const key = `CandidatLibre-${priorityKey}`;
      return RECOMMENDATIONS[key] || {
        parcours: 'Consultation Personnalisée',
        description: 'Votre profil nécessite une analyse approfondie. Contactez-nous pour un diagnostic personnalisé.',
        parcoursLink: '/contact'
      };
    }

    // Pour les élèves en lycée français, on utilise la classe
    const key = `${formData.classe}-Lycée-${getPriorityKey(formData.priorite)}`;

    return RECOMMENDATIONS[key] || {
      parcours: 'Consultation Personnalisée',
      description: 'Votre profil nécessite une analyse approfondie. Contactez-nous pour un diagnostic personnalisé.',
      parcoursLink: '/contact'
    };
  };

  const getPriorityKey = (priorite: string): string => {
    if (priorite.includes('Français')) return 'Français';
    if (priorite.includes('contrôle continu')) return 'Controle';
    if (priorite.includes('Mention')) return 'Mention';
    if (priorite.includes('Parcoursup')) return 'Parcoursup';
    if (priorite.includes('cadre')) return 'Cadre';
    return 'General';
  };

  const recommendation = getRecommendation();

  return (
    <div className={className}>
      <motion.div
        className="text-center mb-16"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true }}
      >
        <Badge variant="outline" className="mb-4 bg-purple-50 text-purple-700 border-purple-200">
          <Lightbulb className="w-4 h-4 mr-2" />
          Constructeur de Parcours 2.0
        </Badge>
        <h2 className="text-3xl md:text-4xl font-bold text-bleu-nuit mb-4">
          Notre outil de diagnostic intelligent
        </h2>
        <p className="text-lg text-gris-noble max-w-3xl mx-auto">
          Notre outil de diagnostic devient encore plus intelligent pour guider le parent vers la bonne solution.
        </p>
      </motion.div>

      <div className="max-w-4xl mx-auto">
        <Card className="border-0 shadow-strong">
          <CardContent className="p-8">
            <div className="space-y-6">
              {DIAGNOSTIC_QUESTIONS.map((q, index) => (
                <motion.div
                  key={index}
                  className="space-y-3"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <h3 className="text-lg font-semibold text-bleu-nuit">
                    {q.question}
                  </h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    {q.options.map((option, optIndex) => (
                      <Button
                        key={optIndex}
                        variant={formData[q.id as keyof FormData] === option ? "default" : "outline"}
                        className={`justify-start h-auto p-4 text-left border-2 transition-all duration-200 ${formData[q.id as keyof FormData] === option
                          ? 'bg-or-stellaire hover:bg-or-stellaire-dark text-bleu-nuit border-or-stellaire'
                          : 'hover:border-or-stellaire hover:bg-or-stellaire/5'
                          }`}
                        onClick={() => handleOptionSelect(q.id, option)}
                      >
                        {formData[q.id as keyof FormData] === option && (
                          <Check className="w-4 h-4 mr-2 flex-shrink-0" />
                        )}
                        {option}
                      </Button>
                    ))}
                  </div>
                </motion.div>
              ))}

              {/* Bouton de validation */}
              {isComplete && !isValidated && (
                <motion.div
                  className="mt-8 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-or-stellaire to-or-stellaire-dark hover:from-or-stellaire-dark hover:to-or-stellaire text-bleu-nuit font-bold px-8 py-4 text-lg transition-all duration-300 hover:scale-105 shadow-lg"
                    onClick={handleValidate}
                  >
                    <Lightbulb className="w-5 h-5 mr-3" />
                    Obtenir ma recommandation personnalisée
                  </Button>
                  <p className="text-sm text-gris-noble mt-3">
                    Cliquez pour recevoir votre parcours sur mesure
                  </p>
                </motion.div>
              )}

              {/* Résumé des choix */}
              {isComplete && !isValidated && (
                <motion.div
                  className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <h4 className="text-md font-semibold text-bleu-nuit mb-2">
                    📋 Résumé de vos choix :
                  </h4>
                  <div className="space-y-1 text-sm text-gris-noble">
                    <p>• <strong>Classe :</strong> {formData.classe}</p>
                    <p>• <strong>Statut :</strong> {formData.statut}</p>
                    <p>• <strong>Priorité :</strong> {formData.priorite}</p>
                  </div>
                </motion.div>
              )}

              {recommendation && (
                <motion.div
                  className="mt-8 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="flex items-center mb-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-4">
                      <Check className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-bleu-nuit">
                        🎯 Votre recommandation personnalisée
                      </h4>
                      <p className="text-sm text-gris-noble">
                        Basée sur vos réponses, voici notre proposition sur mesure
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="p-4 bg-white rounded-lg border border-green-200">
                      <h5 className="font-bold text-bleu-nuit mb-2 text-lg">
                        🚀 {recommendation.parcours}
                      </h5>
                      <p className="text-gris-noble text-sm leading-relaxed">
                        {recommendation.description}
                      </p>
                    </div>

                    {recommendation.academie && (
                      <div className="p-4 bg-white rounded-lg border border-blue-200">
                        <h6 className="font-semibold text-bleu-nuit mb-2">
                          🎓 {recommendation.academie}
                        </h6>
                        <p className="text-gris-noble text-sm">
                          {recommendation.academieDescription}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 mt-6">
                    <Link href={recommendation.parcoursLink}>
                      <Button size="lg" className="bg-gradient-to-r from-or-stellaire to-or-stellaire-dark hover:from-or-stellaire-dark hover:to-or-stellaire text-bleu-nuit font-bold transition-all duration-300 hover:scale-105">
                        Découvrir ce parcours
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                    {recommendation.academieLink && (
                      <Link href={recommendation.academieLink}>
                        <Button size="lg" variant="outline" className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-all duration-300">
                          Voir cette académie
                        </Button>
                      </Link>
                    )}
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      💡 <strong>Conseil :</strong> Cette recommandation est basée sur votre profil.
                      Pour un accompagnement encore plus personnalisé, contactez-nous pour un diagnostic approfondi.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
