"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { FAQS } from "../_data/packs";

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-nexus-bg-alt px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">
            Questions fréquentes
          </p>
          <h2 className="mt-3 font-display text-h2 font-bold text-white">
            Les réponses qui débloquent la décision.
          </h2>
        </div>

        <div className="mt-12 space-y-3">
          {FAQS.map((item, index) => {
            const isOpen = index === openIndex;
            return (
              <article
                key={item.question}
                className="overflow-hidden rounded-[20px] border border-white/10 bg-[#111826]"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-base font-semibold text-white">
                    {item.question}
                  </span>
                  <span
                    className={`shrink-0 rounded-full border p-1.5 transition-colors duration-150 ${
                      isOpen
                        ? "border-nexus-green/35 bg-nexus-green/10"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    {isOpen ? (
                      <Minus className="h-3.5 w-3.5 text-nexus-green" aria-hidden="true" />
                    ) : (
                      <Plus className="h-3.5 w-3.5 text-white/45" aria-hidden="true" />
                    )}
                  </span>
                </button>

                {isOpen ? (
                  <div className="border-t border-white/10 px-6 py-5 text-sm leading-7 text-slate-300">
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
