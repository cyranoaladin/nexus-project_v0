'use client';

import { GraduationCap, Users, BookOpen, Shield } from 'lucide-react';

const pillars = [
  {
    icon: GraduationCap,
    title: 'Enseignants certifiés',
    description:
      'Agrégés et certifiés de l\'enseignement français à l\'étranger, spécialistes de chaque épreuve.',
  },
  {
    icon: Users,
    title: 'Groupes de 5 maximum',
    description:
      'Attention individualisée garantie. Groupe ouvert dès 3 inscrits (dès 4 pour le Brevet).',
  },
  {
    icon: BookOpen,
    title: 'Plateforme Masterium',
    description:
      'Ressources, parcours de révision, fiches et exercices en accès continu — trois paliers adaptés.',
  },
  {
    icon: Shield,
    title: 'Cadre structurant',
    description:
      'Carte d\'examen, bacs blancs sur grilles officielles, bulletins et suivi parents en temps réel.',
  },
];

export function MethodSection() {
  return (
    <section className="py-20 px-4 md:px-6 bg-lux-paper">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <span className="lux-eyebrow">Notre méthode</span>
          <h2 className="mt-3 text-3xl md:text-4xl text-balance">
            Quatre piliers pour accompagner la réussite
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-lux-slate">
            Un cadre exigeant qui combine expertise humaine, petit effectif,
            outils numériques et suivi structuré.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {pillars.map((pillar, i) => {
            const Icon = pillar.icon;
            return (
              <div
                key={i}
                className="group rounded-xl border border-lux-line bg-lux-white p-6 lux-shadow transition-all duration-300 hover:-translate-y-1 hover:lux-shadow-hover"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-lux-gold/10 transition-colors group-hover:bg-lux-gold/20">
                  <Icon className="h-6 w-6 text-lux-gold" />
                </div>
                <h3 className="mb-2 text-lg">{pillar.title}</h3>
                <p className="text-sm leading-relaxed text-lux-slate">
                  {pillar.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
