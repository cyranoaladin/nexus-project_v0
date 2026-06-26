import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Centre pédagogique | Nexus Réussite",
  description: "Centre pédagogique de Nexus Réussite à Mutuelleville, Tunis. Rendez-vous sur confirmation, groupes réduits et accompagnement clair.",
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
    title: "Centre pédagogique | Nexus Réussite",
    description: "Centre d’accompagnement pédagogique à Mutuelleville, Tunis.",
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
