import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notre Équipe de Mentors & Coachs | Nexus Réussite",
  description: "Rencontrez nos mentors d'exception: professeurs agrégés et certifiés, experts pédagogiques et coachs certifiés. Spécialisations Maths, Sciences, NSI, Grand Oral et orientation Parcoursup.",
  keywords: ["professeurs agrégés et certifiés", "mentors pédagogiques", "coachs scolaires", "équipe enseignante", "expertise éducation Tunisie"],
  openGraph: {
    title: "Notre Équipe de Mentors | Nexus Réussite",
    description: "Professeurs agrégés et certifiés et experts pédagogiques. Spécialisés Maths, Sciences, NSI, Grand Oral.",
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
