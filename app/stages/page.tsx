import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";

import StagesHeader from "./_components/StagesHeader";
import StagesHero from "./_components/StagesHero";
import TrustSignals from "./_components/TrustSignals";
import UrgencyTimeline from "./_components/UrgencyTimeline";
import WhyNexus from "./_components/WhyNexus";
import ChooseStage from "./_components/ChooseStage";
import AcademiesSection from "./_components/AcademiesSection";
import GrandOralSection from "./_components/GrandOralSection";
import FAQSection from "./_components/FAQSection";
import FinalCTA from "./_components/FinalCTA";

export default function StagesPage() {
  return (
    <div className="min-h-screen bg-nexus-bg font-body text-white selection:bg-nexus-green/25 selection:text-white">
      <CorporateNavbar />

      <main id="main-content" className="pt-24 md:pt-28">
        <StagesHeader />
        <StagesHero />
        <TrustSignals />
        <UrgencyTimeline />
        <WhyNexus />
        <ChooseStage />
        <AcademiesSection />
        <GrandOralSection />
        <FAQSection />
        <FinalCTA />
      </main>

      <CorporateFooter />
    </div>
  );
}
