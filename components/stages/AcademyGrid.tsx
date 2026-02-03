'use client';

import React, { useState } from 'react';
import { analytics } from '@/lib/analytics-stages';
import type { Academy } from '@/data/stages/fevrier2026';

interface AcademyGridProps {
  academies: Academy[];
}

export function AcademyGrid({ academies }: AcademyGridProps) {
  const [filter, setFilter] = useState<'all' | 'premiere' | 'terminale'>('all');

  const filtered = filter === 'all' ? academies : academies.filter(a => a.level === filter);

  const handleSelectAcademy = (academyId: string) => {
    analytics.selectAcademy(academyId);
    analytics.ctaClick('academy-card', 'Réserver une consultation gratuite');
  };

  return (
    <section id="academies" className="py-20 bg-gradient-to-br from-white to-slate-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          {/* Titre */}
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 text-center mb-4">
            Nos Académies Février 2026
          </h2>
          <p className="text-lg text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            Maîtrise, progression, trajectoire. Choisissez votre palier.
          </p>

          {/* Filters */}
          <div className="flex justify-center gap-4 mb-12">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${
                filter === 'all'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-slate-600 border border-slate-300 hover:border-blue-400'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilter('premiere')}
              className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${
                filter === 'premiere'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-slate-600 border border-slate-300 hover:border-blue-400'
              }`}
            >
              Première
            </button>
            <button
              onClick={() => setFilter('terminale')}
              className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${
                filter === 'terminale'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-slate-600 border border-slate-300 hover:border-blue-400'
              }`}
            >
              Terminale
            </button>
          </div>

          {/* Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filtered.map((academy) => (
              <div
                key={academy.id}
                className="bg-white border-2 border-slate-200 rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all hover:border-blue-400 flex flex-col"
              >
                {/* Badge */}
                <div className="mb-4">
                  <span className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider">
                    {academy.badge}
                  </span>
                </div>

                {/* Title */}
                <h3 className="text-xl font-black text-slate-900 mb-2">{academy.title}</h3>

                {/* Objective */}
                <p className="text-sm text-slate-600 mb-4">{academy.objective}</p>

                {/* Info */}
                <div className="space-y-2 text-xs text-slate-700 mb-4">
                  <div className="flex justify-between">
                    <span className="font-semibold">Durée :</span>
                    <span>{academy.durationHours}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Groupe :</span>
                    <span>{academy.groupSizeMax} élèves max</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-semibold">Niveau :</span>
                    <span className="capitalize">{academy.level}</span>
                  </div>
                </div>

                {/* Promise */}
                <p className="text-sm text-slate-700 italic mb-6 flex-grow">{academy.promise}</p>

                {/* Pricing */}
                <div className="bg-slate-50 rounded-xl p-4 mb-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs text-slate-500 line-through">{academy.price} TND</span>
                    <span className="text-2xl font-black text-blue-600">{academy.earlyBirdPrice} TND</span>
                  </div>
                  <p className="text-xs text-green-600 font-semibold">
                    🎟️ Early Bird • {academy.seatsLeft} places restantes
                  </p>
                </div>

                {/* CTAs */}
                <div className="space-y-2">
                  <a
                    href="#reservation"
                    onClick={() => handleSelectAcademy(academy.id)}
                    className="block w-full text-center rounded-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 text-sm font-bold transition-all shadow-md hover:shadow-lg"
                    aria-label="Réserver une consultation gratuite"
                  >
                    Réserver une consultation gratuite
                  </a>
                  <a
                    href={academy.detailsAnchor}
                    className="block w-full text-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-6 py-2 text-xs font-semibold transition-all"
                    aria-label="Voir les détails"
                  >
                    Voir les détails
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
