import 'server-only';

import campaignManifest from '@/data/campaigns/pre-rentree-2026.json';
import modulesData from '@/content/pre-rentree-2026/modules.json';
import { getPreRentreePacks, getRules } from '@/lib/pricing';
import { LEGAL } from '@/lib/legal';
import {
  PreRentreeCampaignManifestSchema,
  PreRentreeModulesSchema,
} from './schema';
import type { EntryLevelCode, PreRentreeCampaignManifest } from './schema';
import type { PreRentreeHomepageSpotlightDTO } from './homepage-spotlight';
import type { LandingPack } from './configurator';
import {
  formatCampaignDateCartouche,
  formatCampaignStatus,
  formatEntryClassList,
} from './presentation';

/**
 * Get the validated campaign manifest.
 * Server-only — never import from client components.
 */
export function getPreRentreeCampaign(): PreRentreeCampaignManifest {
  return PreRentreeCampaignManifestSchema.parse(campaignManifest);
}

/**
 * Get the 12 module programs with their 60 sessions.
 */
export function getPreRentreeModules() {
  return PreRentreeModulesSchema.parse(modulesData).modules;
}

/**
 * Get the schedule expanded to all 60 individual sessions.
 */
export function getPreRentreeSchedule() {
  const campaign = getPreRentreeCampaign();
  const sessions: Array<{
    date: string;
    level: EntryLevelCode;
    subject: string;
    block: string;
    startTime: string;
    endTime: string;
    room: string;
    week: number;
    sessionNumber: number;
  }> = [];

  for (const weekSchedule of campaign.schedule) {
    const weekStart = new Date(weekSchedule.weekStart);
    for (let day = 0; day < 5; day++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + day);
      const dateStr = date.toISOString().split('T')[0];

      if (campaign.noClassDates.includes(dateStr)) continue;

      for (const slot of weekSchedule.slots) {
        const block = campaign.blocks.find((candidate) => candidate.id === slot.block);
        if (!block) {
          throw new Error(`Unknown campaign block: ${slot.block}`);
        }
        sessions.push({
          date: dateStr,
          level: slot.level,
          subject: slot.subject,
          block: slot.block,
          startTime: block.startTime,
          endTime: block.endTime,
          room: slot.room,
          week: weekSchedule.week,
          sessionNumber: sessions.filter(
            s => s.level === slot.level && s.subject === slot.subject
          ).length + 1,
        });
      }
    }
  }

  return sessions;
}

/**
 * Get pack options with pricing resolved from canonical source.
 * Prices come from pricing.canonical.json via product IDs.
 */
export function getPreRentreePackOptions() {
  const campaign = getPreRentreeCampaign();
  const packs = getPreRentreePacks(campaign.packProductIds);

  return packs.map((pack) => ({
    code: `PACK_${pack.subjects_count}` as LandingPack['code'],
    subjectsCount: pack.subjects_count,
    totalHours: pack.total_hours,
    price: pack.price_per_student,
    deposit: pack.payment.deposit,
    balance: pack.payment.solde,
    pricePerHour: pack.price_per_student_hour,
    groupMinOpen: pack.group_min_open,
    groupMax: pack.group_max,
  }));
}

/**
 * Get the full landing page DTO.
 * Combines manifest + modules + pricing into a single server-rendered payload.
 */
