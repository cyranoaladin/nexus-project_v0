export function FAQShortSection() {
  const faqs = [
    {
      q: "ARIA est-elle un simple chatbot ?",
      a: "Non. ARIA est entraînée sur des contenus Bac FR, connectée à vos progrès et supervisée par nos professeurs.",
    },
    {
      q: "Peut-on commencer en cours d’année ?",
      a: "Oui. Un diagnostic initial permet d’adapter le plan et le calendrier.",
    },
    {
      q: "Quels moyens de paiement ?",
      a: "Paiement sécurisé, mensualisation possible. Aide aux familles sur dossier.",
    },
  ];

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Questions fréquentes</h2>
        <div className="max-w-3xl mx-auto space-y-4">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-xl border p-4">
              <p className="font-semibold mb-1">{f.q}</p>
              <p className="text-slate-700 text-sm">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
