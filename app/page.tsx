import { OG_DEFAULT_IMAGE, buildPageMetadata } from '@/lib/seo';
import type { Metadata } from 'next';

import { getALaUneCandidatsLibres } from '@/lib/candidats-libres-2027';

import { HomePageClient } from './HomePageClient';

/** Régénérée toutes les heures : le bloc « À la une » suit les échéances de la campagne. */
export const revalidate = 3600;

const TITRE = 'Nexus Réussite — bac français à Tunis, lycéens et candidats libres';
const DESCRIPTION =
  'Accompagnement au bac français à Tunis : élèves des lycées français et candidats libres (session 2027), groupes réduits, épreuves blanches corrigées, bilans avec la famille, stages et inscription Cyclades accompagnée.';

export const metadata: Metadata = {
  title: TITRE,
  description: DESCRIPTION,
  keywords:
    'Nexus Réussite, bac français, Tunis, candidat libre, candidat individuel, Cyclades, Première, Terminale, épreuves anticipées, Grand oral',
  ...buildPageMetadata({ title: TITRE, description: DESCRIPTION, path: '/' }),
  twitter: {
    card: 'summary_large_image',
    title: TITRE,
    description: DESCRIPTION,
    images: [OG_DEFAULT_IMAGE.url],
  },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return <HomePageClient aLaUne={getALaUneCandidatsLibres()} />;
}
