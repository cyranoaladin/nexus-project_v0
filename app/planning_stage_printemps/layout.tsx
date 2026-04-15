import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Planning Stages Printemps 2026 — Formules & Horaires | Nexus Réussite",
  description:
    "Toutes les formules des stages de printemps 2026 : Maths, Français, NSI, Physique-Chimie, Grand Oral. Plannings détaillés, épreuves blanches, bilans intermédiaires. Du 18 avril au 2 mai 2026.",
  keywords:
    "planning stage printemps 2026, stage maths première, stage bac français, NSI épreuve pratique, grand oral terminale, nexus réussite tunis",
  openGraph: {
    title: "Planning Stages Printemps 2026 — Nexus Réussite",
    description:
      "Choisissez la formule adaptée : mono, duo ou parcours complet. 6 élèves max, bilans transmis aux familles.",
    type: "website",
  },
};

export default function PlanningStageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
