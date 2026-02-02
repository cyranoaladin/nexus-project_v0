import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stages Intensifs Février - Préparation Bac & Brevet | Nexus Réussite",
  description: "Stages intensifs vacances février 2026: Maths, NSI, Grand Oral. Groupes 6 élèves max, professeurs agrégés. De 490 à 990 TND. Préparation Parcoursup et Mention TB.",
  keywords: ["stage février", "stage intensif maths", "préparation bac", "stage NSI", "cours vacances Tunisie", "rattrapage scolaire"],
  openGraph: {
    title: "Stages Février 2026 - Objectif Mention | Nexus Réussite",
    description: "Stages intensifs 20-32h avec professeurs agrégés. Préparation Parcoursup, Bac et TeSciA. Groupes 6 élèves maximum.",
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
