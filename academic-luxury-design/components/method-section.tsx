'use client';

import { GraduationCap, Users, BookOpen, TrendingUp } from 'lucide-react';

export function MethodSection() {
  const pillars = [
    {
      icon: GraduationCap,
      title: 'Expertise Certifiée',
      description: 'Professeurs agrégés et examinateurs au bac avec 12+ ans d\'expérience.',
    },
    {
      icon: Users,
      title: 'Groupes Réduits',
      description: 'Maximum 6-12 élèves pour un suivi personnalisé et une attention maximale.',
    },
    {
      icon: BookOpen,
      title: 'Plateforme Premium',
      description: 'Accès 24/7 aux ressources, archives d\'examens et forums de discussion.',
    },
    {
      icon: TrendingUp,
      title: 'Résultats Mesurés',
      description: 'Progression moyenne de 2 à 4 points avec tableau de bord individuel.',
    },
  ];

  return (
    <section className="py-20 px-4 md:px-6 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="eyebrow">Notre Méthode</span>
          <h2 className="text-h1 mt-4 mb-6 text-balance">
            Quatre piliers pour réussir
          </h2>
          <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
            Une approche holistique combinant expertise pédagogique,
            petits groupes, technologie et mentorat personnel.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                className="group p-6 border border-border rounded-xl bg-card shadow-card hover:shadow-card-hover transition-smooth hover:-translate-y-1"
              >
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-smooth">
                  <Icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-h3 mb-3">{pillar.title}</h3>
                <p className="text-body-sm text-muted-foreground">
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
