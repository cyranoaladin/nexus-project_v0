import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';

export const metadata: Metadata = {
  title: 'Ressources bac français | Nexus Réussite',
  description: 'Méthode, coefficients, EAF, Grand Oral et organisation pour les familles du système français.',
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
    title: 'Ressources bac français | Nexus Réussite',
    description: 'Un hub de ressources pédagogiques Nexus Réussite, publié progressivement.',
    type: 'website',
  },
};

export default function RessourcesPage() {
  return (
    <main className="luxury min-h-screen bg-lux-paper" id="main-content">
      <CorporateNavbar />
      <section className="px-4 pb-16 pt-32 md:px-6">
        <div className="mx-auto max-w-4xl rounded-2xl border border-lux-line bg-lux-white p-6 text-center lux-shadow md:p-10">
          <p className="lux-eyebrow">Ressources</p>
          <h1 className="mt-3 text-3xl font-fraunces text-lux-ink md:text-5xl">
            Ressources pour réussir le bac français
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-lux-slate">
            Nos ressources arrivent. Elles seront publiées uniquement quand elles seront prêtes, relues et utiles aux familles.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/bilan-gratuit" className="lux-cta-reserve rounded-lg px-6 py-3.5 text-sm font-semibold">
              Demander un bilan gratuit
            </Link>
            <Link href="/offres" className="inline-flex min-h-[44px] items-center rounded-lg border border-lux-line px-6 py-3 text-sm font-semibold text-lux-ink">
              Voir les offres
            </Link>
          </div>
        </div>
      </section>
      <CorporateFooter />
    </main>
  );
}
