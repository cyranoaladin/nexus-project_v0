import type { Metadata } from 'next';
import { Toaster } from 'sonner';

import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import HomeHero from '@/components/sections/homepage/HomeHero';
import UrgencyFinish from '@/components/sections/homepage/UrgencyFinish';
import NexusSelect from '@/components/sections/homepage/NexusSelect';
import FlagshipOffers from '@/components/sections/homepage/FlagshipOffers';
import Forfaits from '@/components/sections/homepage/Forfaits';
import TrustSection from '@/components/sections/homepage/TrustSection';
import HomepageTestimonials from '@/components/sections/homepage/HomepageTestimonials';
import HomepageFinalCTA from '@/components/sections/homepage/HomepageFinalCTA';

export const metadata: Metadata = {
  title: 'Nexus Réussite — Centre d\'entraînement académique premium | Mutuelleville, Tunis',
  description:
    "Stages intensifs, cours hebdomadaires, préparation EAF et mathématiques, Nexus Select post-bac, groupes de niveau et suivi personnalisé à Mutuelleville.",
  keywords:
    'nexus réussite, accompagnement scolaire premium, stages intensifs, préparation EAF, mathématiques, CPGE, Mutuelleville, Tunis, Nexus Select, groupes de niveau',
  openGraph: {
    title: 'Nexus Réussite — Centre d\'entraînement académique premium',
    description:
      "Stages intensifs, cours hebdomadaires, préparation examens, Nexus Select post-bac et suivi personnalisé à Mutuelleville.",
    type: 'website',
    url: 'https://nexusreussite.academy',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexus Réussite — Centre d\'entraînement académique premium',
    description:
      "Stages intensifs, cours hebdomadaires, préparation EAF, mathématiques, Nexus Select et suivi personnalisé.",
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
          <h1>Nexus Réussite, centre d&apos;entraînement académique premium à Mutuelleville, Tunis.</h1>
          <p>Stages intensifs, cours hebdomadaires, préparation EAF et mathématiques, Nexus Select post-bac et suivi personnalisé.</p>
          <a href="/stages">Découvrir les stages intensifs</a>
        </div>
      </noscript>

      {/* Main Content — 7 blocs */}
      <main id="main-content" className="relative z-10 w-full overflow-hidden">
        {/* 1. Hero premium orienté urgence */}
        <HomeHero />

        {/* 2-3. Dernière ligne droite 8 juin + Offre Première Finish */}
        <UrgencyFinish />

        {/* 4. Nexus Select + 4 groupes maths */}
        <NexusSelect />

        {/* 5. Nos accompagnements */}
        <FlagshipOffers />

        {/* 6. Forfaits et formules */}
        <Forfaits />

        {/* 7. Méthode Nexus + Confiance + Témoignages + FAQ + CTA final */}
        <TrustSection />
        <HomepageTestimonials />
        <HomepageFinalCTA />
      </main>

      <CorporateFooter />
    </div>
  );
}
