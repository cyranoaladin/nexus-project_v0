import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexus Réussite | Educational Intelligence & Web3 Factory",
  description: "Expertise hybride : Consulting Éducatif & Studio de Développement IA/Blockchain. Hybrid Expertise: Education Consulting & AI/Web3 Factory.",
  keywords: ["soutien scolaire", "Tunisie", "IA", "pédagogie", "Web3", "Blockchain", "RAG", "LMS"],
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