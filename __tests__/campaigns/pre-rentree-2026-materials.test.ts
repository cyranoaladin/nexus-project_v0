import { getPreRentreeCampaign } from '@/lib/campaigns/pre-rentree-2026/getters';

describe('Pré-rentrée practical information', () => {
  it('publishes canonical BYOD and physics delivery guidance without internal planning copy', () => {
    const campaign = getPreRentreeCampaign();
    const materialsBySubject = campaign.content.practical.materialsBySubject;

    expect(materialsBySubject).toBeDefined();

    expect(materialsBySubject.NSI.description).toBe(
      'Pour le module NSI (Première, Terminale), l’élève apporte un ordinateur portable. Deux postes de secours sont disponibles en nombre limité ; contactez Nexus avant le stage si nécessaire.',
    );
    expect(materialsBySubject.PHYSIQUE_CHIMIE.description).toContain(
      'théorique et méthodologique',
    );
    expect(materialsBySubject.PHYSIQUE_CHIMIE.description).toContain(
      'Aucune activité pratique en laboratoire n’est annoncée',
    );
  });
});
