import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notre Équipe de Mentors & Coachs | Nexus Réussite",
  description: "Découvrez les profils d'accompagnement Nexus : enseignants expérimentés, en exercice dans le système français, et intervenants spécialisés selon les parcours.",
  keywords: ["enseignants expérimentés", "système français", "mentors pédagogiques", "équipe enseignante", "expertise éducation Tunisie"],
  alternates: { canonical: '/equipe' },
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
    title: "Notre Équipe de Mentors | Nexus Réussite",
    description: "Enseignants expérimentés, en exercice dans le système français, et intervenants spécialisés selon les parcours.",
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
