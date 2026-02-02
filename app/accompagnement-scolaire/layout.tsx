import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accompagnement Scolaire Premium - IA + Humain | Nexus Réussite",
  description: "Accompagnement scolaire nouvelle génération: coaching humain d'excellence + intelligence artificielle ARIA. Suivi personnalisé 7j/7, garantie résultats. À partir de 299 TND/mois.",
  keywords: ["accompagnement scolaire", "cours particuliers", "soutien scolaire premium", "coaching scolaire", "IA éducation", "ARIA", "Tunisie"],
  openGraph: {
    title: "Accompagnement Scolaire Premium | Nexus Réussite",
    description: "Excellence pédagogique augmentée par l'IA. Coaching humain + assistant ARIA disponible 24/7. Résultats garantis.",
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
