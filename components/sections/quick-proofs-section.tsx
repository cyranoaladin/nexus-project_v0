export function QuickProofsSection() {
  return (
    <section className="py-8 md:py-10 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 text-center">
          <div className="rounded-xl border p-6">
            <p className="text-3xl font-bold text-slate-900">96%</p>
            <p className="text-slate-700">d’objectifs atteints*</p>
          </div>
          <div className="rounded-xl border p-6">
            <p className="text-3xl font-bold text-slate-900">1 200+</p>
            <p className="text-slate-700">heures d’accompagnement (12 mois)</p>
          </div>
          <div className="rounded-xl border p-6">
            <p className="text-3xl font-bold text-slate-900">4</p>
            <p className="text-slate-700">univers 100% modulables</p>
          </div>
        </div>
        <p className="text-xs text-slate-500 text-center mt-3">* Méthodologie interne, détails sur demande.</p>
      </div>
    </section>
  );
}
