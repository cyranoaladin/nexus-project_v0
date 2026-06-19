import type { Metadata } from 'next';
import { LandingNiche } from '@/components/marketing/LandingNiche';

export const metadata: Metadata = {
  title: 'Candidat libre au bac français en Tunisie | Nexus Réussite',
  description: 'Parcours candidat libre : cadre annuel, cellule Cyclades, épreuves blanches et suivi régulier.',
  openGraph: {
    title: 'Candidat libre au bac français en Tunisie | Nexus Réussite',
    description: 'Un cadre structuré pour préparer le bac français en candidat libre.',
    type: 'website',
  },
};

export default function CandidatLibreBacFrancaisPage() {
  return (
    <LandingNiche
      title="Candidat libre au bac français en Tunisie"
      intro="Préparer le bac français en candidat libre, c'est possible avec un vrai cadre : parcours dédiés (Essentiel, Mixte, Premium), cellule Cyclades pour l'administratif, épreuves blanches et suivi régulier. Vous n'êtes plus seul·e face à l'examen."
      jsonLdName="Candidat libre bac français en Tunisie"
      offerRefs={[
        { type: 'annual', id: '1re-libre-accomp' },
        { type: 'annual', id: 'term-libre-mixte' },
        { type: 'pack', id: 'pass-candidat-libre' },
      ]}
      faq={[
        {
          question: 'Nexus aide-t-il pour Cyclades ?',
          answer: 'Oui, les parcours candidats libres peuvent intégrer une cellule Cyclades pour sécuriser les étapes administratives.',
        },
        {
          question: 'Peut-on suivre à distance ?',
          answer: 'Certaines formules sont en ligne ou mixtes. Le bilan permet de confirmer le format le plus adapté.',
        },
      ]}
    />
  );
}
