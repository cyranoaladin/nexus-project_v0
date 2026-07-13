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
  planningPath: string;
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
      publicStatus: 'Pré-inscriptions ouvertes',
      date: {
        days: '17–28',
        month: 'AOÛT',
        year: '2026',
        accessibleLabel: 'Du 17 au 28 août 2026.',
        chipLabel: 'du 17 au 28 août',
      },
      entryClassesLabel: 'Entrée en Seconde, Première ou Terminale',
      subjectFamiliesLabel: 'Mathématiques · Physique-Chimie · Français · NSI/SNT',
      capacityLabel: '3 à 5 élèves',
      volumeLabel: '10 h par matière',
      venueLabel: 'Mutuelleville',
      editorialLine: 'Deux semaines pour préparer sérieusement la rentrée',
      campaignPath: '/stages/pre-rentree-2026',
      planningPath: '/stages/pre-rentree-2026#planning',
    });
  });
});
