import { getPreRentreeCampaign, getPreRentreeModules } from '@/lib/campaigns/pre-rentree-2026/getters';

describe('Pré-rentrée programme anchors', () => {
  it('provides every subject CTA with the canonical module id for its entry level', () => {
    const campaign = getPreRentreeCampaign();
    const modules = getPreRentreeModules();

    for (const subject of campaign.subjects) {
      for (const level of subject.levels) {
        const module = modules.find(
          (candidate) => candidate.level === level && candidate.subjectId === subject.id,
        );
        expect(module).toBeDefined();
      }
    }
  });
});
