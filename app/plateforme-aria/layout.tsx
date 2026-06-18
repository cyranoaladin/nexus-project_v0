import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'ARIA — Assistant IA pédagogique | Nexus Réussite',
  description: 'ARIA complète l’accompagnement humain de Nexus Réussite dans 10 matières du lycée français. Accès selon formule ou add-on, réponses à relire et travailler avec méthode.',
};

export default function PlateformeAriaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
