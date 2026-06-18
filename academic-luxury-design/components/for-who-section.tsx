'use client';

import { CheckCircle2 } from 'lucide-react';

export function ForWhoSection() {
  const profiles = [
    {
      title: 'Élève Scolarisé',
      description:
        'Accompagnement tout au long de l\'année pour progresser régulièrement.',
      features: [
        'Renforcement des points faibles',
        'Préparation progressive à l\'examen',
        'Suivi mensuel personnalisé',
      ],
    },
    {
      title: 'Candidat Libre',
      description:
        'Préparation autonome avec structure et suivi régulier.',
      features: [
        'Flexibilité d\'organisation',
        'Packs de sessions à la carte',
        'Accès plateforme complète',
      ],
    },
    {
      title: 'Redoublant',
      description:
        'Analyse des erreurs passées et stratégie de progression.',
      features: [
        'Diagnostic détaillé des lacunes',
        'Programme de remédiation ciblé',
        'Suivi intensif',
      ],
    },
    {
      title: 'Perfectionniste',
      description:
        'Optimisation pour viser les meilleures notes aux examens.',
      features: [
        'Techniques avancées d\'examen',
        'Entraînement intensif',
        'Mentorat d\'excellence',
      ],
    },
  ];

  return (
    <section className="py-20 px-4 md:px-6 bg-card">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="eyebrow">Qui Sommes-nous?</span>
          <h2 className="text-h1 mt-4 mb-6 text-balance">
            Un accompagnement pour chacun
          </h2>
          <p className="text-body-lg text-muted-foreground max-w-2xl mx-auto">
            Que tu sois scolarisé, candidat libre ou en redoublement,
            nous avons une solution adaptée à ton profil.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {profiles.map((profile, idx) => (
            <div
              key={idx}
              className="p-6 border border-border rounded-xl bg-background shadow-card hover:shadow-card-hover transition-smooth group"
            >
              <h3 className="text-h3 mb-2 group-hover:text-accent transition-smooth">
                {profile.title}
              </h3>
              <p className="text-body-md text-muted-foreground mb-4">
                {profile.description}
              </p>
              <ul className="space-y-3">
                {profile.features.map((feature, fidx) => (
                  <li key={fidx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                    <span className="text-body-sm">{feature}</span>
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
