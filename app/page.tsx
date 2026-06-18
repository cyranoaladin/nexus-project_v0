import type { Metadata } from 'next';

import { HomePageClient } from './HomePageClient';

export const metadata: Metadata = {
  title: 'Nexus Réussite — Accompagnement Bac français · Tunis',
  description:
    "Établissement d'accompagnement pour le bac français à Tunis : enseignants agrégés, groupes de 5 max, bacs blancs, carte d'examen, plateforme Masterium et suivi parents.",
  keywords:
    'Nexus Réussite, Bac français, Tunis, accompagnement scolaire, candidats libres, Première, Terminale, bacs blancs, Masterium',
  openGraph: {
    title: 'Nexus Réussite — Accompagnement Bac français · Tunis',
    description:
      "VISER. ATTEINDRE. DÉPASSER. Un cadre structurant jusqu'au bac : carte d'examen, groupes de 5 max, bacs blancs sur grilles officielles, plateforme Masterium.",
    type: 'website',
    url: 'https://nexusreussite.academy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexus Réussite — Accompagnement Bac français · Tunis',
    description:
      "Pas seulement des cours : un cadre, une méthode et un suivi humain pour piloter la trajectoire jusqu'au bac.",
  },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return <HomePageClient />;
}
