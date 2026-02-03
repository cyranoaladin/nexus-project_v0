'use client';

import React from 'react';
import type { Testimonial } from '@/data/stages/fevrier2026';

interface SocialProofProps {
  testimonials: Testimonial[];
}

export function SocialProof({ testimonials }: SocialProofProps) {
  return (
    <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-6xl mx-auto">
          {/* Titre */}
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 text-center mb-4">
            Preuves & engagements
          </h2>
          <p className="text-lg text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            Cadre structuré, progression selon engagement. Pas de promesses irréalistes.
          </p>

          {/* Stats cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-lg">
              <div className="text-4xl font-black text-blue-600 mb-2">98%</div>
              <div className="text-sm text-slate-700 font-semibold">Satisfaction observée</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-lg">
              <div className="text-4xl font-black text-purple-600 mb-2">+4,2 pts</div>
              <div className="text-sm text-slate-700 font-semibold">Progression moyenne</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-lg">
              <div className="text-4xl font-black text-green-600 mb-2">150+</div>
              <div className="text-sm text-slate-700 font-semibold">Mentions TB obtenues</div>
            </div>
          </div>

          {/* Engagements */}
          <div className="bg-white border-2 border-blue-200 rounded-3xl p-8 mb-12">
            <h3 className="text-2xl font-black text-slate-900 mb-6 text-center">Nos engagements</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Bilans individualisés</h4>
                  <p className="text-sm text-slate-600">Plan de travail personnalisé en fin de stage.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Épreuves blanches</h4>
                  <p className="text-sm text-slate-600">Simulation en conditions réelles.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Cadre exigeant</h4>
                  <p className="text-sm text-slate-600">Méthode rigoureuse, groupe restreint (6 max).</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-600 font-bold">✓</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">Progression mesurée</h4>
                  <p className="text-sm text-slate-600">Selon votre travail et implication.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Testimonials */}
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-lg">
                <p className="text-sm text-slate-700 italic mb-4">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                    {testimonial.author[0]}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{testimonial.author}</div>
                    <div className="text-xs text-slate-600">{testimonial.role}</div>
                  </div>
                </div>
                {testimonial.tags && testimonial.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {testimonial.tags.map((tag, tagIdx) => (
                      <span
                        key={tagIdx}
                        className="inline-block bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
