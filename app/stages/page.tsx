import type { Metadata } from 'next';
import Stages2026Page from './Stages2026Page';

export const metadata: Metadata = {
  title: 'Stages 2026/2027 | Nexus Réussite',
  description:
    'Stages de prérentrée, Toussaint, hiver, printemps et sprint final. Groupes réduits, présentiel à Mutuelleville ou en ligne.',
  robots: { index: true, follow: true },
};

export default function StagesPage() {
  return <Stages2026Page />;
}
