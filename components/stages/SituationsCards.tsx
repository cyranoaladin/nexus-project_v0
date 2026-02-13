'use client';

import React from 'react';
import { analytics } from '@/lib/analytics-stages';

interface Situation {
  id: string;
  icon: string;
  title: string;
  problem: string;
  question: string;
  solution: string;
  ctaText: string;
  ctaLink: string;
}

interface SituationsCardsProps {
  situations: Situation[];
}

export function SituationsCards({ situations }: SituationsCardsProps) {
  const handleCTA = (situationId: string) => {
    analytics.ctaClick(`situation-${situationId}`, 'Voir la solution');
  };

  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 mb-4">
              3 situations classiques
            </h2>
            <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
              Vous vous reconnaissez ? Nous avons la solution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {situations.map((situation) => (
              <div
                key={situation.id}
                className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-slate-200 hover:border-blue-400 flex flex-col"
              >
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 p-6 text-white">
                  <div className="text-4xl mb-3">{situation.icon}</div>
                  <h3 className="text-xl font-bold">{situation.title}</h3>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-red-600 font-semibold mb-2">
                      ❌ Problème
                    </div>
                    <p className="text-sm text-slate-700">{situation.problem}</p>
                  </div>

                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-wider text-blue-600 font-semibold mb-2">
                      ❓ Votre question
                    </div>
                    <p className="text-sm font-medium text-slate-800 italic">
                      "{situation.question}"
                    </p>
                  </div>

                  <div className="mb-6 flex-1">
                    <div className="text-xs uppercase tracking-wider text-green-700 font-semibold mb-2">
                      ✅ Notre réponse
                    </div>
                    <p className="text-sm text-slate-700">{situation.solution}</p>
                  </div>

                  <a
                    href={situation.ctaLink}
                    onClick={() => handleCTA(situation.id)}
                    className="btn-stage-sm w-full"
                  >
                    {situation.ctaText}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
