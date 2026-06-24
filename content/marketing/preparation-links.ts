export type PreparationLink = {
  href: '/preparation-bac-francais-tunis' | '/candidat-libre-bac-francais' | '/reussir-eaf' | '/grand-oral';
  label: string;
  description: string;
};

export const PREPARATION_LINKS: PreparationLink[] = [
  {
    href: '/preparation-bac-francais-tunis',
    label: 'Préparation bac français',
    description: 'Hub pour élèves scolarisés, candidats libres, EAF, spécialités et Grand Oral.',
  },
  {
    href: '/candidat-libre-bac-francais',
    label: 'Candidat libre',
    description: 'Modalités A/B, coefficients, Cyclades et organisation des épreuves ponctuelles.',
  },
  {
    href: '/reussir-eaf',
    label: 'Réussir l’EAF',
    description: 'Écrit, oral, descriptif, méthode du commentaire et dissertation.',
  },
  {
    href: '/grand-oral',
    label: 'Grand Oral',
    description: 'Deux questions, exposé, échange avec le jury et simulations.',
  },
];
