import { CorporateFooter } from "@/components/layout/CorporateFooter";
import { CorporateNavbar } from "@/components/layout/CorporateNavbar";

import AcademiesSection from "./_components/AcademiesSection";
import FAQSection from "./_components/FAQSection";
import FinalCTA from "./_components/FinalCTA";
import GrandOralSection from "./_components/GrandOralSection";
import MarketComparison from "./_components/MarketComparison";
import PricingTable from "./_components/PricingTable";
import SocialProof from "./_components/SocialProof";
import StagesHeader from "./_components/StagesHeader";
import StagesHero from "./_components/StagesHero";
import UrgencyTimeline from "./_components/UrgencyTimeline";

export default function StagesPage() {
  return (
    <div className="min-h-screen bg-nexus-bg font-body text-white selection:bg-nexus-green/25 selection:text-white">
      <CorporateNavbar />

      <main id="main-content" className="pt-24 md:pt-28">
        <StagesHeader />
        <StagesHero />
        <UrgencyTimeline />
        <MarketComparison />
        <AcademiesSection />
        <GrandOralSection />
        <PricingTable />
        <SocialProof />
        <FAQSection />
        <FinalCTA />
      </main>

      <CorporateFooter />
    </div>
  );
}
