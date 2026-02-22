'use client';

import React, { useState } from 'react';
import { analytics } from '@/lib/analytics-stages';

interface DaySchedule {
  id: string;
  day: string;
  date: string;
  pallier1: {
    morning: string[];
    afternoon: string[];
  };
  pallier2: {
    morning: string[];
    afternoon: string[];
  };
  highlight?: boolean;
}

interface DetailedScheduleProps {
  schedule: DaySchedule[];
}

export function DetailedSchedule({ schedule }: DetailedScheduleProps) {
  const [openDay, setOpenDay] = useState<string | null>(schedule[0]?.id || null);
  const [activeTier, setActiveTier] = useState<'pallier1' | 'pallier2'>('pallier1');

  const toggleDay = (dayId: string) => {
    setOpenDay(openDay === dayId ? null : dayId);
    analytics.ctaClick('schedule-accordion', `Day: ${dayId}`);
  };

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 mb-4">
              Planning 16–26 février
            </h2>
            <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto mb-8">
              Une semaine structurée, jour par jour
            </p>

            <div className="inline-flex gap-2 p-1 bg-slate-100 rounded-full">
              <button
                onClick={() => setActiveTier('pallier1')}
                className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                  activeTier === 'pallier1'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pallier 1 (22h)
              </button>
              <button
                onClick={() => setActiveTier('pallier2')}
                className={`px-6 py-2 rounded-full font-semibold text-sm transition-all ${
                  activeTier === 'pallier2'
                    ? 'bg-brand-secondary text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pallier 2 (30h)
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {schedule.map((day) => {
              const isOpen = openDay === day.id;
              const tierSchedule = activeTier === 'pallier1' ? day.pallier1 : day.pallier2;

              return (
                <div
                  key={day.id}
                  className={`border-2 rounded-2xl overflow-hidden transition-all ${
                    day.highlight
                      ? 'border-blue-300 bg-blue-50/60'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <button
                    onClick={() => toggleDay(day.id)}
                    className="w-full px-6 py-5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`text-2xl ${isOpen ? 'animate-bounce' : ''}`}>
                        {day.highlight ? '⭐' : '📅'}
                      </div>
                      <div className="text-left">
                        <h3 className="text-lg font-bold text-slate-900">{day.day}</h3>
                        <p className="text-sm text-slate-600">{day.date}</p>
                      </div>
                    </div>
                    <div className={`text-2xl transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      ▼
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-5 border border-slate-200">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-2xl">🌅</span>
                            <h4 className="font-bold text-slate-900">Matin (9h-12h30)</h4>
                          </div>
                          <ul className="space-y-2">
                            {tierSchedule.morning.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                                <span className="text-blue-600 font-bold mt-0.5">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl p-5 border border-blue-200">
                          <div className="flex items-center gap-2 mb-4">
                            <span className="text-2xl">🌆</span>
                            <h4 className="font-bold text-slate-900">Après-midi (14h-17h30)</h4>
                          </div>
                          <ul className="space-y-2">
                            {tierSchedule.afternoon.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                                <span className="text-brand-secondary font-bold mt-0.5">•</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-slate-50 rounded-2xl border-2 border-blue-200">
            <div className="flex items-start gap-4">
              <div className="text-3xl">🕌</div>
              <div>
                <h4 className="font-bold text-slate-900 mb-2">Adaptation Ramadan</h4>
                <p className="text-sm text-slate-700">
                  Organisation matin/après-midi adaptable selon le rythme du Ramadan pour maintenir
                  la qualité de concentration et d'apprentissage.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
