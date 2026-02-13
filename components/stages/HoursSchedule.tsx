'use client';

import React from 'react';
import { analytics } from '@/lib/analytics-stages';

interface HoursScheduleProps {
  schedule: {
    pallier1: { description: string; detail: string[] };
    pallier2: { description: string; detail: string[] };
    note: string;
  };
}

export function HoursSchedule({ schedule }: HoursScheduleProps) {
  const handleCTAClick = () => {
    analytics.ctaClick('hours-schedule', 'Découvrir les académies');
  };

  return (
    <section className="py-20 bg-gradient-to-br from-slate-900 to-blue-900 text-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          {/* Titre */}
          <h2 className="text-3xl md:text-5xl font-black text-center mb-4">
            Volumes horaires réalistes, structurés
          </h2>
          <p className="text-lg text-blue-200 text-center mb-12 max-w-2xl mx-auto">
            Un cadre exigeant adapté au rythme de chacun.
          </p>

          {/* Cards */}
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Pallier 1 */}
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-blue-300 mb-2">Pallier 1</h3>
              <p className="text-2xl font-black text-white mb-4">{schedule.pallier1.description}</p>
              <ul className="space-y-2 text-sm text-blue-100">
                {schedule.pallier1.detail.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pallier 2 */}
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-purple-300 mb-2">Pallier 2</h3>
              <p className="text-2xl font-black text-white mb-4">{schedule.pallier2.description}</p>
              <ul className="space-y-2 text-sm text-blue-100">
                {schedule.pallier2.detail.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-purple-400 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Note */}
          <div className="bg-amber-500/20 border border-amber-500/30 rounded-xl p-4 mb-12 text-center">
            <p className="text-sm text-amber-100">{schedule.note}</p>
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
