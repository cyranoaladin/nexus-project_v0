import { Providers } from "@/components/providers";
import 'katex/dist/katex.min.css';
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus Réussite - Pédagogie Augmentée",
  description: "La plateforme de référence pour l'excellence éducative en Tunisie. Accompagnement humain d'élite, plateforme numérique intelligente et assistance IA révolutionnaire.",
  keywords: ["soutien scolaire", "Tunisie", "lycée", "baccalauréat", "cours particuliers", "IA", "pédagogie"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`antialiased bg-white text-bleu-nuit`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
