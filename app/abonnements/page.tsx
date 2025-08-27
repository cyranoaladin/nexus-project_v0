export const dynamic = 'force-dynamic';

import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toLocaleString('fr-FR')} ${currency}`;
  }
}

export default async function SubscriptionsPage({ searchParams }: { searchParams?: { currency?: string } }) {
  // Lire la tarification dynamique (toutes devises actives)
  const all = await prisma.productPricing.findMany({ where: { active: true }, orderBy: [{ itemType: 'asc' }, { amount: 'asc' }] });

  const currencies = Array.from(new Set((all as any[]).map(p => p.currency).filter(Boolean))) as string[];
  const selectedCurrency = (searchParams?.currency && currencies.includes(searchParams.currency))
    ? searchParams.currency!
    : (currencies[0] || 'TND');

  // Filtrer par devise sélectionnée
  const pricings = (all as any[]).filter(p => p.currency === selectedCurrency);
  const subs = pricings.filter(p => String(p.itemType).toUpperCase() === 'SUBSCRIPTION');
  const addons = pricings.filter(p => String(p.itemType).toUpperCase() === 'ADDON');
  const packs = pricings.filter(p => String(p.itemType).toUpperCase() === 'PACK');

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12 space-y-12">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Nos Formules d'Abonnement
          </h1>
          <p className="text-lg text-gray-600">
            Des offres claires et adaptées à chaque profil d'élève.
          </p>
        </div>

        {currencies.length > 1 && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-gray-600">Devise:</span>
            <div className="flex gap-2">
              {currencies.map((c) => (
                <Link
                  key={c}
                  href={`/abonnements?currency=${encodeURIComponent(c)}`}
                  className={`px-3 py-1 rounded-full border text-sm ${c === selectedCurrency ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  {c}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Abonnements */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Abonnements</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {subs.map((p) => (
              <div key={`${p.itemType}-${p.itemKey}-${p.currency}`} className="border rounded-xl p-6 shadow-sm hover:shadow-md transition">
                <div className="text-sm uppercase text-gray-500 tracking-wide mb-2">{String(p.itemKey).replace('_', ' ')}</div>
                <div className="text-3xl font-bold text-blue-700 mb-1">{formatAmount(p.amount, selectedCurrency)}</div>
                <div className="text-gray-600 mb-4">{p.description}</div>
                <Link href="/dashboard/parent/abonnements" className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
                  Choisir cette formule
                </Link>
              </div>
            ))}
            {subs.length === 0 && (
              <div className="text-gray-600">Aucune formule disponible pour cette devise pour le moment.</div>
            )}
          </div>
        </section>

        {/* Add-ons ARIA */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Add-ons ARIA+</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {addons.map((p) => (
              <div key={`${p.itemType}-${p.itemKey}-${p.currency}`} className="border rounded-xl p-6 shadow-sm hover:shadow-md transition">
                <div className="text-sm uppercase text-gray-500 tracking-wide mb-2">{String(p.itemKey).replace('_', ' ')}</div>
                <div className="text-3xl font-bold text-indigo-700 mb-1">{formatAmount(p.amount, selectedCurrency)}</div>
                <div className="text-gray-600 mb-4">{p.description}</div>
                <Link href="/dashboard/parent/abonnements" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md">
                  Activer ARIA+
                </Link>
              </div>
            ))}
            {addons.length === 0 && (
              <div className="text-gray-600">Aucun add-on disponible pour cette devise pour le moment.</div>
            )}
          </div>
        </section>

        {/* Packs de Crédits */}
        <section>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Packs de Crédits</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {packs.map((p) => (
              <div key={`${p.itemType}-${p.itemKey}-${p.currency}`} className="border rounded-xl p-6 shadow-sm hover:shadow-md transition">
                <div className="text-sm uppercase text-gray-500 tracking-wide mb-2">{String(p.itemKey).replace('_', ' ')}</div>
                <div className="text-3xl font-bold text-emerald-700 mb-1">{formatAmount(p.amount, selectedCurrency)}</div>
                <div className="text-gray-600 mb-4">{p.description}</div>
                <Link href="/dashboard/parent/paiement" className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md">
                  Acheter un pack
                </Link>
              </div>
            ))}
            {packs.length === 0 && (
              <div className="text-gray-600">Aucun pack disponible pour cette devise pour le moment.</div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
