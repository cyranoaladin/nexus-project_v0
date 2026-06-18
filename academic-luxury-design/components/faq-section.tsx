'use client';

import { useState } from 'react';
import { FAQItem } from '@/lib/types';
import { ChevronDown } from 'lucide-react';

interface FAQSectionProps {
  items: FAQItem[];
}

export function FAQSection({ items }: FAQSectionProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggleItem = (question: string) => {
    setExpanded(expanded === question ? null : question);
  };

  return (
    <section className="py-20 px-4 md:px-6 bg-background">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <span className="eyebrow">Questions Fréquentes</span>
          <h2 className="text-h2 mt-4">Tout ce que tu dois savoir</h2>
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="border border-border rounded-lg overflow-hidden bg-card shadow-card transition-smooth hover:shadow-card-hover"
            >
              <button
                onClick={() => toggleItem(item.question)}
                className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-muted/20 transition-smooth"
              >
                <h3 className="font-bold text-primary pr-4 text-balance">
                  {item.question}
                </h3>
                <ChevronDown
                  className={`w-5 h-5 text-accent flex-shrink-0 transition-transform ${
                    expanded === item.question ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expanded === item.question && (
                <div className="px-6 py-4 border-t border-border/50 bg-background/50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <p className="text-body-md text-muted-foreground">
                    {item.answer}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
