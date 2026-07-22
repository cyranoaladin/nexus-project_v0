import * as campaignGetters from '@/lib/campaigns/pre-rentree-2026/getters';

interface HomepageSpotlightContract {
  campaignId: string;
  ariaLabel: string;
  title: string;
  primaryCtaLabel: string;
  publicStatus: string;
  date: {
    days: string;
    month: string;
    year: string;
    accessibleLabel: string;
    chipLabel: string;
  };
  entryClassesLabel: string;
  subjectFamiliesLabel: string;
  capacityLabel: string;
  volumeLabel: string;
  venueLabel: string;
  editorialLine: string;
  campaignPath: string;
  secondaryCtaLabel: string;
  secondaryCtaPath: string;
}

describe('Pré-rentrée homepage spotlight DTO', () => {
  it('derives the complete public spotlight contract from canonical campaign data', () => {
    const getter = Reflect.get(campaignGetters, 'getPreRentreeHomepageSpotlightDTO');
    expect(typeof getter).toBe('function');
    if (typeof getter !== 'function') return;

    const dto = getter() as HomepageSpotlightContract;
    expect(dto).toEqual({
      campaignId: 'pre-rentree-2026',
      ariaLabel: 'Campagne Pré-rentrée 2026',
      title: 'Stages de pré-rentrée 2026',
      primaryCtaLabel: 'Découvrir la Pré-rentrée 2026',
      publicStatus: 'Campagne en préparation',
      date: {
        days: '17',
        month: 'AOÛT',
        year: '2026',
        accessibleLabel: 'À partir du 17 août 2026.',
        chipLabel: 'dès le 17 août',
      },
      entryClassesLabel: 'Entrée en 3e, Seconde, Première ou Terminale',
      subjectFamiliesLabel: 'Mathématiques · Physique-Chimie · Français · NSI · Philosophie · SVT',
      capacityLabel: 'Fondations : 4 à 5 élèves · Premium : 3 à 5 élèves',
      volumeLabel: '10 h par matière',
      venueLabel: 'Mutuelleville',
      editorialLine: 'Reprendre les fondamentaux. Structurer sa méthode. Aborder la rentrée avec confiance.',
      campaignPath: '/stages/pre-rentree-2026',
      secondaryCtaLabel: 'Voir les offres',
      secondaryCtaPath: '/stages/pre-rentree-2026#offres-pre-rentree',
    });
  });
});
