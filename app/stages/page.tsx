import type { Metadata } from 'next';
import { getPublicStageCalendar, getStageFormat, isFormatPriceValidated, getPacks, getRules } from '@/lib/pricing';
import Stages2026Page from './Stages2026Page';
import { getPreRentreePublicSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';
import { PRE_RENTREE_2026_NAVIGATION } from '@/lib/campaigns/pre-rentree-2026/navigation';
import { getPreRentreeCompactCapacityLabel } from '@/lib/campaigns/pre-rentree-2026/offer-options';

export const metadata: Metadata = {
  title: 'Stages 2026/2027 | Nexus Réussite',
  description:
    'Stages 2026/2027 Nexus Réussite : campagnes, matières, volumes, effectifs et conditions présentés offre par offre.',
  robots: { index: true, follow: true },
};

export default function StagesPage() {
  const calendar = getPublicStageCalendar();
  const rules = getRules();
  const passIntensifs = getPacks().filter((pack) => pack.id.startsWith('pass-intensifs'));
  const campaign = getPreRentreePublicSurfaceDTO();
  const campaignCard = campaign
    ? (() => {
        const subjectLabels = [...new Set(campaign.levels.flatMap((level) => level.subjects.map((subject) => subject.label)))];
        return {
          id: campaign.campaignId,
          path: campaign.canonicalPath,
          eyebrow: `${campaign.startLabel} · ${campaign.venue}`,
          subtitle: campaign.promise,
          levels: campaign.levels.map((level) => level.label),
          subjects: subjectLabels,
          capacityLabel: getPreRentreeCompactCapacityLabel(),
        };
      })()
    : undefined;
  const publicCalendar = campaign
    ? calendar
    : calendar.filter((entry) => entry.id !== PRE_RENTREE_2026_NAVIGATION.campaignId);

  const formatIds = [...new Set(publicCalendar.map((entry) => entry.format_id))]
    .filter((id): id is string => typeof id === 'string');
  const formatMap: Record<string, { format: NonNullable<ReturnType<typeof getStageFormat>>; priceValidated: boolean }> = {};
  for (const id of formatIds) {
    const format = getStageFormat(id);
    if (format) {
      formatMap[id] = { format, priceValidated: isFormatPriceValidated(format) };
    }
  }

  return <Stages2026Page
    calendar={publicCalendar}
    rules={rules}
    passIntensifs={passIntensifs}
    formatMap={formatMap}
    campaign={campaignCard}
  />;
}
