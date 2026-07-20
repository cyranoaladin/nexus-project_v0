import type { Metadata } from 'next';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';
import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { CampaignPageTracker } from '@/components/pre-rentree-2026/CampaignPageTracker';
import { PreRentreeHero } from '@/components/pre-rentree-2026/PreRentreeHero';
import StageConfigurator from '@/components/pre-rentree-2026/StageConfigurator';
import { ScheduleSection } from '@/components/pre-rentree-2026/ScheduleSection';
import { ProgramsSection } from '@/components/pre-rentree-2026/ProgramsSection';
import { PricingSection } from '@/components/pre-rentree-2026/PricingSection';
import { NexusMethodSection } from '@/components/pre-rentree-2026/NexusMethodSection';
import { PracticalInformation } from '@/components/pre-rentree-2026/PracticalInformation';
import { CampaignFAQ } from '@/components/pre-rentree-2026/CampaignFAQ';
import { FinalCampaignCTA } from '@/components/pre-rentree-2026/FinalCampaignCTA';
import { OffersSection } from '@/components/pre-rentree-2026/OffersSection';
import { CampaignExperienceProvider } from '@/components/pre-rentree-2026/CampaignExperienceContext';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';

export function generateMetadata(): Metadata {
  const { seo } = getPreRentreeLandingDTO();
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonical },
    openGraph: {
      type: 'website',
      title: seo.title,
      description: seo.description,
      url: seo.canonical,
      siteName: 'Nexus Réussite',
      locale: 'fr_FR',
      images: [{ url: seo.ogImage, alt: seo.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.title,
      description: seo.description,
      images: [seo.ogImage],
    },
  };
}

export default function PreRentree2026Page() {
  const dto = getPreRentreeLandingDTO();
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: dto.content.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <main id="main-content" className="min-h-screen overflow-x-clip bg-lux-paper">
      <CorporateNavbar />
      <CampaignPageTracker />
      {dto.publicationMode === 'REVIEW' && (
        <aside className="bg-amber-100 px-4 py-3 pt-24 text-center text-sm font-semibold text-amber-950" role="status">
          Page de revue — diffusion interdite
        </aside>
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, '\\u003c') }}
      />
      <PreRentreeHero
        campaign={dto.campaign}
        content={dto.content.hero}
        capacityByOffer={dto.capacityByOffer}
        packs={dto.offerOptions}
        schedule={dto.schedule}
        whatsappMessage={dto.contact.whatsappMessage}
        primaryCta={dto.cta.primary.label}
      />
      <OffersSection offers={dto.offers} levels={dto.levels} capabilities={dto.capabilities} />
      <CampaignExperienceProvider>
        <div id="configurateur" className="scroll-mt-24">
          <StageConfigurator
            levels={dto.levels}
            subjects={dto.subjects}
            packs={dto.offerOptions}
            schedule={dto.schedule}
            academicProfiles={dto.academicProfiles}
            groupCompositionNotice={dto.content.practical.groupCompositionNotice}
            campaignPublicStatus={dto.publicStatus}
          />
        </div>
        <div id="planning" className="scroll-mt-24">
          <ScheduleSection
            schedule={dto.schedule}
            scheduleWeeks={dto.scheduleWeeks}
            levels={dto.levels}
            subjects={dto.subjects}
            blocks={dto.blocks}
            organization={dto.organization}
            operationalGates={dto.operationalGates}
          />
        </div>
        <ProgramsSection modules={dto.modules} levels={dto.levels} subjects={dto.subjects} />
      </CampaignExperienceProvider>
      <div id="tarifs" className="scroll-mt-24">
        <PricingSection
          packs={dto.offerOptions}
          levels={dto.levels}
          depositPercentage={dto.pricingRules.depositPercentage}
          campaignYear={dto.campaign.startDate.slice(0, 4)}
        />
      </div>
      <NexusMethodSection steps={dto.content.method} />
      <PracticalInformation
        campaign={dto.campaign}
        blocks={dto.blocks}
        capacityByOffer={dto.capacityByOffer}
        pack={dto.packs.find((pack) => pack.subjectsCount === 1)}
        depositPercentage={dto.pricingRules.depositPercentage}
        content={dto.content.practical}
        cgvPath={dto.legalRefs.cgv}
      />
      <CampaignFAQ items={dto.content.faq} />
      <FinalCampaignCTA campaignPath={dto.campaign.canonicalPath} ctaLabel={dto.cta.primary.label} />
      <CorporateFooter />
    </main>
  );
}
