'use client';

import React, { useState } from 'react';
import { BookOpen, CalendarRange, CircleHelp, Rocket, Sparkles } from 'lucide-react';
import { analytics } from '@/lib/analytics-stages';
import type { Academy } from '@/data/stages/fevrier2026';
import { resolveUiIcon } from '@/lib/ui-icons';

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
    <section id="academies" className="py-16 md:py-20 bg-gradient-to-br from-white to-slate-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          {/* Titre */}
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 text-center mb-4">
            Nos Académies Février 2026
          </h2>
          <p className="text-lg text-slate-600 text-center mb-4 max-w-2xl mx-auto">
            Maîtrise, progression, trajectoire. Choisissez votre palier.
          </p>
          
          {/* Clarification Première & Terminale */}
          <p className="text-sm text-slate-600 text-center mb-8 max-w-xl mx-auto">
            Chaque académie s'adapte au niveau (Première ou Terminale). 
            La différence essentielle se joue sur le <strong>pallier</strong> choisi.
          </p>

          {/* Filters */}
          <div className="flex justify-center gap-4 mb-12">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-2 rounded-full font-bold text-sm transition-all ${
                filter === 'all'
                  ? 'btn-stage-sm'
                  : 'bg-white text-slate-600 border border-slate-300 hover:border-blue-400'
              }`}
            >
              Toutes les académies
            </button>
            <button
              onClick={() => setFilter('premiere')}
              className={`px-6 py-2 rounded-full font-semibold text-xs transition-all ${
                filter === 'premiere'
                  ? 'bg-slate-600 text-white shadow-lg rounded-full px-6 py-2'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400'
              }`}
            >
              Première
            </button>
            <button
              onClick={() => setFilter('terminale')}
              className={`px-6 py-2 rounded-full font-semibold text-xs transition-all ${
                filter === 'terminale'
                  ? 'bg-slate-600 text-white shadow-lg rounded-full px-6 py-2'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-400'
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
                className={`relative bg-white rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1 flex flex-col ${
                  academy.tier === 'pallier1'
                    ? 'border-2 border-blue-300 hover:border-blue-500'
                    : 'border-2 border-brand-secondary/50 hover:border-brand-secondary ring-4 ring-blue-100'
                }`}
              >
                {/* Ribbon for Pallier 2 */}
                {academy.tier === 'pallier2' && (
                  <div className="absolute -top-3 -right-3 pill-stage-strong shadow-lg">
                    <span className="inline-flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      Excellence
                    </span>
                  </div>
                )}

                {/* Badge principal (Objectif) */}
                <div className="mb-3">
                  <span className="pill-stage-strong shadow-md">
                    {(() => {
                      const BadgeIcon = resolveUiIcon(academy.badge.split(' ')[0]);
                      return (
                        <span className="inline-flex items-center gap-2">
                          <BadgeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          {academy.badge.replace(/^[^\s]+\s*/, '')}
                        </span>
                      );
                    })()}
                  </span>
                </div>

                {/* Pallier badge avec description claire */}
                <div className={`mb-4 p-3 rounded-lg ${
                  academy.tier === 'pallier1'
                    ? 'bg-blue-50 border border-blue-200'
                    : 'bg-slate-50 border border-brand-secondary/30'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold uppercase ${
                      academy.tier === 'pallier1' ? 'text-blue-700' : 'text-blue-800'
                    }`}>
                      <span className="inline-flex items-center gap-2">
                        {academy.tier === 'pallier1' ? (
                          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {academy.tier === 'pallier1' ? 'Pallier 1' : 'Pallier 2'}
                      </span>
                    </span>
                    <span className={`text-xs font-semibold ${
                      academy.tier === 'pallier1' ? 'text-blue-600' : 'text-brand-secondary'
                    }`}>
                      {academy.tier === 'pallier1' ? 'Prépa Bac' : 'Excellence'}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${
                    academy.tier === 'pallier1' ? 'text-blue-800' : 'text-slate-700'
                  }`}>
                    {academy.tier === 'pallier1' 
                      ? 'Consolider les bases, méthode fiable' 
                      : 'Viser la mention, maîtrise avancée'}
                  </p>
                </div>

                {/* Title */}
                <h3 className="text-xl font-black text-slate-900 mb-2">{academy.title}</h3>

                {/* Objective */}
                <p className="text-sm text-slate-600 mb-4 font-medium">{academy.objective}</p>

                {/* Info en cards */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-slate-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-slate-600 mb-1">Durée</div>
                    <div className="text-sm font-bold text-slate-900">{academy.durationHours}h</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 text-center">
                    <div className="text-xs text-slate-600 mb-1">Groupe</div>
                    <div className="text-sm font-bold text-slate-900">{academy.groupSizeMax} élèves</div>
                  </div>
                </div>

                {/* Niveau badge */}
                <div className="mb-4">
                  <span className="pill-stage-strong">
                    <span className="inline-flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                      Niveau : <span className="capitalize">{academy.level}</span>
                    </span>
                  </span>
                </div>

                {/* Promise */}
                <div className="bg-gradient-to-r from-slate-50 to-white border-l-4 border-blue-500 rounded-lg p-3 mb-6 flex-grow">
                  <p className="text-xs text-slate-700 leading-relaxed">{academy.promise}</p>
                </div>

                {/* Pricing - mise en avant */}
                <div className={`rounded-xl p-4 mb-4 ${
                  academy.tier === 'pallier1'
                    ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200'
                    : 'bg-gradient-to-br from-slate-50 to-blue-100 border-2 border-brand-secondary/35'
                }`}>
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs text-slate-600 line-through">Prix: {academy.price} TND</span>
                    <div className="text-right">
                      <div className={`text-2xl font-black ${
                        academy.tier === 'pallier1' ? 'text-blue-700' : 'text-blue-800'
                      }`}>
                        {academy.earlyBirdPrice} TND
                      </div>
                      <div className="text-xs text-slate-600 font-semibold">Early Bird</div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-300">
                    <p className="text-xs font-bold text-center">
                      {academy.seatsLeft <= 3 ? (
                        <span className="text-slate-800">Places limitées: {academy.seatsLeft} restantes</span>
                      ) : (
                        <span className="text-blue-700">{academy.seatsLeft} places restantes</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* CTAs */}
                <div className="space-y-2">
                  <a
                    href="#reservation"
                    onClick={() => handleSelectAcademy(academy.id)}
                    className={`block w-full ${academy.tier === 'pallier1' ? 'btn-stage-sm' : 'btn-stage-gradient'}`}
                    aria-label="Réserver une consultation gratuite"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CalendarRange className="h-4 w-4" aria-hidden="true" />
                      Réserver une consultation
                    </span>
                  </a>
                  <a
                    href="#faq"
                    className="block w-full text-center rounded-full bg-white/10 border border-white/20 text-white px-6 py-2 text-xs font-semibold transition-all hover:bg-white/15"
                    aria-label="Voir les questions fréquentes"
                  >
                    <span className="inline-flex items-center gap-2">
                      <CircleHelp className="h-4 w-4" aria-hidden="true" />
                      Questions fréquentes
                    </span>
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
