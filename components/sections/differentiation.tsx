export default function Differentiation() {
  return (
    <section className="py-10">
      <h2 className="text-xl font-semibold text-gray-900">Pourquoi nous ?</h2>
      <p className="text-gray-600 mt-1">Pas des « cours bis » du lycée : une stratégie éducative premium.</p>
      <div className="mt-6 grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-300 bg-white p-4">
          <div className="font-medium text-gray-900">Cours particuliers classiques</div>
          <ul className="text-sm text-gray-600 mt-2 list-disc ml-4 space-y-1">
            <li>Pas de stratégie globale</li>
            <li>Peu d’expertise certifiée</li>
            <li>Bachotage court terme</li>
          </ul>
        </div>
        <div className="rounded-xl border border-gray-900 bg-white p-4">
          <div className="font-medium text-gray-900">Nexus Réussite</div>
          <ul className="text-sm text-gray-700 mt-2 list-disc ml-4 space-y-1">
            <li>Objectifs & suivi mesurables</li>
            <li>Profs agrégés + IA ARIA</li>
            <li>Hybride + Garantie Bac</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

