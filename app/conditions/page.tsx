export const metadata = {
  title: 'Conditions Générales | Nexus Réussite',
};

export default function ConditionsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-heading text-3xl font-bold text-slate-900 mb-4">Conditions Générales d’Utilisation</h1>
        <p className="text-slate-700 mb-6">
          Bienvenue sur Nexus Réussite. Cette page présente un aperçu des conditions générales d’utilisation (CGU) de la plateforme.
          Une version complète et juridiquement contraignante sera fournie et peut être mise à jour ultérieurement.
        </p>
        <section className="space-y-4 text-slate-700">
          <h2 className="text-xl font-semibold">1. Objet</h2>
          <p>La plateforme propose un accompagnement pédagogique et des services numériques associés.</p>

          <h2 className="text-xl font-semibold">2. Comptes et Sécurité</h2>
          <p>Vous êtes responsable de la confidentialité de vos identifiants et de toute activité réalisée via votre compte.</p>

          <h2 className="text-xl font-semibold">3. Données et Confidentialité</h2>
          <p>Les données sont traitées conformément aux réglementations applicables et à notre politique de confidentialité.</p>

          <h2 className="text-xl font-semibold">4. Propriété Intellectuelle</h2>
          <p>Les contenus et marques demeurent la propriété de leurs titulaires respectifs. Toute reproduction non autorisée est interdite.</p>

          <h2 className="text-xl font-semibold">5. Contact</h2>
          <p>Pour toute question relative aux présentes CGU, veuillez nous contacter via la page Contact.</p>
        </section>
      </div>
    </main>
  );
}

