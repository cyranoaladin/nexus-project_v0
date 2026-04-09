import type { Metadata } from 'next';
import { Toaster } from 'sonner';

import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import HomeHero from '@/components/sections/homepage/HomeHero';
import FlagshipOffers from '@/components/sections/homepage/FlagshipOffers';
import TrustSection from '@/components/sections/homepage/TrustSection';
import DecisionHelper from '@/components/sections/homepage/DecisionHelper';
import HomepageTestimonials from '@/components/sections/homepage/HomepageTestimonials';
import HomepageFinalCTA from '@/components/sections/homepage/HomepageFinalCTA';

export const metadata: Metadata = {
  title: 'Nexus Réussite — Stages Printemps 2026 & Préparation EAF | Tunis',
  description:
    'Stages intensifs Première & Terminale (Maths, Français, NSI, Grand Oral) et plateforme IA de préparation au Bac de Français. 6 élèves max, enseignants agrégés. Du 18 avril au 2 mai 2026.',
  keywords:
    'nexus réussite, stage bac tunis, préparation EAF, bac français 2026, stage maths terminale, NSI épreuve pratique, grand oral, AEFE tunis',
  openGraph: {
    title: 'Nexus Réussite — Stages & Plateforme EAF',
    description:
      'Deux solutions pour viser la mention : stages intensifs + plateforme IA anti-copie.',
    type: 'website',
    url: 'https://nexusreussite.academy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexus Réussite — Stages & Plateforme EAF',
    description:
      'Deux solutions pour viser la mention : stages intensifs + plateforme IA anti-copie.',
  },
};

export default function HomePage() {
  return (
    <div className="relative bg-surface-darker min-h-screen font-sans selection:bg-brand-primary/30 selection:text-white">
      {/* Grain Overlay */}
      <div className="grain-overlay fixed inset-0 pointer-events-none opacity-[0.04] z-[9999] mix-blend-overlay"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }}
      />

      {/* Vignette */}
      <div className="vignette fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,transparent_50%,rgba(0,0,0,0.4)_100%)]" />

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        richColors
        theme="dark"
        toastOptions={{
          className: 'bg-surface-card border-white/10 text-white',
        }}
      />

      {/* Navigation */}
      <CorporateNavbar />

      {/* SEO fallback for crawlers that don't execute JS */}
      <noscript>
        <div className="sr-only">
          <h1>Nexus Réussite, le déclic vers ta réussite !</h1>
          <p>Deux solutions complémentaires pour viser la mention : les Stages Printemps 2026 et la Plateforme EAF Nexus Réussite.</p>
          <a href="/stages">Découvrir les Stages Printemps</a>
          <a href="https://eaf.nexusreussite.academy">Essayer la plateforme EAF gratuitement</a>
        </div>
      </noscript>

      {/* Main Content */}
      <main id="main-content" className="relative z-10 w-full overflow-hidden">
        <HomeHero />
        <FlagshipOffers />
        <TrustSection />
        <DecisionHelper />
        <HomepageTestimonials />
        <HomepageFinalCTA />
      </main>

      <CorporateFooter />
    </div>
  );
}
