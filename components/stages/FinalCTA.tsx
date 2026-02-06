'use client';

import React, { useState, useEffect } from 'react';
import { StagesReservationForm } from './StagesReservationForm';
import type { Academy } from '@/data/stages/fevrier2026';

interface FinalCTAProps {
  closingDate: string;
  academies: Academy[];
}

export function FinalCTA({ closingDate, academies }: FinalCTAProps) {
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

          {/* Places restantes - Dynamique */}
          <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6 mb-10 max-w-3xl mx-auto">
            <h3 className="text-lg font-bold mb-4 text-center">Places restantes par académie</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {academies.map((academy) => {
                const colorClass = academy.seatsLeft <= 3 ? 'text-red-300' : academy.seatsLeft <= 5 ? 'text-yellow-300' : 'text-green-300';
                const levelLabel = academy.level === 'terminale' ? 'Term.' : '1ère';
                const tierLabel = academy.tier === 'pallier1' ? 'P1' : 'P2';
                const subjectLabel = academy.subject === 'maths' ? 'Maths' : 'NSI';
                
                return (
                  <div key={academy.id} className="text-center">
                    <div className="font-bold mb-1 text-white">{subjectLabel} {levelLabel} {tierLabel}</div>
                    <div className={`${colorClass} font-bold`}>
                      {academy.seatsLeft} {academy.seatsLeft === 1 ? 'place' : 'places'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Formulaire de réservation */}
          <div className="max-w-2xl mx-auto">
            <StagesReservationForm academies={academies} />
          </div>
        </div>
      </div>
    </section>
  );
}
