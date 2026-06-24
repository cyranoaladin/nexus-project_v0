import type { Metadata } from 'next';
import { LandingNiche } from '@/components/marketing/LandingNiche';
import { seoLandings } from '@/content/marketing/seo-landings';

const landing = seoLandings['/preparation-bac-francais-tunis'];

export const metadata: Metadata = landing.metadata;

export default function PreparationBacFrancaisTunisPage() {
  return (
    <LandingNiche
      title={landing.title}
      intro={landing.intro}
      jsonLdName={landing.jsonLdName}
      sections={landing.sections}
      relatedLinks={landing.relatedLinks}
      offerRefs={landing.offerRefs}
      faq={landing.faq}
    />
  );
}
