import { Metadata } from 'next';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';
import { PreRentreeHero } from '@/components/pre-rentree-2026/PreRentreeHero';
import StageConfigurator from '@/components/pre-rentree-2026/StageConfigurator';
import { ScheduleSection } from '@/components/pre-rentree-2026/ScheduleSection';
import { ProgramsSection } from '@/components/pre-rentree-2026/ProgramsSection';
import { PricingSection } from '@/components/pre-rentree-2026/PricingSection';
import { NexusMethodSection } from '@/components/pre-rentree-2026/NexusMethodSection';
import { PracticalInformation } from '@/components/pre-rentree-2026/PracticalInformation';
import { CampaignFAQ } from '@/components/pre-rentree-2026/CampaignFAQ';
import { FinalCampaignCTA } from '@/components/pre-rentree-2026/FinalCampaignCTA';

export const metadata: Metadata = {
  title: 'Stages de pré-rentrée 2026 à Tunis | Nexus Réussite',
  description: 'Stages du 17 au 28 août 2026 à Mutuelleville pour les élèves entrant en Seconde, Première ou Terminale : Mathématiques, Physique-Chimie, NSI et Français, en groupes réduits.',
  alternates: { canonical: '/stages/pre-rentree-2026' },
  openGraph: {
    title: 'Stages de pré-rentrée 2026 à Tunis | Nexus Réussite',
    description: 'Stages du 17 au 28 août 2026 à Mutuelleville pour les élèves entrant en Seconde, Première ou Terminale : Mathématiques, Physique-Chimie, NSI et Français, en groupes réduits.',
    url: '/stages/pre-rentree-2026',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
};

export default function PreRentree2026Page() {
  const dto = getPreRentreeLandingDTO();

  return (
    <main className="min-h-screen">
      <PreRentreeHero
        campaign={dto.campaign}
        levels={dto.levels}
        subjects={dto.subjects}
      />
      <StageConfigurator
        levels={dto.levels}
        subjects={dto.subjects}
        packs={dto.packs}
        schedule={dto.schedule}
        modules={dto.modules}
      />
      <section id="planning">
        <ScheduleSection
          schedule={dto.schedule}
          levels={dto.levels}
          subjects={dto.subjects}
          campaign={dto.campaign}
        />
      </section>
      <ProgramsSection modules={dto.modules} levels={dto.levels} />
      <section id="tarifs">
        <PricingSection packs={dto.packs} />
      </section>
      <NexusMethodSection />
      <PracticalInformation campaign={dto.campaign} />
      <CampaignFAQ />
      <FinalCampaignCTA />
    </main>
  );
}
