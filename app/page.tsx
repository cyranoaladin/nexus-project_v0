import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import ADN from "@/components/sections/adn";
import Differentiation from "@/components/sections/differentiation";
import FinalCTA from "@/components/sections/final-cta";
import Guarantee from "@/components/sections/guarantee";
import Hero from "@/components/sections/hero";
import OffersGrid from "@/components/sections/offers-grid";
import PaymentsCredits from "@/components/sections/payments-credits";
import ProcessSteps from "@/components/sections/process-steps";
import Testimonials from "@/components/sections/testimonials";
import { getPricing } from "@/lib/pricing";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function HomePage() {
  const pricing = await getPricing(process.env.NEXT_PUBLIC_APP_URL || undefined);
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <Header />
      <main>
        <Hero />
        <div className="mx-auto max-w-7xl px-4">
          <ADN />
          <OffersGrid pricing={pricing} />
          <Differentiation />
          <PaymentsCredits pricing={pricing} />
          <ProcessSteps />
          <Guarantee />
          <Testimonials />
          <FinalCTA />
        </div>
      </main>
      <Footer />
    </div>
  );
}
