'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  items: FAQItem[];
  title?: string;
  className?: string;
}

export function FAQAccordion({ items, title = 'Questions fréquentes', className }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className={`py-20 px-4 md:px-6 ${className ?? ''}`}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 text-center">
          <span className="lux-eyebrow">FAQ</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-fraunces">{title}</h2>
          <div className="lux-filet-gold mx-auto mt-3 w-16" />
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-lux-line bg-lux-white lux-shadow"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-lux-paper/60 lux-focus"
                aria-expanded={openIndex === i}
              >
                <span className="pr-4 text-sm font-semibold text-lux-ink text-balance">
                  {item.question}
                </span>
                <ChevronDown
                  className={`h-5 w-5 flex-shrink-0 text-lux-gold transition-transform duration-200 ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <div
                className={`grid transition-all duration-200 ${
                  openIndex === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-lux-line/50 px-6 py-4">
                    <p className="text-sm leading-relaxed text-lux-slate">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
