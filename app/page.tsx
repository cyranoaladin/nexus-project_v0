'use client';

import React, { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
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
import KorrigoProofSection from '@/components/sections/korrigo-section-gsap';
import TestimonialsSectionGSAP from '@/components/sections/testimonials-section-gsap';
import ContactSectionGSAP from '@/components/sections/contact-section-gsap';

gsap.registerPlugin(ScrollTrigger);

export default function HomePage() {
  useEffect(() => {
    // Wait for all ScrollTriggers to be created
    const timeout = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 500);

    return () => {
      clearTimeout(timeout);
      ScrollTrigger.getAll().forEach(st => st.kill());
    };
  }, []);

  return (
    <div className="relative bg-[#0a0b0f] min-h-screen font-sans selection:bg-blue-500/30 selection:text-white">
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
          style: {
            background: '#111318',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#F4F6FA',
          },
        }}
      />

      {/* Navigation */}
      <CorporateNavbar />

      {/* Main Content */}
      <main className="relative z-10 w-full overflow-hidden">
        {/* The Narrative Flow */}
        <HeroSectionGSAP />
        <TrinityServicesGSAP />
        <PathsSectionGSAP />
        <ApproachSectionGSAP />
        <DNASectionGSAP />
        <OfferSectionGSAP />
        <KorrigoProofSection />
        <TestimonialsSectionGSAP />
        <ContactSectionGSAP />
      </main>

      <CorporateFooter />
    </div>
  );
}
