export default function Testimonials() {
  const quotes = [
    { q: 'Grâce au bilan et à ARIA, ma fille a gagné un point de moyenne en 6 semaines.', a: 'Parent de Terminale' },
    { q: 'Les stages Académies m’ont donné un déclic pour le Grand Oral.', a: 'Élève — Terminale' },
  ];
  return (
    <section className="py-10">
      <h2 className="text-xl font-semibold text-gray-900">Témoignages</h2>
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        {quotes.map((t, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-gray-800">“{t.q}”</p>
            <p className="text-xs text-gray-500 mt-2">{t.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

