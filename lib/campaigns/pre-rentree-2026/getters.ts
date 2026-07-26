import 'server-only';

import modulesData from '@/content/pre-rentree-2026/modules.json';
import offersData from '@/content/pre-rentree-2026/offers.json';
import capabilitiesData from '@/content/pre-rentree-2026/capabilities.json';
import manualsData from '@/content/pre-rentree-2026/manuals.registry.json';
import { getPreRentreeFoundationsProducts, getPreRentreePacks, getRules } from '@/lib/pricing';
import { LEGAL } from '@/lib/legal';
import {
  PreRentreeModulesSchema,
} from './schema';
import type { EntryLevelCode } from './schema';
import type { PreRentreeHomepageSpotlightDTO } from './homepage-spotlight';
import type { LandingPack } from './configurator';
import {
  PreRentreeCapabilitiesSchema,
  PreRentreeManualsRegistrySchema,
  PreRentreeOffersSchema,
} from './content-schema';
import {
  formatCampaignStatus,
  formatEntryClassList,
} from './presentation';
import { getPreRentreeCampaign } from './campaign-source';
import {
  compilePreRentreeReviewSurfaceDTO,
  getPreRentreePublicSurfaceDTO,
  type PreRentreePublicSurfaceDTO,
} from './public-surface';
import { computeSubjectIncompatibilities } from './incompatibilities';

export { getPreRentreeCampaign } from './campaign-source';

/**
 * Get the validated campaign manifest.
 * Server-only — never import from client components.
 */
/** Get the 17 module programs with their 85 sessions. */
export function getPreRentreeModules() {
  return PreRentreeModulesSchema.parse(modulesData).modules;
}

