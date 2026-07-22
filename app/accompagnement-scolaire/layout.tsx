import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accompagnement scolaire | Nexus Réussite",
  description: "Parcours Nexus Réussite présentés offre par offre : public, matières, format, effectif, tarif, inclusions et conditions applicables.",
  alternates: { canonical: '/accompagnement-scolaire' },
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
    title: "Accompagnement scolaire | Nexus Réussite",
    description: "Comparer les parcours Nexus Réussite avec leurs matières, formats, inclusions et conditions propres.",
    type: "website",
  },
};

export default function AccompagnementScolaireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
