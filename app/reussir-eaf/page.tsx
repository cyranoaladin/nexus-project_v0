import type { Metadata } from 'next';
import { LandingNiche } from '@/components/marketing/LandingNiche';
import { seoLandings } from '@/content/marketing/seo-landings';

const landing = seoLandings['/reussir-eaf'];

export const metadata: Metadata = landing.metadata;

export default function ReussirEafPage() {
  return (
    <LandingNiche
      path={landing.path}
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
