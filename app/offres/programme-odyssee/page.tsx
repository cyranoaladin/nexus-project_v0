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

export default async function OdysseyPage() {
  if (process.env.NEXT_PUBLIC_E2E === '1') {
    return (
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold">Programme Odyssée (E2E)</h1>
        <p className="mt-2">Affichage prix en TND</p>
        <a href="/bilan-gratuit">Rejoindre le Programme Odyssée</a>
      </main>
    );
  }
  const pricing = await getPricingMap();
  const pPremiere = pricing['Odysee_Premiere'];
  const pTerminale = pricing['Odysee_Terminale'];
  const pLibres = pricing['Odysee_Libres'] ?? pricing['prix_pack_libres'];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Programme Odyssée (Accompagnement annuel)</h1>
        <p className="text-slate-700 max-w-3xl mb-6">Un programme structuré pour viser la mention et réussir Parcoursup. Inclut ARIA, cours réguliers, stages vacances, suivi personnalisé. Garantie Bac obtenu ou remboursé.</p>
        <ul className="list-disc pl-6 text-slate-700 mb-6">
          <li>ARIA Premium illimité</li>
          <li>Coaching hebdomadaire et bilans mensuels</li>
          <li>Rédaction Parcoursup et oraux blancs</li>
          <li>Garantie résultats (conditions)</li>
        </ul>
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="rounded-xl border p-6"><b>Première</b><div className="text-slate-700 mt-2">{Number.isFinite(pPremiere) ? `${pPremiere} TND / an` : '—'}</div></div>
          <div className="rounded-xl border p-6"><b>Terminale</b><div className="text-slate-700 mt-2">{Number.isFinite(pTerminale) ? `${pTerminale} TND / an` : '—'}</div></div>
          <div className="rounded-xl border p-6"><b>Candidats libres</b><div className="text-slate-700 mt-2">{Number.isFinite(pLibres) ? `${pLibres} TND / an` : '—'}</div></div>
        </div>
        <Button asChild><a href="/bilan-gratuit" aria-label="Rejoindre le Programme Odyssée" data-analytics="cta_offre_odyssee">Rejoindre le Programme Odyssée</a></Button>
      </main>
      <Footer />
    </div>
  );
}
