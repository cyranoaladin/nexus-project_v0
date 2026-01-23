import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus Réussite - Pédagogie Augmentée",
  description: "La plateforme de référence pour l'excellence éducative en Tunisie. Accompagnement humain d'élite, plateforme numérique intelligente et assistance IA révolutionnaire.",
  keywords: ["soutien scolaire", "Tunisie", "lycée", "baccalauréat", "cours particuliers", "IA", "pédagogie"],
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "shortcut icon", url: "/favicon.ico" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased bg-white text-bleu-nuit font-sans">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
