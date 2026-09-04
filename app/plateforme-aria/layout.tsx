import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

const title = 'ARIA — Assistant IA pédagogique | Nexus Réussite';
const description = "Aperçu pédagogique d’ARIA, l’assistant de travail personnel en cours de qualification technique chez Nexus Réussite, en complément de l’accompagnement humain.";

export const metadata: Metadata = {
  title,
  description,
  ...buildPageMetadata({ title, description, path: '/plateforme-aria' }),
};

export default function PlateformeAriaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
