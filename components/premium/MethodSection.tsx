'use client';

import { GraduationCap, Users, BookOpen, Shield } from 'lucide-react';
import { GROUP_RULES } from '@/lib/group-rules';

function getPillars(rules: typeof GROUP_RULES) {
  return [
  {
    icon: GraduationCap,
    title: 'Enseignants agrégés & certifiés',
    description:
      'Agrégés et certifiés de l\'enseignement français à l\'étranger, spécialistes de chaque épreuve.',
  },
  {
    icon: Users,
    title: `Groupes de ${rules.group_max} maximum`,
    description:
      `Attention individualisée renforcée. Groupe ouvert dès ${rules.group_min_open.lycee} inscrits au lycée et ${rules.group_min_open.college} au Brevet.`,
  },
  {
    icon: BookOpen,
    title: 'Plateforme ARIA',
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
}

export function MethodSection() {
  const pillars = getPillars(GROUP_RULES);

  return (
    <section className="py-20 px-4 md:px-6 bg-lux-ink">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <span className="lux-eyebrow text-lux-gold-wash">Notre méthode</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-fraunces text-balance text-lux-ivory">
            Quatre piliers pour accompagner la réussite
          </h2>
          <div className="lux-filet-gold mx-auto mt-4 w-16" />
          <p className="mx-auto mt-4 max-w-2xl text-base text-lux-on-dark-muted">
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
                data-card="method-primary"
                className="group rounded-xl border border-lux-gold/20 bg-lux-ivory/[0.06] p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-lux-ivory/[0.09]"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-lux-gold/15 transition-colors group-hover:bg-lux-gold/25">
                  <Icon className="h-6 w-6 text-lux-gold" />
                </div>
                <h3 className="mb-2 text-lg font-fraunces text-lux-ivory">{pillar.title}</h3>
                <p className="text-sm leading-relaxed text-lux-on-dark-muted">
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
