import type { Metadata } from 'next';
import { LandingNiche } from '@/components/marketing/LandingNiche';

export const metadata: Metadata = {
  title: 'Préparer le Grand Oral | Nexus Réussite',
  description: 'Méthode, construction du propos et simulations pour préparer le Grand Oral du bac français.',
  openGraph: {
    title: 'Préparer le Grand Oral | Nexus Réussite',
    description: 'Studio Grand Oral : posture, structure et entraînement.',
    type: 'website',
  },
};

export default function GrandOralPage() {
  return (
    <LandingNiche
      title="Préparer le Grand Oral"
      intro="Le Grand Oral (coef. 10) se joue sur la posture, la structuration et l'entraînement. Le Studio Grand Oral combine méthode, construction du propos et simulations filmées pour aborder l'épreuve avec assurance."
      jsonLdName="Préparation Grand Oral"
      offerRefs={[
        { type: 'ponctuel', id: 'studio-grand-oral' },
        { type: 'annual', id: 'term-duo' },
        { type: 'pack', id: 'pass-go-sprint' },
      ]}
      faq={[
        {
          question: 'Que travaille-t-on pour le Grand Oral ?',
          answer: 'La problématique, la structure, la posture, la clarté du propos et l’entraînement en conditions.',
        },
        {
          question: 'Le Studio Grand Oral peut-il compléter un parcours annuel ?',
          answer: 'Oui. Il peut être intégré comme module ponctuel ou dans un pass selon le besoin de l’élève.',
        },
      ]}
    />
  );
}
