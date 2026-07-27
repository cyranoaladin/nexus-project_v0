import { PRE_RENTREE_2026_NAVIGATION } from '@/lib/campaigns/pre-rentree-2026/navigation';
import { getPreRentreeCampaign } from '@/lib/campaigns/pre-rentree-2026/getters';

describe('Pré-rentrée client-safe navigation', () => {
  it('is the single navigation contract used by the canonical campaign source', () => {
    const campaign = getPreRentreeCampaign();

    expect(PRE_RENTREE_2026_NAVIGATION.campaignId).toBe(campaign.campaignId);
    expect(PRE_RENTREE_2026_NAVIGATION.path).toBe(campaign.canonicalPath);
  });
});
