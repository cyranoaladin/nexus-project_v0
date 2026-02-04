'use client';

import React from 'react';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { UrgencyBanner } from '@/components/stages/UrgencyBanner';
import { StagesHero } from '@/components/stages/StagesHero';
import { Timeline } from '@/components/stages/Timeline';
import { TierCards } from '@/components/stages/TierCards';
import { SubjectTierTable } from '@/components/stages/SubjectTierTable';
import { HoursSchedule } from '@/components/stages/HoursSchedule';
import { AcademyGrid } from '@/components/stages/AcademyGrid';
import { FAQAccordion } from '@/components/stages/FAQAccordion';
import { SocialProof } from '@/components/stages/SocialProof';
import { FinalCTA } from '@/components/stages/FinalCTA';
import { StickyMobileCTA } from '@/components/stages/StickyMobileCTA';
import { ScrollDepthTracker } from '@/components/stages/ScrollDepthTracker';
import {
  tiers,
  subjectsContent,
  academies,
  faq,
  stats,
  testimonials,
  deadlines,
  timeline,
  hoursSchedule,
} from '@/data/stages/fevrier2026';

export default function StagesFevrier2026Page() {
  return (
    <div className="min-h-screen bg-white scroll-smooth">
      {/* Tracking */}
      <ScrollDepthTracker />

      {/* A — Top Banner (urgence) */}
      <UrgencyBanner closingDate="10/02" />

      {/* Header */}
      <Header />

      <main>
        {/* B — HERO (above the fold) */}
        <StagesHero stats={stats} />

        {/* C — Timeline "Février décide" */}
        <Timeline items={timeline} />

        {/* D — Bloc "Deux paliers, deux trajectoires" */}
        <TierCards tiers={tiers} />

        {/* E — Maths & NSI : ce que couvre février */}
        <SubjectTierTable subjectsContent={subjectsContent} />

        {/* F — Volumes horaires */}
        <HoursSchedule schedule={hoursSchedule} />

        {/* G — Offres / Académies */}
        <AcademyGrid academies={academies} />

        {/* H — FAQ */}
        <FAQAccordion faq={faq} />

        {/* I — Preuves & engagements */}
        <SocialProof testimonials={testimonials} />

        {/* J — Closing / Urgence finale */}
        <FinalCTA closingDate={deadlines.registrationCloseDate} academies={academies} />
      </main>

      {/* Footer */}
      <Footer />

      {/* Sticky mobile CTA */}
      <StickyMobileCTA />
    </div>
  );
}
