'use client';

import { GraduationCap, Users, BookOpen, Shield } from 'lucide-react';
import { getRules } from '@/lib/pricing-client';

function getPillars(rules: { group_max: number; group_min_open: Record<string, number> }) {
  return [
  {
    icon: GraduationCap,
    accent: 'gold' as const,
    title: 'Enseignants expérimentés',
    description:
      'Enseignants expérimentés, en exercice dans le système français, affectés selon la discipline et le parcours.',
  },
  {
    icon: Users,
    accent: 'terracotta' as const,
    title: `Groupes de ${rules.group_max} maximum`,
    description:
      `Attention individualisée renforcée. Groupe ouvert dès ${rules.group_min_open.lycee} inscrits au lycée et ${rules.group_min_open.college} au Brevet.`,
  },
  {
    icon: BookOpen,
    accent: 'azure' as const,
    title: 'Plateforme ARIA',
    description:
      'Ressources, parcours de révision, fiches et exercices en accès continu — trois paliers adaptés.',
  },
  {
    icon: Shield,
    accent: 'evergreen' as const,
    title: 'Cadre structurant',
    description:
      'Carte d\'examen, bacs blancs sur grilles officielles, bulletins et suivi parents en temps réel.',
  },
  ];
}

const PILLAR_BADGE_CLASSES = {
  gold: { badge: 'bg-lux-gold/15 group-hover:bg-lux-gold/25', icon: 'text-lux-gold' },
  terracotta: { badge: 'bg-lux-terracotta/20 group-hover:bg-lux-terracotta/30', icon: 'text-lux-terracotta-bright' },
  azure: { badge: 'bg-lux-azure/20 group-hover:bg-lux-azure/30', icon: 'text-lux-azure-bright' },
  evergreen: { badge: 'bg-lux-evergreen/20 group-hover:bg-lux-evergreen/30', icon: 'text-lux-evergreen-bright' },
} as const;

export function MethodSection() {
  const pillars = getPillars(getRules());

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
            const badgeClasses = PILLAR_BADGE_CLASSES[pillar.accent];
            return (
              <div
                key={i}
                data-card="method-primary"
                className="group rounded-xl border border-lux-gold/20 bg-lux-ivory/[0.06] p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-lux-ivory/[0.09]"
              >
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg transition-colors ${badgeClasses.badge}`}>
                  <Icon className={`h-6 w-6 ${badgeClasses.icon}`} />
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
