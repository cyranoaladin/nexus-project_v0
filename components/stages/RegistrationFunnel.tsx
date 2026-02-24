'use client';

import React, { useState } from 'react';
import { analytics } from '@/lib/analytics-stages';
import type { Academy } from '@/data/stages/fevrier2026';

interface RegistrationFunnelProps {
  academies: Academy[];
}

export function RegistrationFunnel({ academies }: RegistrationFunnelProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedAcademy, setSelectedAcademy] = useState<Academy | null>(null);

  const handleSelectAcademy = (academy: Academy) => {
    setSelectedAcademy(academy);
    setStep(2);
    analytics.ctaClick('registration-funnel-step1', academy.id);
  };

  const handleConfirmRegistration = () => {
    if (selectedAcademy) {
      analytics.ctaClick('registration-funnel-step2', `Confirm: ${selectedAcademy.id}`);
      window.location.href = '#reservation';
    }
  };

  const includedItems = [
    'Supports de cours complets',
    'Exercices types Bac + corrections détaillées',
    'Épreuves blanches (2-3 selon pallier)',
    'Bilan individualisé (20-30 min)',
    'Plan de travail personnalisé jusqu\'au Bac',
    'Accès ressources numériques',
    'Suivi personnalisé (6 élèves max)'
  ];

  const badges = [
    { icon: '✓', label: 'Enseignants experts', color: 'text-green-400' },
    { icon: '✓', label: 'Groupes de 6 max', color: 'text-green-400' },
    { icon: '✓', label: 'Cadre structuré', color: 'text-green-400' },
    { icon: '✓', label: 'Bilans individualisés', color: 'text-green-400' }
  ];

  return (
    <section id="registration" className="py-16 md:py-24 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 mb-4">
              Réserver votre place
            </h2>
            <p className="text-lg md:text-xl text-slate-600 max-w-3xl mx-auto">
              {step === 1 ? 'Choisissez votre académie' : 'Récapitulatif de votre sélection'}
            </p>
          </div>

          <div className="mb-8">
            <div className="flex items-center justify-center gap-4">
              <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-slate-500'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 ${
                  step >= 1 ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-600 border-slate-300'
                }`}>
                  1
                </div>
                <span className="font-semibold hidden md:inline">Choix académie</span>
              </div>
              <div className={`h-px w-16 ${step >= 2 ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
              <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-slate-500'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold border-2 ${
                  step >= 2 ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-600 border-slate-300'
                }`}>
                  2
                </div>
                <span className="font-semibold hidden md:inline">Récapitulatif</span>
              </div>
            </div>
          </div>

          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {academies.map((academy) => {
                const isPallier1 = academy.tier === 'pallier1';
                
                return (
                  <div
                    key={academy.id}
                    className={`bg-white rounded-2xl shadow-lg border-2 p-6 hover:shadow-2xl transition-all cursor-pointer hover:scale-105 ${
                      isPallier1 ? 'border-blue-400 hover:border-blue-600' : 'border-brand-secondary/50 hover:border-brand-secondary'
                    }`}
                    onClick={() => handleSelectAcademy(academy)}
                  >
                    <div className={`${isPallier1 ? 'pill-stage-strong' : 'pill-stage-strong'}`}>
                      {isPallier1 ? 'Pallier 1' : 'Pallier 2'}
                    </div>

                    <div className="text-2xl mb-2">{academy.badge.split(' ')[0]}</div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{academy.title}</h3>
                    <p className="text-sm text-slate-600 mb-4">{academy.objective}</p>

                    <div className="mb-4">
                      <div className="text-sm text-slate-600 line-through mb-1">{academy.price} DT</div>
                      <div className="text-2xl font-black text-blue-600">{academy.earlyBirdPrice} DT</div>
                      <div className="text-xs text-blue-700 font-semibold">Tarif anticipé</div>
                    </div>

                    <div className="text-xs text-slate-700 font-semibold mb-4">
                      {academy.seatsLeft} places restantes
                    </div>

                    <button
                      className={`w-full ${isPallier1 ? 'btn-stage-sm' : 'btn-stage-gradient'}`}
                    >
                      Sélectionner
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {step === 2 && selectedAcademy && (
            <div className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-gradient-to-br from-blue-50 to-slate-50 rounded-3xl shadow-2xl p-8 md:p-12 border-2 border-blue-200">
                <button
                  onClick={() => setStep(1)}
                  className="text-blue-700 hover:text-blue-800 font-semibold mb-6 flex items-center gap-2 text-sm"
                >
                  ← Changer d'académie
                </button>

                <div className="bg-white rounded-2xl p-6 mb-6 shadow-md">
                  <h3 className="text-2xl font-black text-slate-900 mb-4">Votre sélection</h3>
                  
                  <div className="flex items-start gap-4 mb-6">
                    <div className="text-4xl">{selectedAcademy.badge.split(' ')[0]}</div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-slate-900 mb-1">{selectedAcademy.title}</h4>
                      <p className="text-sm text-slate-600 mb-3">{selectedAcademy.objective}</p>
                      <div className="pill-stage-strong">
                        {selectedAcademy.durationHours}h — {selectedAcademy.tier === 'pallier1' ? 'Pallier 1' : 'Pallier 2'}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-600">Prix normal</span>
                      <span className="text-slate-600 line-through">{selectedAcademy.price} DT</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-600 font-semibold">Tarif anticipé</span>
                      <span className="text-2xl font-black text-blue-600">{selectedAcademy.earlyBirdPrice} DT</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-blue-700 font-semibold">Économie</span>
                      <span className="text-blue-700 font-bold">-{selectedAcademy.price - selectedAcademy.earlyBirdPrice} DT</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 mb-6 shadow-md">
                  <h4 className="font-bold text-slate-900 mb-4">✅ Inclus dans votre stage</h4>
                  <ul className="space-y-2">
                    {includedItems.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="text-green-700 font-bold mt-0.5">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-white rounded-2xl p-6 mb-8 shadow-md">
                  <h4 className="font-bold text-slate-900 mb-4">🎯 Garanties Nexus Réussite</h4>
                  <div className="grid grid-cols-2 gap-4">
                    {badges.map((badge, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className={badge.color}>{badge.icon}</span>
                        <span className="text-slate-700">{badge.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleConfirmRegistration}
                  className="w-full btn-stage-gradient mb-4"
                >
                  Réserver ma consultation gratuite 📅
                </button>

                <p className="text-xs text-center text-slate-700">
                  {selectedAcademy.seatsLeft} places restantes | Tarif anticipé jusqu'au 5 février
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