/**
 * Get the schedule expanded to all 70 individual sessions across the 3 windows
 * (fenêtre 1, week-end + début fenêtre 2, fenêtre 2). Each window carries an
 * explicit list of dates (`days`), which may include Saturday/Sunday.
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
    windowId: string;
    sessionNumber: number;
    cohortId?: string;
    alternativeGroupId?: string;
    isPrimary?: boolean;
  }> = [];

  for (const window of campaign.schedule) {
    for (const dateStr of window.days) {
      for (const slot of window.slots) {
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
          windowId: window.windowId,
          // A subject with multiple cohorts (cohortId set) gets its own 1-5
          // numbering per cohort, never mixed with another cohort's sessions —
          // otherwise a 2-cohort subject would wrongly look like 10 séances.
          sessionNumber: sessions.filter(
            (s) => s.level === slot.level && s.subject === slot.subject && s.cohortId === slot.cohortId
          ).length + 1,
          cohortId: slot.cohortId,
          alternativeGroupId: slot.alternativeGroupId,
          isPrimary: slot.isPrimary,
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

export function getPreRentreeOfferOptions(): LandingPack[] {
  const offers = PreRentreeOffersSchema.parse(offersData);
  const options: LandingPack[] = [];
  for (const offer of offers.levels) {
    if (offer.pricing.model === 'PER_SUBJECT') {
      const [unit] = getPreRentreeFoundationsProducts(offer.pricing.productIds);
      if (!unit || unit.level !== offer.level) {
        throw new Error(`Missing Fondations pricing product for ${offer.level}`);
      }
      for (let count = 1; count <= offer.pricing.maximumSubjects; count += 1) {
        options.push({
          code: `PACK_${count}` as LandingPack['code'],
          level: offer.level,
          range: offer.range,
          subjectsCount: count,
          totalHours: unit.hours_per_subject * count,
          price: unit.price_per_student * count,
          deposit: unit.payment.deposit * count,
          balance: unit.payment.solde * count,
          pricePerHour: unit.price_per_student_hour,
          groupMinOpen: unit.group_min_open,
          groupMax: unit.group_max,
        });
      }
      continue;
    }
    for (const pack of getPreRentreePacks(offer.pricing.productIds)) {
      options.push({
        code: `PACK_${pack.subjects_count}` as LandingPack['code'],
        level: offer.level,
        range: offer.range,
        subjectsCount: pack.subjects_count,
        totalHours: pack.total_hours,
        price: pack.price_per_student,
        deposit: pack.payment.deposit,
        balance: pack.payment.solde,
        pricePerHour: pack.price_per_student_hour,
        groupMinOpen: pack.group_min_open,
        groupMax: pack.group_max,
      });
    }
  }
  return options;
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
  const offerOptions = getPreRentreeOfferOptions();
  const offers = PreRentreeOffersSchema.parse(offersData);
  const capabilities = PreRentreeCapabilitiesSchema.parse(capabilitiesData);
  const manuals = PreRentreeManualsRegistrySchema.parse(manualsData);
  const pricingRules = getRules();
  const subjects = campaign.subjects.map((subject) => {
    const subjectModules = subject.levels.map((level) => {
      const campaignModule = modules.find(
        (module) => module.level === level && module.subjectId === subject.id,
      );
      if (!campaignModule) {
        throw new Error(`Missing campaign module for ${level}/${subject.id}`);
      }
      return [level, campaignModule] as const;
    });

    return {
      ...subject,
      summaryByLevel: Object.fromEntries(
        subjectModules.map(([level, campaignModule]) => [level, campaignModule.subtitle]),
      ),
      moduleIdsByLevel: Object.fromEntries(
        subjectModules.map(([level, campaignModule]) => [level, campaignModule.id]),
      ),
    };
  });
  if (
    !campaign.roomRoles['salle-1']?.includes('MATHEMATIQUES') ||
    !campaign.roomRoles['salle-1']?.includes('NSI') ||
    !campaign.roomRoles['salle-2']?.includes('FRANCAIS') ||
    !campaign.roomRoles['salle-2']?.includes('PHYSIQUE_CHIMIE') ||
    !campaign.roomRoles['salle-2']?.includes('SVT')
  ) {
    throw new Error('Unexpected Pré-rentrée room contract');
  }
  const subjectLabelById = new Map(campaign.subjects.map((subject) => [subject.id, subject.label]));
  const roomDetails = (room: 'salle-1' | 'salle-2'): string => {
    const labels = campaign.roomRoles[room]!.map((subjectId) => subjectLabelById.get(subjectId) ?? subjectId);
    return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} et ${labels.at(-1)}` : (labels[0] ?? '');
  };
  const organization = {
    educators: [],
    rooms: [
      { label: 'Salle 1', details: roomDetails('salle-1') },
      { label: 'Salle 2', details: roomDetails('salle-2') },
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
    scheduleWindows: campaign.schedule,
    organization,
    capacityByOffer: campaign.capacityByOffer,
    operationalGates: campaign.operationalGates,
    academicProfiles: campaign.academicProfiles,
    packs,
    offerOptions,
    offers: offers.levels,
    capabilities: capabilities.capabilities,
    manuals: manuals.manuals.map((manual) => ({
      ...manual,
      publiclyAdvertisable: manual.printReady && manual.ownerApproved && manual.stockReady,
    })),
    pricingRules: {
      depositPercentage: pricingRules.payment.deposit_pct_stage,
    },
    schedule,
    subjectIncompatibilities: computeSubjectIncompatibilities(schedule),
    modules,
    content: campaign.content,
    seo: campaign.seo,
    cta: campaign.cta,
    contact: campaign.contact,
    featureFlags: campaign.featureFlags,
    legalRefs: campaign.legalRefs,
    publicStatus: formatCampaignStatus(campaign.status),
    publicationMode: campaign.status === 'DRAFT' ? 'REVIEW' as const : 'RELEASE' as const,
  };
}

function buildPreRentreeHomepageSpotlightDTO(dto: PreRentreePublicSurfaceDTO): PreRentreeHomepageSpotlightDTO {
  const publicOffers = dto.offers;
  const campaign = getPreRentreeCampaign();
  const start = new Date(`${dto.startDate}T12:00:00+01:00`);
  const day = new Intl.DateTimeFormat('fr-TN', { day: 'numeric', timeZone: 'Africa/Tunis' }).format(start);
  const month = new Intl.DateTimeFormat('fr-TN', { month: 'long', timeZone: 'Africa/Tunis' }).format(start);
  const year = new Intl.DateTimeFormat('fr-TN', { year: 'numeric', timeZone: 'Africa/Tunis' }).format(start);
  const date = {
    days: day,
    month: month.toLocaleUpperCase('fr-TN'),
    year,
    accessibleLabel: `À partir du ${day} ${month} ${year}.`,
    chipLabel: `dès le ${day} ${month}`,
  };
  const subjectOrder = ['MATHEMATIQUES', 'PHYSIQUE_CHIMIE', 'FRANCAIS', 'NSI', 'SVT', 'MATHS_EXPERTES'];
  const availableSubjectIds = new Set<string>(publicOffers.flatMap((offer) => offer.subjects));
  const subjectFamilies = subjectOrder.filter((subjectId) => availableSubjectIds.has(subjectId)).map((subjectId) => {
    const subject = campaign.subjects.find((candidate) => candidate.id === subjectId);
    if (!subject) throw new Error(`Missing Pré-rentrée subject: ${subjectId}`);
    return subject.label;
  });
  const foundations = publicOffers.filter((offer) => offer.pricingKind === 'FOUNDATIONS');
  const premium = publicOffers.filter((offer) => offer.pricingKind === 'PREMIUM_PACK');

  return {
    campaignId: dto.campaignId,
    ariaLabel: `Campagne Pré-rentrée ${date.year}`,
    title: `Stages de pré-rentrée ${date.year}`,
    primaryCtaLabel: `Découvrir la Pré-rentrée ${date.year}`,
    publicStatus: formatCampaignStatus(dto.publication.sourceStatus),
    date,
    entryClassesLabel: formatEntryClassList(dto.levels.map((level) => level.label)),
    subjectFamiliesLabel: subjectFamilies.join(' · '),
    capacityLabel: `Fondations : ${Math.min(...foundations.map((offer) => offer.groupMin))} à ${Math.max(...foundations.map((offer) => offer.groupMax))} élèves · Premium : ${Math.min(...premium.map((offer) => offer.groupMin))} à ${Math.max(...premium.map((offer) => offer.groupMax))} élèves`,
    volumeLabel: `${Math.min(...publicOffers.map((offer) => offer.hours / (offer.subjectCount ?? 1)))} h par matière`,
    venueLabel: dto.venueNeighborhood,
    editorialLine: dto.promise,
    campaignPath: dto.canonicalPath,
    secondaryCtaLabel: 'Voir les offres',
    secondaryCtaPath: `${dto.canonicalPath}#offres-pre-rentree`,
  };
}

export function compilePreRentreeReviewHomepageSpotlightDTO(): PreRentreeHomepageSpotlightDTO {
  return buildPreRentreeHomepageSpotlightDTO(compilePreRentreeReviewSurfaceDTO());
}

export function getPreRentreeHomepageSpotlightDTO(): PreRentreeHomepageSpotlightDTO | null {
  const dto = getPreRentreePublicSurfaceDTO();
  return dto ? buildPreRentreeHomepageSpotlightDTO(dto) : null;
}
