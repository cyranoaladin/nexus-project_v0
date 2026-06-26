import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import type { Metadata } from 'next';

import { HomePageClient } from './HomePageClient';

export const metadata: Metadata = {
  title: 'Nexus Réussite | Accompagnement académique premium à Tunis',
  description:
    "Accompagnement académique premium pour les élèves du système français à Tunis : groupes réduits, méthode structurée, bilans individualisés et suivi parent clair.",
  keywords:
    'Nexus Réussite, bac français, Tunis, accompagnement scolaire, candidats libres, Première, Terminale, ARIA',
  alternates: { canonical: '/' },
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
    title: 'Nexus Réussite | Accompagnement académique premium à Tunis',
    description:
      "Un cadre exigeant pour progresser avec méthode, suivi clair et groupes réduits.",
    type: 'website',
    url: 'https://nexusreussite.academy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexus Réussite | Accompagnement académique premium à Tunis',
    description:
      "Groupes réduits, méthode structurée, bilans individualisés et suivi parent clair pour les élèves du système français à Tunis.",
  },
  robots: { index: true, follow: true },
};

export default function HomePage() {
  return <HomePageClient />;
}
