'use client';

import React from 'react';
import { AlertTriangle, Check, Layers3 } from 'lucide-react';
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
    <section className="py-16 md:py-20 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Titre */}
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 text-center mb-4">
            <span className="inline-flex items-center gap-3">
              <Layers3 className="h-8 w-8 text-blue-700" aria-hidden="true" />
              Deux paliers pour répondre à chaque profil
            </span>
          </h2>
          <p className="text-lg text-slate-600 text-center mb-12 max-w-3xl mx-auto">
            Excellence, maîtrise, trajectoire. Deux niveaux d'exigence pour une progression mesurée.
          </p>

          {/* Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            {tiers.map((tier) => (
              <div
                key={tier.id}
                className="bg-white border-2 border-slate-200 rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all hover:border-blue-400 hover:-translate-y-1"
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
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" aria-hidden="true" />
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
                        className="pill-stage-strong"
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
          <div className="bg-slate-100 border-l-4 border-slate-500 p-6 rounded-lg mb-12 max-w-3xl mx-auto">
            <p className="inline-flex items-center gap-2 text-sm text-slate-800 font-medium italic">
              <AlertTriangle className="h-4 w-4 text-slate-600" aria-hidden="true" />
              Les résultats dépendent du travail personnel et de l'implication de chacun.
            </p>
          </div>

          {/* CTA */}
          <div className="text-center">
            <a
              href="#academies"
              onClick={handleCTAClick}
              className="btn-stage"
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
