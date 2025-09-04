export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";

async function getPricingMap(): Promise<Record<string, number>> {
  try {
    const res = await fetch('/api/pricing', { next: { tags: ['pricing'] } });
    if (!res.ok) return {};
    const items: Array<{ variable: string; valeur: number; }> = await res.json();
    return Object.fromEntries(items.map(i => [i.variable, i.valeur]));
  } catch {
    return {};
  }
}

export default async function NexusCortexPage() {
  if (process.env.NEXT_PUBLIC_E2E === '1') {
    return (
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold">Nexus Cortex (ARIA) — E2E</h1>
        <p className="mt-2">Tarifs affichés en TND</p>
        <a href="/bilan-gratuit">Activer ARIA</a>
      </main>
    );
  }
  const pricing = await getPricingMap();
  const prixMatiere = pricing['ARIA_tarif_matiere'];
  const prixPack = pricing['ARIA_pack_complet'];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <section className="max-w-3xl mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Nexus Cortex (ARIA)</h1>
          <p className="text-slate-700">ARIA, votre tuteur IA intelligent, disponible 24/7, pour toutes vos matières.</p>
          <p className="text-slate-700 mt-3">
            ARIA par matière : <b>{Number.isFinite(prixMatiere) ? `${prixMatiere} TND / mois` : '—'}</b>{' '}
            {Number.isFinite(prixPack) && (
              <span className="ml-3">Pack complet : <b>{prixPack} TND / mois</b></span>
            )}
          </p>
          <div className="mt-4">
            <Button asChild><a href="/bilan-gratuit" aria-label="Activer ARIA" data-analytics="cta_offre_aria">Activer ARIA</a></Button>
          </div>
        </section>

        <section className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="rounded-xl border p-6"><h3 className="font-semibold mb-2">Pourquoi ARIA est différente</h3><p className="text-slate-700 text-sm">Spécifique Bac FR, supervision enseignants, suivi analytique.</p></div>
          <div className="rounded-xl border p-6"><h3 className="font-semibold mb-2">Fonctionnalités</h3><p className="text-slate-700 text-sm">QCM adaptatifs, fiches ciblées, explications pas à pas, récap hebdo.</p></div>
          <div className="rounded-xl border p-6"><h3 className="font-semibold mb-2">Exemples concrets</h3><p className="text-slate-700 text-sm">Génération de fiches NSI/Maths/Physique, oraux blancs guidés, corrections commentées.</p></div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-3">Formules</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl border p-6">
              <h3 className="font-semibold">Standard</h3>
              <p className="text-slate-700 text-sm mb-3">Fonctionnalités essentielles, support par e-mail.</p>
              <Button asChild><a href="/bilan-gratuit">Activer ARIA</a></Button>
            </div>
            <div className="rounded-xl border p-6">
              <h3 className="font-semibold">Premium</h3>
              <p className="text-slate-700 text-sm mb-3">Accès prioritaire, sessions de coaching incluses.</p>
              <Button asChild><a href="/bilan-gratuit">Activer ARIA</a></Button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-3">FAQ</h2>
          <ul className="space-y-2 text-slate-700 text-sm">
            <li>ARIA est-elle un simple chatbot ? — Non, elle est spécifique Bac FR et supervisée pédagogiquement.</li>
            <li>Peut-on commencer en cours d’année ? — Oui, un diagnostic aligne le plan et le calendrier.</li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  );
}
