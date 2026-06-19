import type { Metadata } from 'next';
import { LandingNiche } from '@/components/marketing/LandingNiche';

export const metadata: Metadata = {
  title: "Réussir l'EAF | Nexus Réussite",
  description: "Préparation aux épreuves anticipées de français : écrit, oral, textes, méthode et grilles officielles.",
  openGraph: {
    title: "Réussir l'EAF | Nexus Réussite",
    description: 'Cap EAF accompagne les élèves de première avec méthode et entraînement.',
    type: 'website',
  },
};

export default function ReussirEafPage() {
  return (
    <LandingNiche
      title="Réussir l'EAF : épreuves anticipées de français"
      intro="L'épreuve anticipée de français (écrit et oral, en première) se prépare tôt et avec méthode. Avec Cap EAF, nos enseignants travaillent les textes, la méthode du commentaire et de la dissertation, et l'oral, en conditions d'examen et sur grilles officielles."
      jsonLdName="Réussir l'EAF"
      offerRefs={[
        { type: 'ponctuel', id: 'cap-eaf' },
        { type: 'annual', id: '1re-eaf' },
        { type: 'pack', id: 'pass-cap-bac-1re' },
      ]}
      faq={[
        {
          question: 'Quand commencer la préparation EAF ?',
          answer: 'Le plus tôt possible en première, afin de travailler les textes, la méthode écrite et l’oral dans la durée.',
        },
        {
          question: 'La préparation inclut-elle des entraînements en conditions ?',
          answer: 'Oui, selon la formule : entraînements, corrections et épreuves blanches sur grilles officielles.',
        },
      ]}
    />
  );
}
