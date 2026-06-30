import type { Metadata } from 'next';
import { getStageCalendar, getStageFormat, isFormatPriceValidated, getPacks, getRules } from '@/lib/pricing';
import Stages2026Page from './Stages2026Page';

export const metadata: Metadata = {
  title: 'Stages 2026/2027 | Nexus Réussite',
  description:
    'Stages de prérentrée, Toussaint, hiver, printemps et sprint final. Groupes réduits, présentiel à Mutuelleville ou en ligne.',
  robots: { index: true, follow: true },
};

export default function StagesPage() {
  const calendar = getStageCalendar();
  const rules = getRules();
  const passIntensifs = getPacks().filter((pack) => pack.id.startsWith('pass-intensifs'));

  const formatIds = [...new Set(calendar.map((e) => e.format_id))];
  const formatMap: Record<string, { format: NonNullable<ReturnType<typeof getStageFormat>>; priceValidated: boolean }> = {};
  for (const id of formatIds) {
    const format = getStageFormat(id);
    if (format) {
      formatMap[id] = { format, priceValidated: isFormatPriceValidated(format) };
    }
  }

  return <Stages2026Page calendar={calendar} rules={rules} passIntensifs={passIntensifs} formatMap={formatMap} />;
}
