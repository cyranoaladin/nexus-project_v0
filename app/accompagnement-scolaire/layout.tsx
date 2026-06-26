import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accompagnement scolaire | Nexus Réussite",
  description: "Accompagnement scolaire pour le système français à Tunis : groupes réduits, bilans individualisés, suivi parent clair et complément numérique selon formule.",
  openGraph: {
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "Nexus Réussite" }],
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
