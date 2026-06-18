'use client';

import { useState, useEffect } from 'react';
import { ExamCard } from './exam-card';
import { Offer } from '@/lib/types';

interface HeroSectionProps {
  featuredOffer?: Offer;
  onCta?: (offerId: string) => void;
}

export function HeroSection({ featuredOffer, onCta }: HeroSectionProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section className="relative bg-primary text-card overflow-hidden">
      {/* Decorative gradient background */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 px-4 md:px-6 py-16 md:py-24">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
            {/* Left Content */}
            <div className="space-y-6">
              <div
                className={`transition-all duration-700 ${
                  isVisible
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4'
                }`}
              >
                <span className="inline-block px-4 py-2 bg-accent/20 text-accent rounded-full text-body-sm font-bold mb-4">
                  Préparation au Bac Premium
                </span>
                <h1 className="text-display text-balance leading-tight mb-4">
                  Réussir son Bac avec une Méthode qui Fonctionne
                </h1>
                <p className="text-body-lg text-card/90 text-balance mb-6">
                  Petits groupes, mentorat personnalisé, et plateforme premium.
                  Nos élèves progressent en moyenne de 2 à 4 points.
                </p>
              </div>

              {/* Stats */}
              <div
                className={`grid grid-cols-3 gap-4 py-4 transition-all duration-700 delay-100 ${
                  isVisible
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4'
                }`}
              >
                {[
                  { number: '500+', label: 'Élèves formés' },
                  { number: '15', label: 'Années d\'expérience' },
                  { number: '16/20', label: 'Note moyenne' },
                ].map((stat, idx) => (
                  <div key={idx} className="border border-accent/30 rounded-lg p-4">
                    <p className="text-2xl md:text-3xl font-heading font-bold text-accent">
                      {stat.number}
                    </p>
                    <p className="text-body-sm text-card/80">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div
                className={`flex flex-col sm:flex-row gap-4 pt-4 transition-all duration-700 delay-200 ${
                  isVisible
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4'
                }`}
              >
                <button className="px-8 py-3 bg-accent text-primary font-bold rounded-lg hover:bg-accent/90 transition-smooth focus-ring">
                  Découvrir les offres
                </button>
                <button className="px-8 py-3 border-2 border-card/40 text-card font-bold rounded-lg hover:border-card/60 transition-smooth focus-ring">
                  Réserver une démo
                </button>
              </div>
            </div>

            {/* Right: Featured Card */}
            {featuredOffer && (
              <div
                className={`transition-all duration-700 delay-300 ${
                  isVisible
                    ? 'opacity-100 translate-y-0 scale-100'
                    : 'opacity-0 translate-y-8 scale-95'
                }`}
              >
                <div className="sticky top-24">
                  <ExamCard
                    offer={featuredOffer}
                    featured={true}
                    onCta={onCta}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom wave effect */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
