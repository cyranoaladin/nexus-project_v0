'use client';

import React, { useState } from 'react';
import { analytics } from '@/lib/analytics-stages';

interface MentionResult {
  mention: string;
  color: string;
  emoji: string;
}

export function MentionSimulator() {
  const [currentAverage, setCurrentAverage] = useState<number>(12);
  const [showResults, setShowResults] = useState(false);

  const getMention = (average: number): MentionResult => {
    if (average >= 16) {
      return { mention: 'Très Bien (TB)', color: 'text-green-600', emoji: '🏆' };
    } else if (average >= 14) {
      return { mention: 'Bien (B)', color: 'text-blue-600', emoji: '⭐' };
    } else if (average >= 12) {
      return { mention: 'Assez Bien (AB)', color: 'text-slate-700', emoji: '✓' };
    } else if (average >= 10) {
      return { mention: 'Passable', color: 'text-slate-600', emoji: '📄' };
    } else {
      return { mention: 'Non admis', color: 'text-slate-700', emoji: '❌' };
    }
  };

  const handleCalculate = () => {
    setShowResults(true);
    analytics.ctaClick('mention-simulator', `Current: ${currentAverage}`);
  };

  const currentMention = getMention(currentAverage);
  
  const projectedPallier1 = currentAverage + 2.5;
  const mentionPallier1 = getMention(projectedPallier1);
  
  const projectedPallier2 = currentAverage + 4.5;
  const mentionPallier2 = getMention(projectedPallier2);

  const pallier1Gain = projectedPallier1 - currentAverage;
  const pallier2Gain = projectedPallier2 - currentAverage;

  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 text-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black mb-4">
              Simulateur d'impact sur la mention
            </h2>
            <p className="text-lg md:text-xl text-slate-200 max-w-3xl mx-auto">
              Visualisez l'impact potentiel d'un stage sur votre mention au Bac
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-3xl shadow-2xl p-8 md:p-12 border-2 border-white/20">
            <div className="mb-8">
              <label className="block text-lg font-bold mb-6 text-center">
                Quelle est votre moyenne actuelle ?
              </label>
              
              <div className="space-y-6">
                <input
                  type="range"
                  min="5"
                  max="20"
                  step="0.1"
                  value={currentAverage}
                  onChange={(e) => setCurrentAverage(parseFloat(e.target.value))}
                  className="w-full h-4 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                
                <div className="flex justify-between text-sm text-slate-200">
                  <span>5/20</span>
                  <div className="text-center">
                    <div className="text-5xl font-black text-white mb-2">
                      {currentAverage.toFixed(1)}/20
                    </div>
                    <div className={`text-xl font-bold ${currentMention.color.replace('text-', 'text-white/')}`}>
                      {currentMention.emoji} {currentMention.mention}
                    </div>
                  </div>
                  <span>20/20</span>
                </div>
              </div>

              <button
                onClick={handleCalculate}
                className="mt-8 w-full py-4 px-6 rounded-full bg-gradient-to-r from-blue-700 to-slate-700 hover:from-blue-800 hover:to-slate-800 text-white font-black text-lg shadow-2xl hover:shadow-3xl transition-all hover:scale-105"
              >
                Calculer l'impact potentiel 🎯
              </button>
            </div>

            {showResults && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="h-px bg-white/20 my-8"></div>

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-black mb-2">Projections basées sur nos statistiques</h3>
                  <p className="text-sm text-slate-200">
                    Progression moyenne observée : +4,2 points | Résultats selon travail personnel
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gradient-to-br from-blue-700/25 to-slate-700/25 backdrop-blur rounded-2xl p-6 border-2 border-blue-300/40">
                    <div className="text-center mb-4">
                      <div className="pill-stage-strong mb-3">
                        Pallier 1 : Essentiel
                      </div>
                      <div className="text-xs text-slate-200 mb-4">Progression moyenne : +2,5 points</div>
                    </div>

                    <div className="bg-white/10 backdrop-blur rounded-xl p-6 mb-4">
                      <div className="text-center">
                        <div className="text-sm text-slate-200 mb-2">Moyenne projetée</div>
                        <div className="text-5xl font-black text-white mb-3">
                          {projectedPallier1.toFixed(1)}/20
                        </div>
                        <div className={`text-2xl font-bold ${mentionPallier1.color.replace('text-', 'text-white/')}`}>
                          {mentionPallier1.emoji} {mentionPallier1.mention}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="text-3xl">📈</div>
                      <div>
                        <div className="text-2xl font-black text-green-400">
                          +{pallier1Gain.toFixed(1)} pts
                        </div>
                        <div className="text-xs text-slate-200">Gain potentiel</div>
                      </div>
                    </div>

                    <div className="text-center">
                      <a
                        href="#academies"
                        className="btn-stage-sm"
                      >
                        Voir Pallier 1
                      </a>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-slate-700/30 to-blue-700/20 backdrop-blur rounded-2xl p-6 border-2 border-slate-300/35">
                    <div className="text-center mb-4">
                      <div className="pill-stage-strong mb-3">
                        Pallier 2 : Excellence
                      </div>
                      <div className="text-xs text-slate-200 mb-4">Progression moyenne : +4,5 points</div>
                    </div>

                    <div className="bg-white/10 backdrop-blur rounded-xl p-6 mb-4">
                      <div className="text-center">
                        <div className="text-sm text-slate-200 mb-2">Moyenne projetée</div>
                        <div className="text-5xl font-black text-white mb-3">
                          {projectedPallier2.toFixed(1)}/20
                        </div>
                        <div className={`text-2xl font-bold ${mentionPallier2.color.replace('text-', 'text-white/')}`}>
                          {mentionPallier2.emoji} {mentionPallier2.mention}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-3 mb-4">
                      <div className="text-3xl">🚀</div>
                      <div>
                        <div className="text-2xl font-black text-green-400">
                          +{pallier2Gain.toFixed(1)} pts
                        </div>
                        <div className="text-xs text-slate-200">Gain potentiel</div>
                      </div>
                    </div>

                    <div className="text-center">
                      <a
                        href="#academies"
                        className="btn-stage-gradient"
                      >
                        Voir Pallier 2
                      </a>
                    </div>
                  </div>
                </div>

                <div className="mt-8 p-6 bg-slate-500/20 backdrop-blur rounded-2xl border-2 border-slate-300/45">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">⚠️</div>
                    <div>
                      <h4 className="font-bold text-slate-100 mb-2">Important à savoir</h4>
                      <ul className="text-sm text-white space-y-1">
                        <li>• Ces projections sont basées sur nos statistiques moyennes (+4,2 pts)</li>
                        <li>• Les résultats réels dépendent du travail personnel et de l'implication</li>
                        <li>• Chaque trajectoire est unique et suivie individuellement</li>
                        <li>• Un bilan personnalisé sera établi en fin de stage</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-slate-200 mb-4">
              💡 Vous hésitez entre les deux palliers ?
            </p>
            <a
              href="#reservation"
              className="btn-stage-outline"
            >
              Réserver une consultation gratuite
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
