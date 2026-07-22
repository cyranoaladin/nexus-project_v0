import type { Metadata } from 'next';
import { getStageCalendar, getStageFormat, isFormatPriceValidated, getPacks, getRules } from '@/lib/pricing';
import Stages2026Page from './Stages2026Page';
import { getPreRentreePublicSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';

export const metadata: Metadata = {
  title: 'Stages 2026/2027 | Nexus Réussite',
  description:
    'Stages 2026/2027 Nexus Réussite : campagnes, matières, volumes, effectifs et conditions présentés offre par offre.',
  robots: { index: true, follow: true },
};

export default function StagesPage() {
  const calendar = getStageCalendar();
  const rules = getRules();
  const passIntensifs = getPacks().filter((pack) => pack.id.startsWith('pass-intensifs'));
  const campaign = getPreRentreePublicSurfaceDTO();
  const subjectLabels = [...new Set(campaign.levels.flatMap((level) => level.subjects.map((subject) => subject.label)))];
  const foundations = campaign.offers.filter((offer) => offer.pricingKind === 'FOUNDATIONS');
  const premium = campaign.offers.filter((offer) => offer.pricingKind === 'PREMIUM_PACK');

  const formatIds = [...new Set(calendar.map((entry) => entry.format_id))]
    .filter((id): id is string => typeof id === 'string');
  const formatMap: Record<string, { format: NonNullable<ReturnType<typeof getStageFormat>>; priceValidated: boolean }> = {};
  for (const id of formatIds) {
    const format = getStageFormat(id);
    if (format) {
      formatMap[id] = { format, priceValidated: isFormatPriceValidated(format) };
    }
  }

  return <Stages2026Page
    calendar={calendar}
    rules={rules}
    passIntensifs={passIntensifs}
    formatMap={formatMap}
    campaign={{
      id: campaign.campaignId,
      path: campaign.canonicalPath,
      eyebrow: `${campaign.startLabel} · ${campaign.venue}`,
      subtitle: campaign.promise,
      levels: campaign.levels.map((level) => level.label),
      subjects: subjectLabels,
      capacityLabel: `Fondations : ${Math.min(...foundations.map((offer) => offer.groupMin))} à ${Math.max(...foundations.map((offer) => offer.groupMax))} élèves · Premium : ${Math.min(...premium.map((offer) => offer.groupMin))} à ${Math.max(...premium.map((offer) => offer.groupMax))} élèves`,
    }}
  />;
}
