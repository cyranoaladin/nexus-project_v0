'use client';

import React from 'react';
import { BookOpen, Code2, Info, Pin } from 'lucide-react';
import { analytics } from '@/lib/analytics-stages';
import type { SubjectTierContent } from '@/data/stages/fevrier2026';

interface SubjectTierTableProps {
  subjectsContent: SubjectTierContent[];
}

export function SubjectTierTable({ subjectsContent }: SubjectTierTableProps) {
  const handleCTAClick = () => {
    analytics.ctaClick('subject-tier-table', 'Réserver une consultation gratuite');
  };

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Titre */}
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 text-center mb-4">
            Maths & NSI : ce que couvre février
          </h2>
          <p className="text-lg text-slate-600 text-center mb-4 max-w-3xl mx-auto">
            Fondamentaux, méthode, confiance. Sans catalogue, sans superflu.
          </p>
          
          {/* Sous-label explicite */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-3xl mx-auto mb-12">
            <p className="text-sm text-blue-900 text-center leading-relaxed">
              Les contenus sont adaptés au niveau (<strong>Première ou Terminale</strong>) et au pallier choisi, 
              afin de garantir une progression cohérente et efficace.
            </p>
          </div>

          {/* Subjects */}
          <div className="space-y-12">
            {subjectsContent.map((subject) => (
              <div key={subject.subject} className="bg-slate-50 rounded-3xl p-8 border border-slate-200">
                <div className="mb-8">
                  <h3 className="inline-flex items-center gap-3 text-2xl font-black text-slate-900 uppercase tracking-wide">
                    {subject.subject === 'maths' ? (
                      <BookOpen className="h-6 w-6 text-blue-700" aria-hidden="true" />
                    ) : (
                      <Code2 className="h-6 w-6 text-blue-700" aria-hidden="true" />
                    )}
                    {subject.subject === 'maths' ? 'Mathématiques' : 'NSI'}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">Première & Terminale</p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  {/* Pallier 1 */}
                  <div className="bg-white rounded-2xl p-6 border-2 border-blue-200">
                    <h4 className="text-lg font-bold text-blue-900 mb-4">Pallier 1 : Prépa Bac / Essentiels</h4>
                    <ul className="space-y-2">
                      {subject.pallier1.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="text-blue-600 mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pallier 2 */}
                  <div className="bg-white rounded-2xl p-6 border-2 border-brand-secondary/40">
                    <h4 className="text-lg font-bold text-blue-900 mb-4">Pallier 2 : Excellence</h4>
                    <ul className="space-y-2">
                      {subject.pallier2.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="text-brand-secondary mt-0.5">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* NSI specific note */}
          <div className="mt-12 bg-blue-50 border-l-4 border-blue-500 p-6 rounded-lg max-w-4xl mx-auto">
            <h4 className="inline-flex items-center gap-2 text-base font-bold text-blue-900 mb-2">
              <Pin className="h-4 w-4" aria-hidden="true" />
              Concernant l'épreuve pratique et le Grand Oral
            </h4>
            <p className="text-sm text-blue-800 mb-2">
              Pas d'inquiétude. Ils seront travaillés spécifiquement lors des <strong>vacances de printemps</strong> via un pack dédié.
            </p>
            <p className="inline-flex items-center gap-2 text-sm text-blue-700 italic">
              <Info className="h-4 w-4" aria-hidden="true" />
              Les candidats libres ne passent pas l'épreuve pratique.
            </p>
          </div>

          {/* CTA */}
          <div className="text-center mt-12">
            <a
              href="#reservation"
              onClick={handleCTAClick}
              className="btn-stage"
              aria-label="Réserver une consultation gratuite"
            >
              Réserver une consultation gratuite
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
