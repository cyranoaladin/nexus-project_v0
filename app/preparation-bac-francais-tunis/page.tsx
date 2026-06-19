import type { Metadata } from 'next';
import { LandingNiche } from '@/components/marketing/LandingNiche';

export const metadata: Metadata = {
  title: 'Préparer le bac français à Tunis | Nexus Réussite',
  description: 'Accompagnement bac français à Tunis : groupes de 5 maximum, bacs blancs, ARIA et suivi parent.',
  openGraph: {
    title: 'Préparer le bac français à Tunis | Nexus Réussite',
    description: 'Un cadre structurant pour élèves du système français à Tunis et candidats libres.',
    type: 'website',
  },
};

export default function PreparationBacFrancaisTunisPage() {
  return (
    <LandingNiche
      title="Préparer le bac français à Tunis"
      intro="Nexus Réussite accompagne les élèves du système français à Tunis vers le baccalauréat : enseignants agrégés et certifiés, groupes de 5 maximum, bacs blancs sur grilles officielles et plateforme ARIA. Un cadre structurant, pour les élèves scolarisés comme pour les candidats libres."
      jsonLdName="Préparation bac français à Tunis"
      offerRefs={[
        { type: 'annual', id: 'term-duo' },
        { type: 'annual', id: '1re-double-secu' },
        { type: 'pack', id: 'pass-candidat-libre' },
      ]}
      faq={[
        {
          question: 'Le parcours convient-il aux élèves scolarisés et aux candidats libres ?',
          answer: 'Oui. Le bilan permet d’orienter vers un parcours annuel, un stage, un pass ou un accompagnement candidat libre.',
        },
        {
          question: 'Les cours ont-ils lieu en présentiel ?',
          answer: 'Les cours en présentiel et rendez-vous pédagogiques se déroulent à Mutuelleville, sur confirmation.',
        },
      ]}
    />
  );
}
