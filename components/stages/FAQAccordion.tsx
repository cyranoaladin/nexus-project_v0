'use client';

import React, { useState } from 'react';
import { analytics } from '@/lib/analytics-stages';
import type { FAQ } from '@/data/stages/fevrier2026';

interface FAQAccordionProps {
  faq: FAQ[];
}

export function FAQAccordion({ faq }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleToggle = (index: number, question: string) => {
    const newIndex = openIndex === index ? null : index;
    setOpenIndex(newIndex);
    
    if (newIndex === index) {
      analytics.openFaq(question);
    }
  };

  const handleCTAClick = () => {
    analytics.ctaClick('faq', 'Réserver une consultation gratuite');
  };

  return (
    <section id="faq" className="py-20 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Titre */}
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 text-center mb-4">
            Questions fréquentes
          </h2>
          <p className="text-lg text-slate-600 text-center mb-12">
            Tout ce que vous devez savoir pour choisir en confiance.
          </p>

          {/* Accordion */}
          <div className="space-y-4 mb-12">
            {faq.map((item, index) => (
              <div
                key={index}
                className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => handleToggle(index, item.question)}
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-100 transition-colors"
                  aria-expanded={openIndex === index}
                  aria-controls={`faq-answer-${index}`}
                >
                  <span className="text-base font-bold text-slate-900 pr-4">{item.question}</span>
                  <span className="text-2xl text-blue-600 flex-shrink-0">
                    {openIndex === index ? '−' : '+'}
                  </span>
                </button>
                {openIndex === index && (
                  <div
                    id={`faq-answer-${index}`}
                    className="px-6 pb-6 text-sm text-slate-700 leading-relaxed"
                  >
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="text-center">
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
