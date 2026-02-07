'use client';

import React from 'react';
import { UrgencyBanner } from '@/components/stages/UrgencyBanner';
import { StagesHero } from '@/components/stages/StagesHero';
import { Timeline } from '@/components/stages/Timeline';
import { SituationsCards } from '@/components/stages/SituationsCards';
import { TierCards } from '@/components/stages/TierCards';
import { TierSelector } from '@/components/stages/TierSelector';
import { ROIComparison } from '@/components/stages/ROIComparison';
import { SubjectTierTable } from '@/components/stages/SubjectTierTable';
import { DetailedSchedule } from '@/components/stages/DetailedSchedule';
import { HoursSchedule } from '@/components/stages/HoursSchedule';
import { RequiredMaterials } from '@/components/stages/RequiredMaterials';
import { MentionSimulator } from '@/components/stages/MentionSimulator';
import { AcademyGrid } from '@/components/stages/AcademyGrid';
import { RegistrationFunnel } from '@/components/stages/RegistrationFunnel';
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
  situations,
  detailedSchedule,
  requiredMaterials,
} from '@/data/stages/fevrier2026';

export default function StagesFevrier2026Page() {
  return (
    <div className="min-h-screen bg-white scroll-smooth">
      {/* Tracking */}
      <ScrollDepthTracker />

      {/* A — Top Banner (urgence) */}
      <UrgencyBanner closingDate="10/02" />

      {/* Header */}

      <main>
        {/* B — HERO (above the fold) */}
        <StagesHero stats={stats} />

        {/* C — Timeline "Février décide" */}
        <Timeline items={timeline} />

        {/* Block 4 — 3 situations classiques */}
        <SituationsCards situations={situations} />

        {/* D — Bloc "Deux paliers, deux trajectoires" */}
        <TierCards tiers={tiers} />

        {/* Block 6 — Guide interactif "Comment choisir ?" */}
        <TierSelector />

        {/* Block 7 — Comparaison ROI (cours particulier vs stages) */}
        <ROIComparison />

        {/* E — Maths & NSI : ce que couvre février */}
        <SubjectTierTable subjectsContent={subjectsContent} />

        {/* Block 9 — Planning détaillé 16-26 février */}
        <DetailedSchedule schedule={detailedSchedule} />

        {/* F — Volumes horaires */}
        <HoursSchedule schedule={hoursSchedule} />

        {/* Block 10 — Matériel requis + stack Python */}
        <RequiredMaterials materials={requiredMaterials} />

        {/* Block 11 — Simulateur impact mention */}
        <MentionSimulator />

        {/* G — Offres / Académies */}
        <AcademyGrid academies={academies} />

        {/* Block 15 — Tunnel de réservation (checkout) */}
        <RegistrationFunnel academies={academies} />

        {/* H — FAQ */}
        <FAQAccordion faq={faq} />

        {/* I — Preuves & engagements */}
        <SocialProof testimonials={testimonials} />

        {/* J — Closing / Urgence finale */}
        <FinalCTA closingDate={deadlines.registrationCloseDate} academies={academies} />
      </main>

      {/* Footer */}

      {/* Sticky mobile CTA */}
      <StickyMobileCTA />
    </div>
  );
}
