'use client';

import React, { useState } from 'react';
import { BarChart3, Check, Code2, Lightbulb, Rocket, Target } from 'lucide-react';
import { analytics } from '@/lib/analytics-stages';

interface TierRecommendation {
  tier: 'pallier1' | 'pallier2';
  title: string;
  description: string;
  reasons: string[];
  ctaText: string;
  ctaLink: string;
}

export function TierSelector() {
  const [budget, setBudget] = useState<number>(500);
  const [subject, setSubject] = useState<'maths' | 'nsi'>('maths');
  const [average, setAverage] = useState<number>(12);
  const [showRecommendation, setShowRecommendation] = useState(false);

  const getRecommendation = (): TierRecommendation => {
    if (budget < 700 || average < 13) {
      return {
        tier: 'pallier1',
        title: 'Pallier 1 : Prépa Bac / Essentiels',
        description: 'Consolidez les bases et sécurisez le baccalauréat',
        reasons: [
          average < 10 ? 'Votre moyenne actuelle nécessite une consolidation des fondamentaux' : 
          average < 13 ? 'Renforcement des bases recommandé pour votre niveau actuel' :
          'Budget orienté vers l\'essentiel',
          'Méthodes fiables et exercices types Bac',
          'Groupes de 6 élèves maximum avec bilan individualisé',
          'Épreuves blanches pour mesurer la progression'
        ],
        ctaText: 'Voir les académies Pallier 1',
        ctaLink: '#academies'
      };
    }

    return {
      tier: 'pallier2',
      title: 'Pallier 2 : Excellence / Objectif avancé',
      description: 'Transformez un bon niveau en maîtrise solide',
      reasons: [
        'Votre niveau actuel permet de viser l\'excellence',
        'Approfondissement et rédaction fine',
        'Tests de maîtrise et renforcement ciblé',
        'Préparation trajectoire prépa/ingénieur',
        'Exposé de maîtrise inclus (NSI)'
      ],
      ctaText: 'Voir les académies Pallier 2',
      ctaLink: '#academies'
    };
  };

  const handleCalculate = () => {
    setShowRecommendation(true);
    analytics.ctaClick('tier-selector', `Budget: ${budget}, Subject: ${subject}, Average: ${average}`);
  };

  const recommendation = getRecommendation();
  const isPallier1 = recommendation.tier === 'pallier1';

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 mb-4">
              Comment choisir ?
            </h2>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
              Répondez à 3 questions simples pour obtenir une recommandation personnalisée
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-3xl shadow-xl p-6 md:p-12 border-2 border-blue-200">
            <div className="space-y-8">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-4">
                  1. Quel est votre budget ?
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setBudget(500)}
                    className={`p-4 rounded-xl border-2 font-semibold transition-all ${
                      budget === 500
                        ? 'bg-blue-700 text-white border-blue-700 shadow-lg scale-[1.02]'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                    }`}
                  >
                    ~500 DT
                  </button>
                  <button
                    onClick={() => setBudget(950)}
                    className={`p-4 rounded-xl border-2 font-semibold transition-all ${
                      budget === 950
                        ? 'bg-blue-700 text-white border-blue-700 shadow-lg scale-[1.02]'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                    }`}
                  >
                    ~950 DT
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-4">
                  2. Quelle matière ?
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setSubject('maths')}
                    className={`p-4 rounded-xl border-2 font-semibold transition-all ${
                      subject === 'maths'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-lg scale-[1.02]'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" aria-hidden="true" />
                      Mathématiques
                    </span>
                  </button>
                  <button
                    onClick={() => setSubject('nsi')}
                    className={`p-4 rounded-xl border-2 font-semibold transition-all ${
                      subject === 'nsi'
                        ? 'bg-blue-700 text-white border-blue-700 shadow-lg scale-[1.02]'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Code2 className="h-4 w-4" aria-hidden="true" />
                      NSI
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-4">
                  3. Quelle est la moyenne actuelle de l'élève ?
                </label>
                <div className="space-y-4">
                  <input
                    type="range"
                    min="5"
                    max="20"
                    step="0.5"
                    value={average}
                    onChange={(e) => setAverage(parseFloat(e.target.value))}
                    className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>5/20</span>
                    <span className="text-2xl font-black text-blue-700">{average}/20</span>
                    <span>20/20</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCalculate}
                className="w-full btn-stage-gradient"
              >
                <span className="inline-flex items-center gap-2">
                  <Target className="h-4 w-4" aria-hidden="true" />
                  Obtenir ma recommandation
                </span>
              </button>
            </div>

            {showRecommendation && (
              <div className="mt-8 p-6 md:p-8 bg-white rounded-2xl shadow-lg border-2 border-blue-300 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isPallier1 ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-900'} ${isPallier1 ? 'animate-bounce' : 'animate-pulse'}`}>
                    {isPallier1 ? (
                      <Target className="h-7 w-7" aria-hidden="true" />
                    ) : (
                      <Rocket className="h-7 w-7" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-black text-slate-900 mb-2">
                      {recommendation.title}
                    </h3>
                    <p className="text-lg text-slate-600 mb-4">
                      {recommendation.description}
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="text-sm font-bold text-slate-700 mb-3">
                    Pourquoi ce choix ?
                  </div>
                  <ul className="space-y-2">
                    {recommendation.reasons.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-700" aria-hidden="true" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href={recommendation.ctaLink}
                  className={`${isPallier1 ? 'btn-stage-sm' : 'btn-stage-gradient'} w-full`}
                >
                  {recommendation.ctaText}
                </a>

                <p className="mt-4 text-xs text-center text-slate-600">
                  <span className="inline-flex items-center gap-2">
                    <Lightbulb className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                    En cas de doute, réservez une consultation gratuite pour un conseil personnalisé
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
