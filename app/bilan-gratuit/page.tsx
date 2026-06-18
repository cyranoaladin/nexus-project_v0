import type { Metadata } from 'next';
import { Suspense } from 'react';
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
    <Suspense fallback={<div className="min-h-[60vh] bg-lux-ink" />}>
      <BilanStrategiqueClient />
    </Suspense>
  );
}
