import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Spécialité Maths Première - Fiches de Révision | Nexus Réussite',
  description:
    'Fiches de révision interactives pour la Spécialité Mathématiques en Première Générale. Suites, Second Degré, Dérivation, Exponentielle, Trigonométrie, Produit Scalaire, Probabilités Conditionnelles. Programme officiel 2025-2026.',
  keywords: [
    'maths première',
    'spécialité maths',
    'révision bac',
    'suites numériques',
    'dérivation',
    'exponentielle',
    'trigonométrie',
    'produit scalaire',
    'probabilités conditionnelles',
    'programme officiel',
  ],
  openGraph: {
    title: 'Spécialité Maths 1ère - Révisions Interactives | Nexus Réussite',
    description:
      'Fiches de cours, quiz et exercices corrigés pour la Spécialité Maths en Première. Basé sur le B.O. Éducation Nationale 2025-2026.',
    type: 'website',
  },
};

export default function MathsPremiereLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
