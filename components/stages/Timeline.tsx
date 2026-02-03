'use client';

import React from 'react';
import { analytics } from '@/lib/analytics-stages';

interface TimelineItem {
  title: string;
  description: string;
}

interface TimelineProps {
  items: TimelineItem[];
}

export function Timeline({ items }: TimelineProps) {
  const handleCTAClick = () => {
    analytics.ctaClick('timeline', 'Réserver un bilan gratuit');
  };

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Titre */}
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 text-center mb-4">
            ⏰ Février : le moment qui décide
          </h2>
          <p className="text-lg text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            Une trajectoire en trois étapes. Agir maintenant pour maîtriser la suite.
          </p>

          {/* Timeline cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="relative bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow"
              >
                <div className="absolute -top-4 -left-4 w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl shadow-lg">
                  {idx + 1}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-3 mt-2">{item.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>

          {/* CTA discret */}
          <div className="text-center">
            <a
              href="#reservation"
              onClick={handleCTAClick}
              className="inline-block rounded-full bg-slate-900 hover:bg-slate-800 text-white px-8 py-3 text-sm font-bold transition-all shadow-md hover:shadow-lg"
              aria-label="Réserver un bilan gratuit"
            >
              Réserver un bilan gratuit
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
