import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bilan Diagnostic Pré-Stage Maths | Nexus Réussite",
  description: "Bilan diagnostic personnalisé avant votre stage de mathématiques. Évaluez votre niveau, identifiez vos priorités et recevez un rapport détaillé pour préparer l'épreuve anticipée 2026.",
  keywords: ["bilan diagnostic maths", "pré-stage", "épreuve anticipée 2026", "baccalauréat", "soutien scolaire maths", "positionnement mathématiques"],
  openGraph: {
    title: "Bilan Diagnostic Pré-Stage Maths | Nexus Réussite",
    description: "Bilan diagnostic personnalisé avant votre stage de mathématiques. Rapport détaillé pour l'élève, les parents et l'équipe pédagogique.",
    type: "website",
  },
};

export default function BilanPallier2MathsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
