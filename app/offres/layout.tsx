import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import { Metadata } from 'next';
import { getRules } from '@/lib/pricing';

const rules = getRules();

export const metadata: Metadata = {
  title: 'Offres & Tarifs — Catalogue 2026/2027 | Nexus Réussite',
  description:
    `Catalogue Nexus Réussite 2026/2027 : services, effectifs, tarifs en TND et modalités présentés offre par offre. Capacité générale plafonnée à ${rules.group_max} lorsque l’offre l’indique.`,
  keywords: [
    'tarifs accompagnement scolaire Tunis',
    'prix bac français',
    'stages intensifs',
    'soutien scolaire Tunisie',
    'Nexus Réussite offres',
  ],
  alternates: { canonical: '/offres' },
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
