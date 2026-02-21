'use client';

import React from 'react';
import { Toaster } from 'sonner';

import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';

// Sections Imports
import HeroSectionGSAP from '@/components/sections/hero-section-gsap';
import TrinityServicesGSAP from '@/components/sections/trinity-services-gsap';
import PathsSectionGSAP from '@/components/sections/paths-section-gsap';
import ApproachSectionGSAP from '@/components/sections/approach-section-gsap';
import DNASectionGSAP from '@/components/sections/dna-section-gsap';
import OfferSectionGSAP from '@/components/sections/offer-section-gsap';
import TestimonialsSectionGSAP from '@/components/sections/testimonials-section-gsap';
import ContactSectionGSAP from '@/components/sections/contact-section-gsap';

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
          <h1>Nexus Réussite — Plateforme de Pilotage Éducatif</h1>
          <p>Coachs Agrégés et Certifiés + IA pédagogique ARIA 24/7 + Dashboard parent en temps réel. Le seul programme qui s'engage sur les résultats de votre enfant au Baccalauréat.</p>
          <p>Formules d'accompagnement : Accès Plateforme (150 TND/mois), Hybride (450 TND/mois), Immersion (750 TND/mois). Stages intensifs vacances. Garantie Mention ou mois offerts.</p>
          <a href="/bilan-gratuit">Commencer mon Bilan Stratégique Gratuit</a>
          <a href="/offres">Voir les offres</a>
          <a href="/stages">Voir les stages</a>
        </div>
      </noscript>

      {/* Main Content */}
      <main id="main-content" className="relative z-10 w-full overflow-hidden">
        {/* The Narrative Flow */}
        <HeroSectionGSAP />
        <TrinityServicesGSAP />
        <PathsSectionGSAP />
        <ApproachSectionGSAP />
        <DNASectionGSAP />
        <OfferSectionGSAP />
        <TestimonialsSectionGSAP />
        <ContactSectionGSAP />
      </main>

      <CorporateFooter />
    </div>
  );
}
