export function NexusMethodSection({ steps }: { steps: Array<{ title: string; description: string }> }) {

  return (
    <section className="bg-lux-ink py-14 md:py-20 px-4" aria-labelledby="method-heading">
      <div className="mx-auto max-w-6xl">
        <h2 id="method-heading" className="font-fraunces text-2xl md:text-3xl text-lux-on-dark mb-10">
          La méthode Nexus
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.title} className="relative">
              <span className="block text-4xl font-fraunces text-lux-gold/30 mb-2">
                {index + 1}
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
