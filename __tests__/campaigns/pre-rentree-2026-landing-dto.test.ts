import { getPreRentreePacks } from '@/lib/pricing';
import { LEGAL } from '@/lib/legal';
import {
  getPreRentreeCampaign,
  getPreRentreeModules,
  getPreRentreePackOptions,
} from '@/lib/campaigns/pre-rentree-2026/getters';
import { formatCampaignStatus } from '@/lib/campaigns/pre-rentree-2026/presentation';

describe('Pré-rentrée 2026 campaign source', () => {
  it('resolves only the pack ids declared by the campaign through pricing', () => {
    const campaign = getPreRentreeCampaign();
    const packs = getPreRentreePacks(campaign.packProductIds);

    expect(packs.map((pack) => pack.id)).toEqual(campaign.packProductIds);
    expect(packs).toHaveLength(4);
  });

  it('exposes complete serializable campaign content', () => {
    const campaign = getPreRentreeCampaign();

    expect(campaign.content.hero.h1).toBe(
      'Deux semaines pour préparer sérieusement la rentrée',
    );
    expect(campaign.content.method).toHaveLength(4);
    expect(campaign.content.faq).toHaveLength(24);
    expect(campaign.content.faq.filter((entry) => entry.published)).toHaveLength(7);
    expect(campaign.content.practical.preRegistrationNotice).toContain('ne réserve pas une place');
    expect(campaign.content.practical.preRegistrationNotice).toContain('ne forme pas un contrat');
    expect(campaign.seo.canonical).toBe('/stages/pre-rentree-2026');
    expect(campaign.capacityByOffer).toEqual({
      FONDATIONS: { minPerCohort: 3, maxPerCohort: 6 },
      PREMIUM: { minPerCohort: 3, maxPerCohort: 5 },
    });
    expect(campaign.blocks).toHaveLength(4);
    expect(campaign.content.hero.subtitle).toContain(
      'Nexus Fondations en 3e et Seconde',
    );
    expect(campaign.content.hero.subtitle).not.toMatch(/NSI en Seconde|EDS NSI/i);
    const packOptions = getPreRentreePackOptions();
    expect(packOptions.map((pack) => pack.code)).toEqual(['PACK_1', 'PACK_2', 'PACK_3', 'PACK_4']);
    expect(JSON.stringify(packOptions)).not.toContain('pre2026-pack-');
    expect(formatCampaignStatus(campaign.status)).toBe('Informations disponibles');
    expect(campaign.schedule).toHaveLength(3);
    // 14 modules -> 17 slots since SCHEDULE-S5 adds an alternative cohort each
    // for Première SVT, Terminale NSI and Terminale SVT (see SCHEDULE-S5-DECISION.md).
    expect(campaign.schedule.flatMap((window) => window.slots)).toHaveLength(17);
    // Rooms are banalized/interchangeable (no subject compatibility table) —
    // just 3 permanent room identifiers (the rendered room labels themselves
    // are covered by the live ScheduleSection tests).
    expect(campaign.rooms).toEqual(['salle-1', 'salle-2', 'salle-3']);
  });

  it('uses the canonical pedagogical address in the campaign source', () => {
    const { venue } = getPreRentreeCampaign();

    expect(venue).toEqual({
      name: `${LEGAL.entity.tradeName} — ${LEGAL.addresses.pedagogique.neighborhood}`,
      neighborhood: LEGAL.addresses.pedagogique.neighborhood,
      city: LEGAL.addresses.pedagogique.city,
    });
  });

  it('exposes normalized academic profiles without a Seconde EDS', () => {
    const { academicProfiles } = getPreRentreeCampaign();

    expect(academicProfiles.SECONDE).toEqual({});
    expect(academicProfiles.PREMIERE.voies).toHaveLength(2);
    expect(academicProfiles.PREMIERE.mathsProfiles).toHaveLength(2);
    expect(academicProfiles.PREMIERE.eafProfiles).toHaveLength(2);
    // 8 plans: every combination of {NSI, Physique-Chimie, SVT} declared or not
    // (2^3), since all 3 are commercialized Première subjects (offers.json).
    expect(academicProfiles.PREMIERE.specialtyPlans).toHaveLength(8);
    expect(academicProfiles.TERMINALE.retainedSpecialties.maxSelections).toBe(2);
    expect(academicProfiles.TERMINALE.mathsOptions).toHaveLength(3);
    expect(JSON.stringify(academicProfiles.SECONDE)).not.toMatch(/EDS.*NSI|NSI.*EDS/i);
  });

  it('keeps all pedagogical fields for every module session', () => {
    const modules = getPreRentreeModules();

    expect(modules).toHaveLength(14);
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
    const eaf = getPreRentreeModules().find(
      (campaignModule) => campaignModule.id === 'premiere-francais-eaf',
    );
    const trackSession = eaf?.sessions[1];

    expect(trackSession?.title).toContain('selon la voie');
    expect(trackSession?.deliverable).toMatch(/ ou /i);
    expect(eaf?.differentiation).toMatch(/validation pédagogique/i);
  });

  it('derives a pedagogical summary for every level-specific subject card', () => {
    const campaign = getPreRentreeCampaign();
    const modules = getPreRentreeModules();

    for (const subject of campaign.subjects) {
      for (const level of subject.levels) {
        const campaignModule = modules.find(
          (candidate) => candidate.level === level && candidate.subjectId === subject.id,
        );
        expect(campaignModule).toBeDefined();
        expect(campaignModule?.subtitle.length).toBeGreaterThan(20);
      }
    }
  });
});
