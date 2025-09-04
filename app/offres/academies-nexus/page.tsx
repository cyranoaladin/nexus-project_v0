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

export default async function AcademiesPage() {
  if (process.env.NEXT_PUBLIC_E2E === '1') {
    return (
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold">Académies Nexus (E2E)</h1>
        <p className="mt-2">Tarif indicatif en TND</p>
        <a href="/bilan-gratuit">S’inscrire à la prochaine académie</a>
      </main>
    );
  }
  const pricing = await getPricingMap();
  const stageG8 = pricing['prix_stage_groupe8'];

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-3">Académies Nexus (Stages vacances)</h1>
        <p className="text-slate-700 max-w-3xl mb-6">Des stages intensifs pendant les vacances scolaires (Toussaint, Noël, Février, Pâques). Groupes de 8 élèves, enseignement premium.</p>
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          <div className="rounded-xl border p-6">Semaine intensive NSI / Maths</div>
          <div className="rounded-xl border p-6">Focus Physique / Grand Oral</div>
        </div>
        <p className="text-slate-700 mb-6">{`Tarif : `}<b>{Number.isFinite(stageG8) ? `${stageG8} TND / heure` : '—'}</b></p>
        <Button asChild><a href="/bilan-gratuit" aria-label="S’inscrire à la prochaine académie" data-analytics="cta_offre_academies">S’inscrire à la prochaine académie</a></Button>
      </main>
      <Footer />
    </div>
  );
}
