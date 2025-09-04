export const dynamic = 'force-static';

export default function ConstructeurParcoursPage() {
  return (
    <main className="container mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-4">Constructeur de Parcours (MVP)</h1>
      <p className="text-slate-700 mb-6">Répondez à quelques questions pour recevoir une recommandation de parcours. (Prototype en cours)</p>
      <ol className="list-decimal ml-6 space-y-2 text-slate-700">
        <li>Profil (classe, spécialités, objectifs)</li>
        <li>Contraintes (temps/semaine, budget, préférences)</li>
        <li>Diagnostic express (5 questions)</li>
        <li>Recommandation (combinaison d’univers + calendrier + coût)</li>
      </ol>
    </main>
  );
}
