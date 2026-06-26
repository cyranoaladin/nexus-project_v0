import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import { Providers } from "@/components/providers";
import { getAllOffers, getEffectivePrice } from "@/lib/pricing";
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
  title: "Nexus Réussite | Accompagnement académique premium à Tunis",
  description: "Accompagnement académique premium pour les élèves du système français à Tunis : groupes réduits, méthode structurée, bilans individualisés et suivi parent clair.",
  keywords: ["soutien scolaire", "Tunisie", "lycée français", "baccalauréat", "cours particuliers", "ARIA", "pédagogie"],
  icons: [
    { rel: "icon", url: "/web-app-manifest-192x192.png", type: "image/png", sizes: "192x192" },
    { rel: "shortcut icon", url: "/web-app-manifest-192x192.png", type: "image/png", sizes: "192x192" },
  ],
  openGraph: {
    title: "Nexus Réussite | Accompagnement académique premium à Tunis",
    description: "Groupes réduits, méthode structurée, bilans individualisés et suivi parent clair pour les élèves du système français à Tunis.",
    siteName: 'Nexus Réussite',
    locale: 'fr_FR',
    type: 'website',
    images: [
      {
        url: '/og-default.png',
        width: 1200,
        height: 630,
        alt: 'Nexus Réussite — Accompagnement académique premium à Tunis',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Nexus Réussite | Accompagnement académique premium à Tunis",
    description: "Groupes réduits, méthode structurée, bilans individualisés et suivi parent clair pour les élèves du système français à Tunis.",
    images: ['/og-default.png'],
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
  const publicPrices = getAllOffers()
    .map((offer) => getEffectivePrice(offer))
    .filter((value): value is number => typeof value === 'number');

  const lowPrice = publicPrices.length > 0 ? String(Math.min(...publicPrices)) : undefined;
  const highPrice = publicPrices.length > 0 ? String(Math.max(...publicPrices)) : undefined;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'Nexus Réussite',
    alternateName: 'Nexus Digital Campus',
    url: process.env.NEXTAUTH_URL || 'https://nexusreussite.academy',
    description: 'Plateforme d’accompagnement éducatif combinant groupes réduits, méthode structurée, bilans individualisés et outils numériques complémentaires.',
    areaServed: { '@type': 'Country', name: 'Tunisia' },
    availableLanguage: ['fr'],
    sameAs: [],
    offers: lowPrice && highPrice ? {
      '@type': 'AggregateOffer',
      priceCurrency: 'TND',
      lowPrice,
      highPrice,
      offerCount: String(publicPrices.length),
    } : undefined,
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
      <body className={`${inter.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable} ${fraunces.variable} ${dmSans.variable} antialiased bg-lux-ink text-neutral-100 font-sans selection:bg-lux-gold/30 selection:text-white`}>
        <a href="#main-content" className="skip-to-content">
          Aller au contenu principal
        </a>
        <Providers>
            {children}
        </Providers>
      </body>
    </html>
  );
}
