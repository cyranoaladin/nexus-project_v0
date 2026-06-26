import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Espace Famille - Suivi & Accompagnement Parents | Nexus Réussite",
  description: "Espace dédié aux parents: suivi en temps réel, rapports détaillés, communication directe avec les mentors. Accompagnez votre enfant vers la réussite en toute transparence.",
  keywords: ["espace parents", "suivi scolaire", "reporting pédagogique", "communication parents", "transparence éducation"],
  openGraph: {
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "Nexus Réussite" }],
    title: "Espace Famille | Nexus Réussite",
    description: "Suivi en temps réel, rapports détaillés, communication directe. Accompagnez votre enfant vers la réussite.",
    type: "website",
  },
};

export default function FamilleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
