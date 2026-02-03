'use client';

import React, { useState, useEffect } from 'react';
import { analytics } from '@/lib/analytics-stages';

interface FinalCTAProps {
  closingDate: string;
}

export function FinalCTA({ closingDate }: FinalCTAProps) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const deadline = new Date(closingDate).getTime();
      const now = new Date().getTime();
      const diff = deadline - now;

      if (diff > 0) {
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / (1000 * 60)) % 60)
        });
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(interval);
  }, [closingDate]);

  const handleCTAClick = () => {
    analytics.ctaClick('final-cta', 'Réserver une consultation gratuite');
  };

  return (
    <section id="reservation" className="py-20 bg-gradient-to-br from-red-600 to-orange-600 text-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Titre */}
          <h2 className="text-3xl md:text-5xl font-black mb-6">
            ⚠️ Dernières places avant le 10/02
          </h2>

          {/* Countdown */}
          <div className="flex justify-center gap-4 mb-8">
            <div className="bg-white/20 backdrop-blur rounded-xl p-4 min-w-[80px]">
              <div className="text-4xl font-black">{String(timeLeft.days).padStart(2, '0')}</div>
              <div className="text-xs uppercase tracking-wider mt-1">Jours</div>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-xl p-4 min-w-[80px]">
              <div className="text-4xl font-black">{String(timeLeft.hours).padStart(2, '0')}</div>
              <div className="text-xs uppercase tracking-wider mt-1">Heures</div>
            </div>
            <div className="bg-white/20 backdrop-blur rounded-xl p-4 min-w-[80px]">
              <div className="text-4xl font-black">{String(timeLeft.minutes).padStart(2, '0')}</div>
              <div className="text-xs uppercase tracking-wider mt-1">Minutes</div>
            </div>
          </div>

          {/* Texte urgence */}
          <p className="text-xl mb-2">
            Les inscriptions se font dans l'ordre d'arrivée.
          </p>
          <p className="text-lg text-white/90 mb-8">
            Février peut changer la dynamique de fin d'année. À condition d'agir maintenant.
          </p>

          {/* Places restantes */}
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 mb-10 max-w-2xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-bold mb-1">Maths Term. P1</div>
                <div className="text-yellow-300">5 places</div>
              </div>
              <div>
                <div className="font-bold mb-1">Maths Term. P2</div>
                <div className="text-yellow-300">3 places</div>
              </div>
              <div>
                <div className="font-bold mb-1">NSI Term. P1</div>
                <div className="text-yellow-300">4 places</div>
              </div>
              <div>
                <div className="font-bold mb-1">NSI Term. P2</div>
                <div className="text-yellow-300">3 places</div>
              </div>
              <div>
                <div className="font-bold mb-1">Première Maths</div>
                <div className="text-green-300">6 places</div>
              </div>
              <div>
                <div className="font-bold mb-1">Première NSI</div>
                <div className="text-green-300">6 places</div>
              </div>
            </div>
          </div>

          {/* CTA final */}
          <a
            href="#contact-form"
            onClick={handleCTAClick}
            className="inline-block rounded-full bg-white text-red-600 px-12 py-5 text-xl font-black hover:bg-gray-100 transition-all shadow-2xl hover:shadow-3xl hover:scale-105"
            aria-label="Réserver une consultation gratuite"
          >
            Réserver une consultation gratuite
          </a>
        </div>
      </div>
    </section>
  );
}
