export function CanonicalAssessmentWaiting() {
  return (
    <main className="min-h-[70vh] bg-[radial-gradient(circle_at_top,#eef6ff_0%,#fffaf0_48%,#f8fafc_100%)] px-4 py-16">
      <section className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white/95 p-8 text-center shadow-xl shadow-slate-900/5 sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">Bilan Nexus</p>
        <h1 className="mt-4 font-serif text-3xl font-semibold text-slate-950 sm:text-4xl">
          Votre questionnaire est en préparation
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-600">
          Le contenu pédagogique de ce bilan n’est pas encore ouvert. Aucune réponse ne vous est demandée pour le moment.
        </p>
      </section>
    </main>
  );
}
