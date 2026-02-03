'use client';

import React from 'react';
import { analytics } from '@/lib/analytics-stages';
import type { TierInfo } from '@/data/stages/fevrier2026';

interface TierCardsProps {
  tiers: TierInfo[];
}

export function TierCards({ tiers }: TierCardsProps) {
  const handleCTAClick = () => {
    analytics.ctaClick('tier-cards', 'Découvrir les académies');
  };

  return (
    <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Titre */}
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 text-center mb-4">
            🎯 Deux paliers pour répondre à chaque profil
          </h2>
          <p className="text-lg text-slate-600 text-center mb-12 max-w-3xl mx-auto">
            Excellence, maîtrise, trajectoire. Deux niveaux d'exigence pour une progression mesurée.
          </p>

          {/* Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all hover:border-blue-400"
              >
                <div className="mb-4">
                  <h3 className="text-2xl font-black text-slate-900 mb-2">{tier.title}</h3>
                  <p className="text-base text-blue-600 font-semibold">{tier.subtitle}</p>
                </div>

                <p className="text-slate-700 mb-6 leading-relaxed">{tier.description}</p>

                <div className="mb-6">
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">Contenu :</h4>
                  <ul className="space-y-2">
                    {tier.bullets.map((bullet, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="text-blue-600 mt-0.5">✓</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">Public cible :</h4>
                  <div className="flex flex-wrap gap-2">
                    {tier.publicCible.map((pub, idx) => (
                      <span
                        key={idx}
                        className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold"
                      >
                        {pub}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Phrase honnête obligatoire */}
          <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-lg mb-12 max-w-3xl mx-auto">
            <p className="text-sm text-amber-900 font-medium italic">
              ⚠️ Les résultats dépendent du travail personnel et de l'implication de chacun.
            </p>
          </div>

          {/* CTA */}
          <div className="text-center">
            <a
              href="#academies"
              onClick={handleCTAClick}
              className="inline-block rounded-full bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 text-base font-bold transition-all shadow-lg hover:shadow-xl hover:scale-105"
              aria-label="Découvrir les académies"
            >
              Découvrir les académies
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
