import { PRE_RENTREE_2026_NAVIGATION } from '@/lib/campaigns/pre-rentree-2026/navigation';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';

describe('Pré-rentrée client-safe navigation', () => {
  it('is the single navigation contract used by the canonical campaign DTO', () => {
    const dto = getPreRentreeLandingDTO();

    expect(PRE_RENTREE_2026_NAVIGATION.campaignId).toBe(dto.campaign.id);
    expect(PRE_RENTREE_2026_NAVIGATION.path).toBe(dto.campaign.canonicalPath);
  });
});
