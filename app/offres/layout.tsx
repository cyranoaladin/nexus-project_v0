import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nos Offres & Tarifs - Accompagnement Scolaire | Nexus Réussite",
  description: "Découvrez nos formules d'accompagnement scolaire: Programme Excellence (299 TND/mois), Pack Bac Garanti (1990 TND/an). Coaching personnalisé avec IA ARIA.",
  keywords: ["tarifs soutien scolaire", "prix cours particuliers", "formules accompagnement", "abonnement scolaire Tunisie", "pack bac"],
  openGraph: {
    title: "Nos Offres & Tarifs | Nexus Réussite",
    description: "Formules d'accompagnement de 299 TND/mois. Programme Excellence et Pack Bac Garanti avec garantie résultats.",
    type: "website",
  },
};

export default function OffresLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
