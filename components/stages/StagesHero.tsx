'use client';

import React from 'react';
import { analytics } from '@/lib/analytics-stages';
import type { Stat } from '@/data/stages/fevrier2026';

interface StagesHeroProps {
  stats: Stat[];
}

export function StagesHero({ stats }: StagesHeroProps) {
  const handlePrimaryCTA = () => {
    analytics.ctaClick('hero-primary', 'Réserver une consultation gratuite');
  };

  const handleSecondaryCTA = () => {
    analytics.ctaClick('hero-secondary', 'Découvrir les académies');
  };

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white py-20 md:py-32">
      {/* Background effects */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />

      <div className="container relative z-10 mx-auto px-4 md:px-6">
        <div className="max-w-5xl mx-auto text-center">
          {/* Slogan */}
          <p className="text-sm md:text-base text-yellow-300 font-semibold mb-2 uppercase tracking-wider">
            Nexus Réussite, le déclic vers ta réussite !
          </p>

          {/* H1 */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-tight mb-6">
            STAGE DE FÉVRIER —<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
              LE BOOST DÉCISIF
            </span><br />
            POUR FAIRE LA DIFFÉRENCE !<br />
            <span className="text-blue-300 text-2xl md:text-4xl mt-2 inline-block">PREMIÈRE & TERMINALE</span><br />
            <span className="text-blue-300 text-3xl md:text-5xl">(MATHS & NSI)</span>
          </h1>

          {/* Sous-texte explicite */}
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 max-w-3xl mx-auto mb-6">
            <p className="text-base md:text-lg text-white leading-relaxed">
              Ces stages s'adressent aux élèves de <strong>Première et Terminale</strong> préparant le baccalauréat français. 
              Les contenus sont adaptés au niveau de chaque élève, tout en conservant une exigence et une méthode communes.
            </p>
          </div>

          {/* Sous-texte */}
          <p className="text-lg md:text-xl text-blue-100 mb-4 max-w-3xl mx-auto leading-relaxed">
            Février n'est pas une pause : c'est un moment clé. C'est là que se jouent la dynamique de fin d'année, la confiance et la maîtrise avant la dernière ligne droite des dossiers d'admission et du Bac.
          </p>

          <p className="text-base md:text-lg text-blue-200 mb-10 max-w-2xl mx-auto">
            Une semaine structurée pour consolider, combler les lacunes, et transformer le travail en points décisifs.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <a
              href="#reservation"
              onClick={handlePrimaryCTA}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-base font-bold transition-all shadow-xl hover:shadow-2xl hover:scale-105"
              aria-label="Réserver une consultation gratuite"
            >
              📅 Réserver une consultation gratuite
            </a>
            <a
              href="#academies"
              onClick={handleSecondaryCTA}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white border border-white/30 px-8 py-4 text-base font-bold transition-all"
              aria-label="Découvrir les académies"
            >
              Découvrir les académies
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto mb-12">
            {stats.map((stat, idx) => (
              <div key={idx} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
                <div className="text-4xl md:text-5xl font-black text-white mb-2">{stat.value}</div>
                <div className="text-sm text-blue-200 uppercase tracking-wider font-semibold">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 max-w-2xl mx-auto mb-10 hover:bg-white/10 transition-all">
            <p className="text-lg italic text-white mb-2">"Une semaine qui a changé mon orientation"</p>
            <p className="text-sm text-blue-200">— Sarah, Terminale</p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-full border border-white/20">
              <span className="text-green-400">✓</span>
              <span>6 élèves max par groupe</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-full border border-white/20">
              <span className="text-green-400">✓</span>
              <span>Enseignants experts (agrégés / certifiés)</span>
            </div>
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur px-4 py-2 rounded-full border border-white/20">
              <span className="text-green-400">✓</span>
              <span>Cadre structuré + bilans</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
