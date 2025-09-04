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

export default async function SOSDevoirsPage() {
  if (process.env.NEXT_PUBLIC_E2E === '1') {
    return (
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold">SOS Devoirs (E2E)</h1>
        <p className="mt-2">Prix en TND</p>
        <a href="/bilan-gratuit">Demander un SOS maintenant</a>
      </main>
    );
  }
  const pricing = await getPricingMap();
  const p15 = pricing['prix_sos_15'];
  const p30 = pricing['prix_sos_30'];
  const p60 = pricing['prix_sos_60'];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">SOS Devoirs (Visio rapide)</h1>
        <p className="text-slate-700 max-w-3xl mb-6">Une difficulté ? ARIA + un prof en visio pour vous aider immédiatement. Payez à la minute grâce à vos crédits Nexus.</p>
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          <div className="rounded-xl border p-6 text-center">
            <div className="font-semibold mb-2">15 min</div>
            <div className="text-slate-800">{Number.isFinite(p15) ? `${p15} TND` : '—'}</div>
          </div>
          <div className="rounded-xl border p-6 text-center">
            <div className="font-semibold mb-2">30 min</div>
            <div className="text-slate-800">{Number.isFinite(p30) ? `${p30} TND` : '—'}</div>
          </div>
          <div className="rounded-xl border p-6 text-center">
            <div className="font-semibold mb-2">1 heure</div>
            <div className="text-slate-800">{Number.isFinite(p60) ? `${p60} TND` : '—'}</div>
          </div>
        </div>
        <Button asChild><a href="/bilan-gratuit" aria-label="Demander un SOS maintenant" data-analytics="cta_offre_sos">Demander un SOS maintenant</a></Button>
      </main>
      <Footer />
    </div>
  );
}
