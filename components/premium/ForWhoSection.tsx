'use client';

import { CheckCircle2 } from 'lucide-react';

const profiles = [
  {
    title: 'Élève scolarisé',
    description:
      'Accompagnement structuré en parallèle du lycée, avec un cadre qui prolonge et renforce le travail scolaire.',
    features: [
      'Parcours annuels ou stages intensifs',
      'Bacs blancs sur grilles officielles',
      'Suivi parents en temps réel',
    ],
  },
  {
    title: 'Candidat libre',
    description:
      'Un vrai cadre pour préparer le bac en autonomie, avec cellule Cyclades et accompagnement administratif.',
    features: [
      'Parcours dédiés (Essentiel, Mixte, Premium)',
      'Cellule Cyclades intégrée',
      'Coaching individuel possible',
    ],
  },
  {
    title: 'Élève exigeant',
    description:
      `Pour ceux qui visent l\u2019excellence\u00A0: optimiser chaque épreuve, maîtriser la méthode, affiner la stratégie.`,
    features: [
      'Studio Grand Oral & simulations filmées',
      'Épreuves blanches selon formule',
      'Boussole Orientation & Parcoursup',
    ],
  },
];

export function ForWhoSection() {
  return (
    <section className="py-20 px-4 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <span className="lux-eyebrow">Pour qui</span>
          <h2 className="mt-3 text-3xl md:text-4xl text-balance">
            Un accompagnement adapté à chaque profil
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-lux-slate">
            Scolarisé, candidat libre ou en quête d&apos;excellence —
            nous avons une formule conçue pour votre situation.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {profiles.map((profile, i) => (
            <div
              key={i}
              className="group rounded-xl border border-lux-line bg-lux-white p-6 lux-shadow transition-all duration-300 hover:lux-shadow-hover"
            >
              <h3 className="mb-2 text-xl group-hover:text-lux-gold transition-colors">
                {profile.title}
              </h3>
              <p className="mb-4 text-sm leading-relaxed text-lux-slate">
                {profile.description}
              </p>
              <ul className="space-y-2.5">
                {profile.features.map((feature, fi) => (
                  <li key={fi} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-lux-evergreen" />
                    <span className="text-sm text-lux-slate">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
