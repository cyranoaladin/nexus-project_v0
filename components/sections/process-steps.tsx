export default function ProcessSteps() {
  const steps = [
    { t: 'Bilan stratégique gratuit', d: 'Diagnostic initial & objectifs' },
    { t: 'Parcours sur-mesure', d: 'Plan d’action, calendrier, accès ARIA' },
    { t: 'Mesure & itération', d: 'Dashboard, retours enseignants, ajustements' },
  ];
  return (
    <section className="py-10">
      <h2 className="text-xl font-semibold text-gray-900 text-center mb-8">Comment ça marche</h2>
      <div className="grid md:grid-cols-3 gap-4">
        {steps.map((s) => (
          <div key={s.t} className="rounded-xl border p-6 bg-white">
            <h3 className="font-semibold mb-2">{s.t}</h3>
            <p className="text-slate-700 text-sm">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

