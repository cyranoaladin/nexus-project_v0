import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';

describe('Pré-rentrée practical information', () => {
  it('publishes canonical BYOD and physics delivery guidance without internal planning copy', () => {
    const dto = getPreRentreeLandingDTO();
    const materialsBySubject = (dto.content.practical as unknown as {
      materialsBySubject?: Record<string, { description: string }>;
    }).materialsBySubject;

    expect(materialsBySubject).toBeDefined();
    if (!materialsBySubject) return;

    expect(materialsBySubject.NSI.description).toBe(
      'Pour les modules NSI/SNT, l’élève apporte un ordinateur portable. Deux postes de secours sont disponibles en nombre limité ; contactez Nexus avant le stage si nécessaire.',
    );
    expect(materialsBySubject.PHYSIQUE_CHIMIE.description).toContain(
      'théorique et méthodologique',
    );
    expect(materialsBySubject.PHYSIQUE_CHIMIE.description).toContain(
      'Aucune séance de laboratoire n’est annoncée',
    );
    expect(JSON.stringify(dto.organization)).not.toContain('Six créneaux de module au total');
    expect(JSON.stringify(dto.organization)).not.toContain('aucune simultanéité');
  });
});
