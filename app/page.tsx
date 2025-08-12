"use client";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { BusinessModelSection } from "@/components/sections/business-model-section";
import { CandidatLibreSection } from "@/components/sections/candidat-libre-section";
import { ComparisonTableSection } from "@/components/sections/comparison-table-section";
import { CTASection } from "@/components/sections/cta-section";
import { GuaranteeSection } from "@/components/sections/guarantee-section";
import { HeroSection } from "@/components/sections/hero-section";
import { HowItWorksSection } from "@/components/sections/how-it-works-section";
import { PillarsSection } from "@/components/sections/pillars-section";
import { ProblemSolutionSection } from "@/components/sections/problem-solution-section";
import { StagesIntensifsSection } from "@/components/sections/stages-intensifs-section";
import { AriaChat } from "@/components/ui/aria-chat";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <HeroSection />
        <ProblemSolutionSection />
        <ComparisonTableSection />
        <PillarsSection />
        <HowItWorksSection />
      </main>
      <Footer />
      <AriaChat />
    </div>
  );
}
