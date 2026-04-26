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
  title: 'Nexus Réussite — Académie premium d’accompagnement scolaire | Tunis',
  description:
    "Cours hebdomadaires, stages intensifs, packs par objectif, préparation EAF, mathématiques, NSI, Grand Oral, plateforme numérique et suivi personnalisé toute l’année.",
  keywords:
    'nexus réussite, accompagnement scolaire, cours hebdomadaires, stages intensifs, préparation EAF, mathématiques première terminale, NSI, grand oral, Mutuelleville',
  openGraph: {
    title: 'Nexus Réussite — Académie premium d’accompagnement scolaire',
    description:
      "Une académie qui accompagne les élèves toute l’année avec cours, stages, packs ciblés, plateforme numérique et suivi personnalisé.",
    type: 'website',
    url: 'https://nexusreussite.academy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexus Réussite — Académie premium d’accompagnement scolaire',
    description:
      "Cours, stages, packs objectif, préparation EAF, mathématiques, NSI, Grand Oral et suivi individualisé.",
  },
};

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#f7fbff] font-sans text-slate-950 selection:bg-[#dbeafe] selection:text-[#0f2f57]">
      {/* Grain Overlay */}
      <div className="grain-overlay fixed inset-0 pointer-events-none opacity-[0.025] z-[9999] mix-blend-multiply"
        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }}
      />

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        richColors
        theme="light"
        toastOptions={{
          className: 'bg-white border-slate-200 text-slate-950',
        }}
      />

      {/* Navigation */}
      <CorporateNavbar />

      {/* SEO fallback for crawlers that don't execute JS */}
      <noscript>
        <div className="sr-only">
          <h1>Nexus Réussite, académie premium d’accompagnement scolaire à Tunis.</h1>
          <p>Nexus Réussite accompagne les élèves toute l’année vers la réussite, avec des cours, des stages, des packs ciblés, une plateforme numérique et un suivi personnalisé.</p>
          <a href="/stages">Découvrir les Stages Printemps</a>
          <a href="https://eaf.nexusreussite.academy">Accéder à la plateforme numérique EAF</a>
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
