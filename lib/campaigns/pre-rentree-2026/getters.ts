import 'server-only';

import modulesData from '@/content/pre-rentree-2026/modules.json';
import offersData from '@/content/pre-rentree-2026/offers.json';
import { getPreRentreeFoundationsProducts, getPreRentreePacks } from '@/lib/pricing';
import {
  PreRentreeModulesSchema,
} from './schema';
import type { EntryLevelCode } from './schema';
import type { PreRentreeHomepageSpotlightDTO } from './homepage-spotlight';
import type { LandingPack, LandingSubject } from './configurator';
import {
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

export { getPreRentreeCampaign } from './campaign-source';

/** Get the 14 pedagogical modules with their 70 session templates. */
export function getPreRentreeModules() {
  return PreRentreeModulesSchema.parse(modulesData).modules;
}

/**
 * Campaign subjects enriched with a per-level pedagogical summary and module
 * id (LandingSubject contract — consumed by lib/campaigns/pre-rentree-2026/
 * configurator.ts and the StageConfigurator component).
 */
export function getPreRentreeEnrichedSubjects(): LandingSubject[] {
  const campaign = getPreRentreeCampaign();
  const modules = getPreRentreeModules();
  return campaign.subjects.map((subject) => {
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
}

/**
 * Get the schedule expanded to 100 scheduled occurrences across 20 operational
 * cohorts and 3 windows. Each cohort represents five occurrences of one
 * pedagogical module; an alternative cohort does not double the pupil volume.
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
