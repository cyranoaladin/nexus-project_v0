import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { BilanStrategiqueClient } from './BilanStrategiqueClient';

export const metadata: Metadata = {
  title: 'Bilan stratégique gratuit | Nexus Réussite',
  description:
    'Identifiez les priorités de votre enfant avant de choisir une formule. Bilan gratuit, réponse personnalisée et orientation vers la bonne solution.',
  openGraph: {
    title: 'Bilan stratégique gratuit | Nexus Réussite',
    description:
      'Un échange simple pour comprendre le niveau, les besoins et les matières prioritaires de votre enfant.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function BilanGratuitPage() {
  return (
    <main className="luxury min-h-screen" id="main-content">
      <CorporateNavbar />
      <Suspense
        fallback={
          <section className="bg-lux-ink px-4 py-16 pt-28 md:px-6 min-h-[60vh]">
            <div className="mx-auto max-w-5xl text-center">
              <h1 className="font-fraunces text-4xl font-light tracking-tight text-lux-ivory md:text-5xl">
                Bilan stratégique gratuit
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-lux-on-dark-muted">
                Chargement du formulaire…
              </p>
            </div>
          </section>
        }
      >
        <BilanStrategiqueClient />
      </Suspense>
    </main>
  );
}
