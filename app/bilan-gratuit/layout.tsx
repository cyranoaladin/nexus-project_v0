import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bilan Gratuit - Diagnostic Personnalisé | Nexus Réussite",
  description: "Obtenez un diagnostic pédagogique complet et gratuit pour votre enfant. Identifiez ses besoins, ses forces et recevez un plan d'action personnalisé par nos experts.",
  keywords: ["bilan gratuit", "diagnostic pédagogique", "évaluation scolaire", "orientation", "soutien scolaire Tunisie"],
  openGraph: {
    title: "Bilan Gratuit - Diagnostic Personnalisé | Nexus Réussite",
    description: "Diagnostic pédagogique complet et gratuit. Plan d'action personnalisé par nos experts.",
    type: "website",
  },
};

export default function BilanGratuitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
