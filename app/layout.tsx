import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import PromoBanner from "@/components/layout/PromoBanner";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-3XPB54QL5N";

const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const spaceGrotesk = localFont({
  src: "./fonts/SpaceGrotesk-Variable.woff2",
  variable: "--font-space",
  weight: "300 700",
  display: "swap",
});

const ibmPlexMono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/IBMPlexMono-SemiBold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

const fraunces = localFont({
  src: "./fonts/Fraunces-Variable.woff2",
  variable: "--font-display",
  weight: "100 900",
  display: "swap",
});

const dmSans = localFont({
  src: "./fonts/DMSans-Variable.woff2",
  variable: "--font-body",
  weight: "100 1000",
  display: "swap",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Do NOT set maximumScale=1 — that breaks accessibility (user zoom)
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://nexusreussite.academy'),
  title: "Nexus Réussite - Pédagogie Augmentée",
  description: "La plateforme de référence pour l'excellence éducative en Tunisie. Accompagnement humain d'élite, plateforme numérique intelligente et assistance IA révolutionnaire.",
  keywords: ["soutien scolaire", "Tunisie", "lycée", "baccalauréat", "cours particuliers", "IA", "pédagogie"],
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "shortcut icon", url: "/favicon.ico" },
  ],
  openGraph: {
    title: "Nexus Réussite - Pédagogie Augmentée",
    description: "La plateforme de référence pour l'excellence éducative en Tunisie. Accompagnement humain d'élite, plateforme numérique intelligente et assistance IA révolutionnaire.",
    siteName: 'Nexus Réussite',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Nexus Réussite - Pédagogie Augmentée",
    description: "La plateforme de référence pour l'excellence éducative en Tunisie. Accompagnement humain d'élite, plateforme numérique intelligente et assistance IA révolutionnaire.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'Nexus Réussite',
    alternateName: 'Nexus Digital Campus',
    url: process.env.NEXTAUTH_URL || 'https://nexusreussite.academy',
    description: 'Plateforme de pilotage éducatif combinant coachs Agrégés et Certifiés, IA pédagogique ARIA et dashboard parent en temps réel pour la réussite au Baccalauréat.',
    areaServed: { '@type': 'Country', name: 'Tunisia' },
    availableLanguage: ['fr'],
    sameAs: [],
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'TND',
      lowPrice: '150',
      highPrice: '990',
      offerCount: '3',
    },
  };

  return (
    <html lang="fr">
      <head>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable} ${fraunces.variable} ${dmSans.variable} antialiased bg-surface-darker text-neutral-100 font-sans selection:bg-brand-accent/30 selection:text-white`}>
        <a href="#main-content" className="skip-to-content">
          Aller au contenu principal
        </a>
        <Providers>
          <PromoBanner />
          <div className="promo-layout-shell">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
