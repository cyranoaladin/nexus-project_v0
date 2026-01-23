'use client';

import React from 'react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import KorrigoShowcase from '@/components/sections/korrigo-showcase';
import HomeHero from '@/components/sections/home-hero';
import ProblemSolutionSection from '@/components/sections/problem-solution-section';
import HowItWorksSection from '@/components/sections/how-it-works-section';
import DNASection from '@/components/sections/dna-section';
import PillarsGrid from '@/components/sections/pillars-grid';
import ContactSection from '@/components/sections/contact-section';
import DetailedServices from '@/components/sections/detailed-services';
import KorrigoFeatures from '@/components/sections/korrigo-features';
import TestimonialsSection from '@/components/sections/testimonials-section';
import ImpactSection from '@/components/sections/impact-section';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-deep-midnight text-slate-200 font-sans selection:bg-gold-500/20 selection:text-gold-400">
      <CorporateNavbar />

      <HomeHero />

      <ProblemSolutionSection />

      <HowItWorksSection />

      <DNASection />

      <PillarsGrid />

      <DetailedServices />

      <KorrigoShowcase />

      <KorrigoFeatures />

      <ImpactSection />

      <TestimonialsSection />

      <ContactSection />

      <CorporateFooter />
    </div>
  );
}
