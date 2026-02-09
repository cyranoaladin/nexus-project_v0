import type { Metadata } from "next";

export const metadata: Metadata = {
  title: 'Plateforme ARIA | Nexus Réussite - IA pédagogique 24/7',
  description: 'Découvrez ARIA, l\'assistant IA pédagogique de Nexus Réussite. Aide aux devoirs, révisions, préparation examen 24/7 pour lycéens du système français.',
};

export default function PlateformeAriaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
