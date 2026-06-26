import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo";

const title = 'ARIA — Assistant IA pédagogique | Nexus Réussite';
const description = "ARIA complète l\u2019accompagnement humain de Nexus Réussite dans 10 matières du lycée français. Accès selon formule ou add-on, réponses à relire et travailler avec méthode.";

export const metadata: Metadata = {
  title,
  description,
  ...buildPageMetadata({ title, description, path: '/plateforme-aria' }),
};

export default function PlateformeAriaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
