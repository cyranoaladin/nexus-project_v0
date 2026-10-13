import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import type { Metadata } from 'next';

import { getALaUneCandidatsLibres } from '@/lib/candidats-libres-2027';

import { HomePageClient } from './HomePageClient';

/** Régénérée toutes les heures : le bloc « À la une » suit les échéances de la campagne. */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Nexus Réussite | Accompagnement académique premium à Tunis',
  description:
    "Accompagnement académique pour les élèves du système français à Tunis : parcours, matières, formats et conditions présentés offre par offre.",
  keywords:
    'Nexus Réussite, bac français, Tunis, accompagnement scolaire, candidats libres, Première, Terminale',
  alternates: { canonical: '/' },
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
    title: 'Nexus Réussite | Accompagnement académique premium à Tunis',
    description:
      "Des parcours académiques dont les matières, formats et conditions sont présentés offre par offre.",
    type: 'website',
    url: 'https://nexusreussite.academy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexus Réussite | Accompagnement académique premium à Tunis',
    description:
      "Parcours académiques, stages et conditions présentés offre par offre pour les élèves du système français à Tunis.",
  },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return <HomePageClient aLaUne={getALaUneCandidatsLibres()} />;
}
