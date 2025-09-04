import Footer from "@/components/Footer";
import { Providers } from "@/components/providers";
import 'katex/dist/katex.min.css';
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexus Réussite - Pédagogie Augmentée",
  description: "La plateforme de référence pour l'excellence éducative en Tunisie. Accompagnement humain d'élite, plateforme numérique intelligente et assistance IA révolutionnaire.",
  keywords: ["soutien scolaire", "Tunisie", "lycée", "baccalauréat", "cours particuliers", "IA", "pédagogie"],
  // Définir metadataBase pour résoudre correctement les URLs d'images OG/Twitter en dev/CI
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.E2E_BASE_URL || 'http://localhost:3003'),
  openGraph: {
    title: "Nexus Réussite — Pédagogie augmentée Bac & Parcoursup",
    description: "Professeurs agrégés + IA ARIA. Cours, coaching, stages, programme annuel. Visez la mention et un dossier Parcoursup solide.",
    url: "https://nexusreussite.academy/",
    siteName: "Nexus Réussite",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/images/logo_slogan_nexus_x3.png",
        width: 1200,
        height: 630,
        alt: "Nexus Réussite — Pédagogie augmentée"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Nexus Réussite — Pédagogie augmentée",
    description: "Professeurs agrégés + IA ARIA. Visez la mention et un dossier Parcoursup solide.",
    images: [
      "/images/logo_slogan_nexus_x3.png"
    ]
  },
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
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "Nexus Réussite",
                "url": "https://nexusreussite.academy/",
                "logo": "https://nexusreussite.academy/images/logo_nexus.png",
                "contactPoint": [{
                  "@type": "ContactPoint",
                  "telephone": "+21699192829",
                  "contactType": "customer service",
                  "availableLanguage": ["fr"]
                }],
                "address": {
                  "@type": "PostalAddress",
                  "streetAddress": "Rue du Lac Windermere, Immeuble Golden Tower, Bloc C, B 5-1",
                  "addressLocality": "Tunis",
                  "postalCode": "1053",
                  "addressCountry": "TN"
                }
              })
            }}
          />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
