"use client";

import { useState } from "react";
import { HelpCircle, Plus } from "lucide-react";

import { FAQS } from "../_data/packs";

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="bg-nexus-bg-alt px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/42">
            Questions fréquentes
          </p>
          <h2 className="mt-3 font-display text-h2 font-bold text-white">
            Les réponses qui débloquent la décision.
          </h2>
        </div>

        <div className="mt-10 space-y-4">
          {FAQS.map((item, index) => {
            const isOpen = index === openIndex;

            return (
              <article key={item.question} className="rounded-[22px] border border-white/8 bg-white/[0.03]">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
                >
                  <span className="flex items-center gap-3">
                    <HelpCircle className="h-4 w-4 shrink-0 text-nexus-green" aria-hidden="true" />
                    <span className="font-display text-lg font-bold text-white">{item.question}</span>
                  </span>
                  <Plus
                    className={`h-5 w-5 shrink-0 text-white/62 transition-transform duration-200 ${
                      isOpen ? "rotate-45" : ""
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen ? (
                  <div className="border-t border-white/8 px-5 py-5 text-sm leading-7 text-white/62">
                    {item.answer}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