export function getPreRentreeLandingDTO() {
  const campaign = getPreRentreeCampaign();
  const modules = getPreRentreeModules();
  const schedule = getPreRentreeSchedule();
  const packs = getPreRentreePackOptions();
  const pricingRules = getRules();
  const subjects = campaign.subjects.map((subject) => ({
    ...subject,
    summaryByLevel: Object.fromEntries(subject.levels.map((level) => {
      const campaignModule = modules.find(
        (module) => module.level === level && module.subjectId === subject.id,
      );
      if (!campaignModule) {
        throw new Error(`Missing campaign module for ${level}/${subject.id}`);
      }
      return [level, campaignModule.subtitle];
    })),
  }));
  const educatorKeys = Object.keys(campaign.teacherRoles);
  const expectedEducatorKeys = [
    'MATHS_NSI_SNT_TEACHER',
    'FRENCH_TEACHER',
    'PHYSICS_CHEMISTRY_TEACHER',
  ];
  if (JSON.stringify(educatorKeys) !== JSON.stringify(expectedEducatorKeys)) {
    throw new Error('Unexpected Pré-rentrée staffing contract');
  }
  if (
    !campaign.roomRoles['salle-1']?.includes('MATHEMATIQUES') ||
    !campaign.roomRoles['salle-1']?.includes('NSI') ||
    !campaign.roomRoles['salle-2']?.includes('FRANCAIS') ||
    !campaign.roomRoles['salle-2']?.includes('PHYSIQUE_CHIMIE')
  ) {
    throw new Error('Unexpected Pré-rentrée room contract');
  }
  const organization = {
    educators: [
      {
        title: 'Enseignant Mathématiques / NSI / SNT',
        details: [
          'Semaine 1 : Mathématiques',
          'Semaine 2 : SNT et NSI',
          'Six créneaux de module au total · aucune simultanéité',
        ],
      },
      {
        title: 'Enseignant de Français',
        details: [
          'Semaine 1',
          'Français Seconde · EAF Première · expression et oral Terminale',
        ],
      },
      {
        title: 'Enseignant de Physique-Chimie',
        details: [
          'Semaine 2',
          'Entrée en Seconde · Entrée en Première · Entrée en Terminale',
        ],
      },
    ],
    rooms: [
      { label: 'Salle 1', details: 'Mathématiques / NSI / SNT' },
      { label: 'Salle 2', details: 'Français puis Physique-Chimie' },
    ],
  };

  return {
    campaign: {
      id: campaign.campaignId,
      version: campaign.version,
      entryLevelSemantics: campaign.entryLevelSemantics,
      canonicalPath: campaign.canonicalPath,
      timezone: campaign.timezone,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      noClassDates: campaign.noClassDates,
      decisionDeadline: campaign.decisionDeadline,
      venue: {
        name: `${LEGAL.entity.tradeName} — ${LEGAL.addresses.pedagogique.neighborhood}`,
        neighborhood: LEGAL.addresses.pedagogique.neighborhood,
        city: LEGAL.addresses.pedagogique.city,
      },
    },
    levels: campaign.levels,
    subjects,
    blocks: campaign.blocks,
    scheduleWeeks: campaign.schedule,
    organization,
    capacity: campaign.capacity,
    academicProfiles: campaign.academicProfiles,
    packs,
    pricingRules: {
      depositPercentage: pricingRules.payment.deposit_pct_stage,
    },
    schedule,
    modules,
    content: campaign.content,
    seo: campaign.seo,
    cta: campaign.cta,
    contact: campaign.contact,
    featureFlags: campaign.featureFlags,
    legalRefs: campaign.legalRefs,
    publicStatus: formatCampaignStatus(campaign.status),
  };
}

export function getPreRentreeHomepageSpotlightDTO(): PreRentreeHomepageSpotlightDTO {
  const dto = getPreRentreeLandingDTO();
  const date = formatCampaignDateCartouche(dto.campaign.startDate, dto.campaign.endDate);
  const singleSubjectPack = dto.packs.find((pack) => pack.subjectsCount === 1);
  if (!singleSubjectPack) {
    throw new Error('Missing single-subject Pré-rentrée pack');
  }
  const subjectOrder = ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'FRANCAIS', 'NSI'];
  const subjectFamilies = subjectOrder.map((subjectId) => {
    const subject = dto.subjects.find((candidate) => candidate.id === subjectId);
    if (!subject) throw new Error(`Missing Pré-rentrée subject: ${subjectId}`);
    return subject.id === 'NSI' ? `${subject.label}/SNT` : subject.label;
  });

  return {
    campaignId: dto.campaign.id,
    ariaLabel: `Campagne Pré-rentrée ${date.year}`,
    title: `Stages de pré-rentrée ${date.year}`,
    primaryCtaLabel: `Découvrir la Pré-rentrée ${date.year}`,
    publicStatus: dto.publicStatus,
    date,
    entryClassesLabel: formatEntryClassList(dto.levels.map((level) => level.label)),
    subjectFamiliesLabel: subjectFamilies.join(' · '),
    capacityLabel: `${dto.capacity.minPerCohort} à ${dto.capacity.maxPerCohort} élèves`,
    volumeLabel: `${singleSubjectPack.totalHours} h par matière`,
    venueLabel: dto.campaign.venue.neighborhood,
    editorialLine: dto.content.hero.h1,
    campaignPath: dto.campaign.canonicalPath,
    planningPath: `${dto.campaign.canonicalPath}#planning`,
  };
}
