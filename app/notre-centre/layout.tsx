import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notre Centre - Campus d'Excellence | Nexus Réussite",
  description: "Visitez notre campus d'excellence au Centre Urbain Nord, Tunis. Espaces dédiés, salles équipées, environnement stimulant pour l'apprentissage. Réservez votre visite guidée.",
  keywords: ["centre formation Tunis", "campus excellence", "centre urbain nord", "salles cours", "espace étude Tunisie"],
  openGraph: {
    title: "Notre Centre - Campus d'Excellence | Nexus Réussite",
    description: "Campus moderne au CUN, Tunis. Espaces équipés pour l'excellence éducative. Visite guidée sur demande.",
    type: "website",
  },
};

export default function NotreCentreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
