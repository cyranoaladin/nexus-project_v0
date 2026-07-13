import { getPreRentreePacks } from '@/lib/pricing';
import { LEGAL } from '@/lib/legal';
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
    expect(dto.content.practical.preRegistrationNotice).toContain('ne réserve pas une place');
    expect(dto.content.practical.preRegistrationNotice).toContain('ne forme pas un contrat');
    expect(dto.seo.canonical).toBe('/stages/pre-rentree-2026');
    expect(dto.capacity).toEqual({ minPerCohort: 3, maxPerCohort: 5 });
    expect(dto.blocks).toHaveLength(4);
    expect(dto.content.hero.subtitle).toContain(
      'initiation informatique, algorithmique et SNT pour l’entrée en Seconde',
    );
    expect(dto.content.hero.subtitle).not.toMatch(/NSI en Seconde|EDS NSI/i);
    expect(dto.packs.map((pack) => pack.code)).toEqual(['PACK_1', 'PACK_2', 'PACK_3', 'PACK_4']);
    expect(JSON.stringify(dto.packs)).not.toContain('pre2026-pack-');
    expect(dto.publicStatus).toBe('Pré-inscriptions ouvertes');
    expect(dto).not.toHaveProperty('status');
    expect(dto.scheduleWeeks).toHaveLength(2);
    expect(dto.scheduleWeeks.flatMap((week) => week.slots)).toHaveLength(12);
    expect(dto.organization.educators).toHaveLength(3);
    expect(dto.organization.rooms).toEqual([
      { label: 'Salle 1', details: 'Mathématiques / NSI / SNT' },
      { label: 'Salle 2', details: 'Français puis Physique-Chimie' },
    ]);
    expect(JSON.stringify(dto.organization)).not.toMatch(
      /MATHS_NSI_SNT_TEACHER|FRENCH_TEACHER|PHYSICS_CHEMISTRY_TEACHER|teacherRole|roomRole/,
    );
    expect(dto).not.toHaveProperty('teacherRoles');
    expect(dto).not.toHaveProperty('roomRoles');
  });

  it('uses the canonical pedagogical address in the landing DTO', () => {
    const { venue } = getPreRentreeLandingDTO().campaign;

    expect(venue).toEqual({
      name: `${LEGAL.entity.tradeName} — ${LEGAL.addresses.pedagogique.neighborhood}`,
      neighborhood: LEGAL.addresses.pedagogique.neighborhood,
      city: LEGAL.addresses.pedagogique.city,
    });
  });

  it('exposes normalized academic profiles without a Seconde EDS', () => {
    const { academicProfiles } = getPreRentreeLandingDTO();

    expect(academicProfiles.SECONDE).toEqual({});
    expect(academicProfiles.PREMIERE.voies).toHaveLength(2);
    expect(academicProfiles.PREMIERE.mathsProfiles).toHaveLength(2);
    expect(academicProfiles.PREMIERE.eafProfiles).toHaveLength(2);
    expect(academicProfiles.PREMIERE.specialtyPlans).toHaveLength(4);
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

  it('distinguishes Première EAF exercises without promising both tracks at once', () => {
    const eaf = getPreRentreeLandingDTO().modules.find(
      (campaignModule) => campaignModule.id === 'premiere-francais-eaf',
    );
    const trackSession = eaf?.sessions[1];

    expect(trackSession?.title).toContain('selon la voie');
    expect(trackSession?.deliverable).toMatch(/ ou /i);
    expect(eaf?.differentiation).toMatch(/validation pédagogique/i);
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
