import type { Metadata } from 'next';
import { LandingNiche } from '@/components/marketing/LandingNiche';
import { seoLandings } from '@/content/marketing/seo-landings';

const landing = seoLandings['/candidat-libre-bac-francais'];

export const metadata: Metadata = landing.metadata;

export default function CandidatLibreBacFrancaisPage() {
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
