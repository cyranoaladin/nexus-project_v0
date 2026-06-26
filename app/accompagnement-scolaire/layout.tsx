import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accompagnement scolaire | Nexus Réussite",
  description: "Accompagnement scolaire pour le système français à Tunis : groupes réduits, bilans individualisés, suivi parent clair et complément numérique selon formule.",
  alternates: { canonical: '/accompagnement-scolaire' },
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
    title: "Accompagnement scolaire | Nexus Réussite",
    description: "Un cadre exigeant pour progresser avec méthode, groupes réduits et suivi clair.",
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
