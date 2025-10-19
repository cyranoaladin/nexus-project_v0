import { Providers } from "@/components/providers";
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Polices locales via next/font/local (fallback système si indisponibles)
const inter = localFont({
src: [{ path: "../public/fonts/inter/Inter-Regular.woff2", weight: "400", style: "normal" }],
  variable: "--font-inter",
  display: "swap",
});

const poppins = localFont({
src: [{ path: "../public/fonts/poppins/Poppins-SemiBold.woff2", weight: "600", style: "normal" }],
  variable: "--font-poppins",
  display: "swap",
});

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
      <body className={`${inter.variable} ${poppins.variable} antialiased bg-white text-bleu-nuit`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
