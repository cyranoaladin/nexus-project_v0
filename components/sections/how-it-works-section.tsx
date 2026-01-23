"use client";

import React from "react";

const steps = [
  {
    title: "Diagnostic sur mesure",
    subtitle: "Audit gratuit - Identifions vos 3 leviers de croissance.",
  },
  {
    title: "Solutions adaptées",
    subtitle: "Korrigo, ARIA ou dév sur mesure - Nous choisissons ensemble.",
  },
  {
    title: "Formation & Adoption",
    subtitle: "Vos équipes maîtrisent les outils en 48h.",
  },
  {
    title: "Pilotage & ROI",
    subtitle: "Dashboard temps réel - Mesurez l'impact chaque trimestre.",
  },
];

export default function HowItWorksSection() {
  return (
    <section id="methodologie" className="bg-deep-midnight py-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
            Notre Approche Intégrée
          </h2>
          <p className="mt-3 text-slate-300">
            Un parcours clair, sans rupture, qui relie stratégie, outils et
            accompagnement.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-0 right-0 top-1/2 hidden h-px -translate-y-1/2 bg-gold-500/30 lg:block" />
          <div className="grid gap-6 lg:grid-cols-4">
            {steps.map((step, index) => (
              <div
                key={step.title}
                className="relative rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-md"
              >
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-gold-500/40 bg-black/30 text-lg font-semibold text-gold-400">
                  {index + 1}
                </div>
                <h3 className="text-lg font-semibold text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm text-slate-300">{step.subtitle}</p>
                {index < steps.length - 1 ? (
                  <div className="absolute right-[-12px] top-1/2 hidden h-6 w-6 -translate-y-1/2 rotate-45 border-t border-r border-gold-500/40 bg-deep-midnight lg:block" />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
