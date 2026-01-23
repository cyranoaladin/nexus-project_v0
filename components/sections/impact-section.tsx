"use client";

import React from "react";

const impactGroups = [
  {
    title: "Établissements",
    stats: ["-30% temps administratif", "+15% réussite examens"],
  },
  {
    title: "Élèves",
    stats: ["+2.3 pts de moyenne", "+87% confiance en soi"],
  },
  {
    title: "Professionnels",
    stats: ["+42% salaire post-formation", "3x plus d'opportunités"],
  },
];

const choices = [
  {
    title: "Écoles",
    description: "Se différencier & Gagner du temps.",
    cta: "Auditer mon potentiel",
    href: "/contact",
  },
  {
    title: "Élèves",
    description: "Viser l'excellence & Reprendre confiance.",
    cta: "Découvrir l'accompagnement",
    href: "/famille",
  },
  {
    title: "Pros",
    description: "Maîtriser les technos de demain.",
    cta: "Explorer les formations",
    href: "/academy",
  },
];

export default function ImpactSection() {
  return (
    <section className="bg-deep-midnight py-20">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white font-serif">
            Impact mesurable, confiance durable
          </h2>
          <p className="mt-3 text-slate-300">
            Des résultats concrets, par profil, dès les premiers mois.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {impactGroups.map((group) => (
            <div
              key={group.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-md"
            >
              <h3 className="text-lg font-semibold text-white">
                {group.title}
              </h3>
              <div className="mt-4 space-y-2">
                {group.stats.map((stat) => (
                  <div key={stat} className="text-gold-400 text-xl font-bold">
                    {stat}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <h3 className="text-2xl font-bold text-white font-serif text-center">
            Quel impact recherchez-vous ?
          </h3>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {choices.map((choice) => (
              <div
                key={choice.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-md"
              >
                <h4 className="text-lg font-semibold text-white">
                  {choice.title}
                </h4>
                <p className="mt-3 text-slate-300">{choice.description}</p>
                <a
                  href={choice.href}
                  className="mt-6 inline-flex items-center justify-center rounded-full border border-gold-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-gold-500/10"
                >
                  {choice.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
