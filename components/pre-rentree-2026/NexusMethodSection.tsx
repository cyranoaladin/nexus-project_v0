export function NexusMethodSection() {
  const steps = [
    {
      number: 1,
      title: 'Positionnement',
      description: 'Évaluation des acquis et identification des besoins prioritaires pour cibler le travail des deux semaines.',
    },
    {
      number: 2,
      title: 'Travail guidé en groupe réduit',
      description: 'Cours structuré et exercices encadrés en groupes de 3 à 5, avec attention individuelle.',
    },
    {
      number: 3,
      title: 'Entraînement et correction',
      description: 'Pratique intensive sur des exercices progressifs avec correction détaillée et méthode de rédaction.',
    },
    {
      number: 4,
      title: 'Bilan et recommandations',
      description: 'Synthèse des progrès et recommandations personnalisées pour aborder la rentrée avec confiance.',
    },
  ];

  return (
    <section className="bg-lux-ink py-14 md:py-20 px-4" aria-labelledby="method-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="method-heading" className="font-fraunces text-2xl md:text-3xl text-lux-on-dark mb-10">
          La méthode Nexus
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.number} className="relative">
              <span className="block text-4xl font-fraunces text-lux-gold/30 mb-2">
                {step.number}
              </span>
              <h3 className="text-lg font-semibold text-lux-on-dark mb-2">{step.title}</h3>
              <p className="text-sm text-lux-on-dark-muted">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
