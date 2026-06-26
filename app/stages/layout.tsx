import { OG_DEFAULT_IMAGE } from '@/lib/seo';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stages 2026/2027 | Nexus Réussite",
  description:
    "Stages de prérentrée, Toussaint, hiver, printemps et sprint final. Groupes réduits, présentiel à Mutuelleville ou en ligne.",
  openGraph: {
    images: [OG_DEFAULT_IMAGE],
    title: "Stages 2026/2027 — Nexus Réussite",
    description: "Des stages utiles, structurés et pensés pour la progression réelle.",
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
