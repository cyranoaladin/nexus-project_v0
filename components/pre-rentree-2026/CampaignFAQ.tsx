'use client';

import { useState } from 'react';

export function CampaignFAQ({ items }: { items: Array<{ question: string; answer: string }> }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-white py-14 md:py-20 px-4" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl">
        <h2 id="faq-heading" className="font-fraunces text-2xl md:text-3xl text-lux-ink mb-8">
          Questions fréquentes
        </h2>
        <div className="divide-y divide-lux-line">
          {items.map((item, idx) => {
            const isOpen = openIndex === idx;
            const panelId = `faq-panel-${idx}`;
            const buttonId = `faq-button-${idx}`;

            return (
              <div key={idx}>
                <button
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between py-4 text-left text-sm font-medium text-lux-ink hover:text-lux-gold-deep transition-colors min-h-[44px]"
                >
                  <span>{item.question}</span>
                  <span className="ml-4 shrink-0" aria-hidden="true">
                    {isOpen ? '−' : '+'}
                  </span>
                </button>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="pb-4 text-sm text-lux-slate"
                >
                  {item.answer}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
