"use client";

import { useState } from "react";
import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";

import StagesHeader from "./_components/StagesHeader";
import StagesHero from "./_components/StagesHero";
import TrustSignals from "./_components/TrustSignals";
import UrgencyTimeline from "./_components/UrgencyTimeline";
import WhyNexus from "./_components/WhyNexus";
import OffersSection from "./_components/OffersSection";
import ScheduleTable from "./_components/ScheduleTable";
import FAQSection from "./_components/FAQSection";
import FinalCTA from "./_components/FinalCTA";
import StageReservationModal from "./_components/StageReservationModal";
import { ALL_OFFERS, type Offer } from "./_data/offers";

export default function StagesPage() {
  const [reservationOffer, setReservationOffer] = useState<Offer | null>(null);
  const [reservationOpen, setReservationOpen] = useState(false);

  const handleReserve = (offer: Offer) => {
    setReservationOffer(offer);
    setReservationOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#050a14] font-body text-white selection:bg-emerald-500/25 selection:text-white">
      <CorporateNavbar />

      <main id="main-content" className="pt-24 md:pt-28">
        <StagesHeader />
        <StagesHero />
        <TrustSignals />
        <UrgencyTimeline />
        <WhyNexus />
        <OffersSection />
        <ScheduleTable onReserve={handleReserve} />
        <FAQSection />
        <FinalCTA />
      </main>

      <CorporateFooter />

      {/* Global reservation modal for ScheduleTable CTA fallback */}
      <StageReservationModal
        offer={reservationOffer}
        open={reservationOpen}
        setOpen={setReservationOpen}
      />
    </div>
  );
}
