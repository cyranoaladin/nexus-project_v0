import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Centre pédagogique | Nexus Réussite",
  description: "Centre pédagogique de Nexus Réussite à Mutuelleville, Tunis. Rendez-vous sur confirmation, groupes réduits et accompagnement clair.",
  openGraph: {
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
