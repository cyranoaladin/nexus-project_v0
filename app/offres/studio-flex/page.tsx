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
  } catch { return {}; }
}

export default async function StudioFlexPage() {
  if (process.env.NEXT_PUBLIC_E2E === '1') {
    return (
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold">Studio Flex (E2E)</h1>
        <p className="mt-2">1 crédit = 10 TND</p>
        <a href="/bilan-gratuit">Réserver une séance</a>
      </main>
    );
  }
  const pricing = await getPricingMap();
  const indiv = pricing['prix_individuel'];
  const g4 = pricing['prix_groupe4'];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Studio Flex (Cours à la carte)</h1>
        <p className="text-slate-700 max-w-3xl mb-6">Cours personnalisés, en ligne ou présentiel, quand vous voulez. Payez avec vos crédits Nexus pour une flexibilité totale.</p>
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="rounded-xl border p-6">
            <h2 className="font-semibold mb-1">Cours individuel</h2>
            <p className="text-sm text-slate-700">{Number.isFinite(indiv) ? `${indiv} TND / heure` : '—'}</p>
          </div>
          <div className="rounded-xl border p-6">
            <h2 className="font-semibold mb-1">Cours groupe (4 élèves)</h2>
            <p className="text-sm text-slate-700">{Number.isFinite(g4) ? `${g4} TND / heure` : '—'}</p>
          </div>
          <div className="rounded-xl border p-6">
            <h2 className="font-semibold mb-1">Packs de crédits</h2>
            <p className="text-sm text-slate-700">1 crédit = 10 TND</p>
          </div>
        </div>
        <Button asChild><a href="/bilan-gratuit" aria-label="Réserver une séance" data-analytics="cta_offre_studio">Réserver une séance</a></Button>
      </main>
      <Footer />
    </div>
  );
}
