import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import { Metadata } from 'next';
import { getRules } from '@/lib/pricing';

const rules = getRules();

export const metadata: Metadata = {
  title: 'Offres & Tarifs — Catalogue 2026/2027 | Nexus Réussite',
  description:
    `Tous les parcours, stages intensifs, Pass et formules Nexus Réussite. Groupes de ${rules.group_max} max, tarifs en TND, échéanciers transparents. Enseignants qualifiés, plateforme ARIA.`,
  keywords: [
    'tarifs accompagnement scolaire Tunis',
    'prix bac français',
    'stages intensifs',
    'soutien scolaire Tunisie',
    'Nexus Réussite offres',
  ],
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
    title: 'Offres & Tarifs — Catalogue 2026/2027 | Nexus Réussite',
    description:
      `Parcours annuels, stages intensifs, Pass fidélité et Carte Nexus. Groupes de ${rules.group_max} max, tarifs en TND.`,
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function OffresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
