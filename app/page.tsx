import { Footer } from '@/components/layout/footer';
import { Header } from '@/components/layout/header';
import { CTASection } from '@/components/sections/cta-section';
import { ExpertsHighlightSection } from '@/components/sections/experts-highlight-section';
import { GuaranteeSection } from '@/components/sections/guarantee-section';
import { HeroSection } from '@/components/sections/hero-section';
import { HowItWorksSection } from '@/components/sections/how-it-works-section';
import { OffersPreviewSection } from '@/components/sections/offers-preview-section';
import { PillarsSection } from '@/components/sections/pillars-section';
import { ProblemSolutionSection } from '@/components/sections/problem-solution-section';
import { AriaChat } from '@/components/ui/aria-chat';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <HeroSection />
        <PillarsSection />
        <ExpertsHighlightSection />
        <ProblemSolutionSection />
        <OffersPreviewSection />
        <HowItWorksSection />
        <GuaranteeSection />
        <CTASection />
      </main>
      <Footer />
      <AriaChat />
    </div>
  );
}
