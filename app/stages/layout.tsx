import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stages Printemps 2026 — La Dernière Ligne Droite | Nexus Réussite",
  description:
    "Stages intensifs Première & Terminale : Maths, Français, NSI, Grand Oral. 6 élèves max, enseignants agrégés. Épreuves blanches incluses. Du 18 avril au 2 mai 2026 à Tunis.",
  keywords:
    "stage bac 2026, stage maths terminale tunis, épreuve pratique NSI, bac français première, grand oral terminale, stage printemps tunis, nexus réussite",
  openGraph: {
    title: "Stages Printemps 2026 — Nexus Réussite",
    description:
      "On ne révise plus, on valide. Simulations réelles, 6 élèves max, agrégés.",
    type: "website",
  },
};

export default function StagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
