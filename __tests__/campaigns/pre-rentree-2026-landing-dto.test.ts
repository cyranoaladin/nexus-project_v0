import { getPreRentreePacks } from '@/lib/pricing';
import {
  getPreRentreeCampaign,
  getPreRentreeLandingDTO,
} from '@/lib/campaigns/pre-rentree-2026/getters';

describe('Pré-rentrée 2026 landing DTO', () => {
  it('resolves only the pack ids declared by the campaign through pricing', () => {
    const campaign = getPreRentreeCampaign();
    const packs = getPreRentreePacks(campaign.packProductIds);

    expect(packs.map((pack) => pack.id)).toEqual(campaign.packProductIds);
    expect(packs).toHaveLength(4);
  });

  it('exposes complete serializable campaign content', () => {
    const dto = getPreRentreeLandingDTO();

    expect(dto.content.hero.h1).toBe(
      'Deux semaines pour préparer sérieusement la rentrée',
    );
    expect(dto.content.method).toHaveLength(4);
    expect(dto.content.faq).toHaveLength(16);
    expect(dto.content.practical.preRegistrationNotice).toContain(
      'ne garantit pas une place',
    );
    expect(dto.seo.canonical).toBe('/stages/pre-rentree-2026');
    expect(dto.capacity).toEqual({ minPerCohort: 3, maxPerCohort: 5 });
    expect(dto.blocks).toHaveLength(4);
  });

  it('exposes normalized academic profiles without a Seconde EDS', () => {
    const { academicProfiles } = getPreRentreeLandingDTO();

    expect(academicProfiles.SECONDE).toEqual({});
    expect(academicProfiles.PREMIERE.voies).toHaveLength(2);
    expect(academicProfiles.PREMIERE.mathsProfiles).toHaveLength(2);
    expect(academicProfiles.PREMIERE.eafProfiles).toHaveLength(2);
    expect(academicProfiles.TERMINALE.retainedSpecialties.maxSelections).toBe(2);
    expect(academicProfiles.TERMINALE.mathsOptions).toHaveLength(3);
    expect(JSON.stringify(academicProfiles.SECONDE)).not.toMatch(/EDS.*NSI|NSI.*EDS/i);
  });

  it('keeps all pedagogical fields for every module session', () => {
    const { modules } = getPreRentreeLandingDTO();

    expect(modules).toHaveLength(12);
    for (const campaignModule of modules) {
      expect(campaignModule.prerequisites.length).toBeGreaterThan(0);
      expect(campaignModule.differentiation.length).toBeGreaterThan(0);
      expect(campaignModule.quickAssessment.length).toBeGreaterThan(0);
      expect(campaignModule.sessions).toHaveLength(5);
      for (const session of campaignModule.sessions) {
        expect(session.topics.length).toBeGreaterThan(0);
        expect(session.method.length).toBeGreaterThan(0);
        expect(session.deliverable.length).toBeGreaterThan(0);
      }
    }
  });

  it('derives a pedagogical summary for every level-specific subject card', () => {
    const { subjects } = getPreRentreeLandingDTO();

    for (const subject of subjects) {
      for (const level of subject.levels) {
        expect(subject.summaryByLevel[level]).toEqual(expect.any(String));
        expect(subject.summaryByLevel[level].length).toBeGreaterThan(20);
      }
    }
  });
});
