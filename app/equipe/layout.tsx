import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notre Équipe de Mentors & Coachs | Nexus Réussite",
  description: "Rencontrez nos mentors d'exception: professeurs Agrégés et Certifiés, experts pédagogiques et coachs certifiés. Spécialisations Maths, Sciences, NSI, Grand Oral et orientation Parcoursup.",
  keywords: ["professeurs Agrégés et Certifiés", "mentors pédagogiques", "coachs scolaires", "équipe enseignante", "expertise éducation Tunisie"],
  openGraph: {
    title: "Notre Équipe de Mentors | Nexus Réussite",
    description: "Professeurs Agrégés et Certifiés et experts pédagogiques. Spécialisés Maths, Sciences, NSI, Grand Oral.",
    type: "website",
  },
};

export default function EquipeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
