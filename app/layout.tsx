import type { Metadata } from "next";
import { Inter, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
});

const ibmPlexMono = IBM_Plex_Mono({
  weight: ['400', '500', '600'],
  subsets: ["latin"],
  variable: "--font-mono",
});

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
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable} antialiased bg-[#0a0b0f] text-white font-sans selection:bg-blue-500/30 selection:text-white`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
