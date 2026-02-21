import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'ARIA — Assistant IA Pédagogique 24/7 | Nexus Réussite',
  description: 'ARIA est l\'assistant IA pédagogique de Nexus Réussite. Disponible 24h/24 dans 10 matières du lycée français : Maths, NSI, Physique-Chimie, Français, Philosophie, Histoire-Géo, SVT, SES, Anglais, Espagnol. Entraîné sur les programmes officiels.',
};

export default function PlateformeAriaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
