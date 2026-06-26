import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import type { Metadata } from 'next';
import { RecommandationClient } from './RecommandationClient';

export const metadata: Metadata = {
  title: 'Trouver ma formule — Diagnostic personnalisé | Nexus Réussite',
  description:
    'Répondez à 3 questions pour découvrir la formule Nexus Réussite la plus adaptée à votre profil. Parcours annuels, stages, plateforme, candidat libre et coaching.',
  alternates: { canonical: '/recommandation' },
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
    title: 'Trouver ma formule | Nexus Réussite',
    description:
      '3 questions pour identifier le meilleur parcours : niveau, statut, besoin. Résultats immédiats.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function RecommandationPage() {
  return <RecommandationClient />;
}
