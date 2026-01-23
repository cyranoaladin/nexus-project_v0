"use client";

import React from "react";
import { Star } from "lucide-react";

const testimonials = [
  {
    name: "M. Khaled A.",
    role: "Directeur de Lycée",
    quote:
      "Grâce à Korrigo, mes équipes ont gagné 30% de temps administratif.",
  },
  {
    name: "Mme Inès R.",
    role: "Parent d'élève",
    quote:
      "Ma fille a repris confiance en Maths grâce au tuteur ARIA. C'est bluffant.",
  },
  {
    name: "Yassine M.",
    role: "Développeur Web3",
    quote:
      "Le Bootcamp Solana m'a permis de décrocher un job en 2 mois.",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="bg-deep-midnight py-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
            Ils nous font confiance
          </h2>
          <p className="mt-3 text-slate-300">
            Des résultats concrets pour chaque profil.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((item) => (
            <div
              key={item.name}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
            >
              <div className="flex items-center gap-1 text-gold-400">
                {[...Array(5)].map((_, index) => (
                  <Star key={index} className="h-4 w-4 fill-gold-400" />
                ))}
              </div>
              <p className="mt-4 text-slate-200">{item.quote}</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-sm font-semibold text-gold-400">
                  {item.name
                    .split(" ")
                    .map((chunk) => chunk[0])
                    .join("")}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">
                    {item.name}
                  </div>
                  <div className="text-xs text-slate-400">{item.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
