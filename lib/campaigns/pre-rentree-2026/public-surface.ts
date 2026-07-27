import 'server-only';

import modulesData from '@/content/pre-rentree-2026/modules.json';
import { compileCommercialPublicationContract } from './commercial-contract';
import { getPreRentreeCampaign } from './campaign-source';
import { getWhatsAppDisplayNumber } from '@/lib/whatsapp';
import { LEGAL } from '@/lib/legal';
import { getPreRentreeReleaseGate } from './release-gate';
import offersData from '@/content/pre-rentree-2026/offers.json';
import { PreRentreeModulesSchema, type EntryLevelCode, type SubjectCode } from './schema';
import { PreRentreeOffersSchema } from './content-schema';
import { PRE_RENTREE_DOCUMENTS } from './documents';
import { getPreRentreeLevelCapacities, getPreRentreeOfferOptions } from './offer-options';
import { maxIdleMinutesAcrossPublishedItineraries } from './itinerary-facts';
import { buildCampaignTemplateVars, resolveCampaignTemplate } from './campaign-facts';
import {
  PRE_RENTREE_PUBLIC_METRICS,
  type PublicPlanningPack,
  type PublicScheduleSlot,
  type PublicScheduleSubject,
  type PublicScheduleWindow,
} from './public-schedule';

type LevelId = EntryLevelCode;
type SubjectId = SubjectCode;

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right)) as T[];
}

/**
 * Explicit publication order for the public FAQ section — campaign.content.faq
 * is not itself ordered for display (it interleaves the reserved/unpublished
 * entries with the live ones), so the order a parent actually sees is
 * declared here, once, and checked against the `published` flag (fail-closed:
 * a listed id that isn't published, or an id that doesn't exist, is a bug).
 */
const PUBLISHED_FAQ_ORDER = [
  'faq-public-cible',
  'faq-date-lieu',
  'faq-matieres-seconde',
  'faq-matieres-tarif-4e',
  'faq-contenu-dix-heures',
  'faq-effectifs-groupes',
  'faq-effectifs-stage-vs-annuel',
  'faq-philosophie-deux-fenetres',
  'faq-reservation-paiement',
  'faq-tarif-exact',
] as const;

/**
 * Resolve the public label of a subject for a given level. Uses the campaign's
 * per-level label when present (e.g. Seconde NSI is branded "Initiation
 * informatique, algorithmique et SNT", distinct from the NSI specialty of
 * Première/Terminale), falling back to the generic subject label otherwise.
 */
function subjectLabelFor(campaign: ReturnType<typeof getPreRentreeCampaign>, level: LevelId, subject: SubjectId): string {
  const campaignSubject = campaign.subjects.find((entry) => entry.id === subject) as
    | { label: string; labelByLevel?: Partial<Record<LevelId, string>> }
    | undefined;
  if (!campaignSubject) throw new Error(`Unknown campaign subject: ${subject}`);
  return campaignSubject.labelByLevel?.[level] ?? campaignSubject.label;
}

/**
 * Single fail-closed adapter for every public Pré-rentrée surface.
 * It deliberately exposes only approved offers and approved proof references.
 */
export function compilePreRentreeReviewSurfaceDTO() {
  const campaign = getPreRentreeCampaign();
  // Level ids and labels are the campaign's, in the campaign's own order —
  // never a map in this file. Adding a level to the data adds it everywhere.
  const levelIds = campaign.levels.map((level) => level.id);
  const levelLabelById = new Map(campaign.levels.map((level) => [level.id, level.label]));
  const levelLabel = (level: LevelId): string => {
    const label = levelLabelById.get(level);
    if (!label) throw new Error(`Unknown campaign level: ${level}`);
    return label;
  };
  const contract = compileCommercialPublicationContract();
  const approvedProofIds = contract.proofs.proofs
    .filter((proof) => proof.status === 'APPROVED')
    .map((proof) => proof.proofId);
  const approvedProofSet = new Set(approvedProofIds);
  const offers = contract.offers
    .filter((offer) => offer.publiclyEligible)
    .filter((offer) => offer.proofIds.every((proofId) => approvedProofSet.has(proofId)))
    .map((offer) => ({
      offerId: offer.offerId,
      pricingId: offer.pricingId,
      pricingKind: offer.pricingKind,
      level: offer.level,
      levelLabel: levelLabel(offer.level),
      subjects: offer.subjects,
      subjectLabels: offer.subjects.map((subject) => subjectLabelFor(campaign, offer.level, subject)),
      subjectCount: offer.subjectCount ?? 1,
      audience: offer.audience,
      hours: offer.hours,
      sessions: offer.sessions,
      sessionDurationHours: offer.sessionDurationHours,
      groupMin: offer.groupMin,
      groupMax: offer.groupMax,
      price: offer.price,
      deposit: offer.deposit,
      balance: offer.balance,
      currency: offer.currency,
      objectives: offer.objectives,
      included: offer.included,
      optional: offer.optional,
      excluded: offer.excluded,
      supports: offer.supports,
      followUp: offer.followUp,
      cta: offer.cta,
      proofIds: offer.proofIds,
    }));

  const subjectIdsByLevel = Object.fromEntries(
    levelIds.map((level) => [
      level,
      uniqueSorted(
        offers
          .filter((offer) => offer.level === level)
          .flatMap((offer) => offer.subjects),
      ),
    ]),
  ) as Record<LevelId, SubjectId[]>;

  const levels = levelIds.map((level) => ({
    id: level,
    label: levelLabel(level),
    subjects: subjectIdsByLevel[level].map((subject) => ({
      id: subject,
      label: subjectLabelFor(campaign, level, subject),
    })),
  }));
  const firstDate = new Intl.DateTimeFormat('fr-TN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Tunis',
  }).format(new Date(`${campaign.startDate}T12:00:00+01:00`));
  const roomsPubliclyConfirmed = campaign.operationalGates.roomAssignmentsValidated;
  const blockById = new Map(campaign.blocks.map((block) => [block.id, block]));
  const schedule: PublicScheduleSlot[] = campaign.schedule.flatMap((window) => (
    window.days.flatMap((date) => window.slots.map((slot) => {
      const block = blockById.get(slot.block);
      if (!block) throw new Error(`Unknown public schedule block: ${slot.block}`);
      return {
        date,
        level: slot.level,
        subject: slot.subject,
        block: slot.block,
        startTime: block.startTime,
        endTime: block.endTime,
        windowId: window.windowId,
        ...(slot.cohortId ? { cohortId: `creneau-${slot.block.toLowerCase()}` } : {}),
        ...(slot.isPrimary !== undefined ? { isPrimary: slot.isPrimary } : {}),
        ...(roomsPubliclyConfirmed ? { room: slot.room } : {}),
      };
    }))
  ));
  const scheduleWindows: PublicScheduleWindow[] = campaign.schedule.map((window) => ({
    windowId: window.windowId,
    windowLabel: window.windowLabel,
    days: [...window.days],
    slots: window.slots.map((slot) => ({
      level: slot.level,
      subject: slot.subject,
      block: slot.block,
      ...(roomsPubliclyConfirmed ? { room: slot.room } : {}),
    })),
  }));
  const publicSubjects: PublicScheduleSubject[] = campaign.subjects.map((subject) => ({
    id: subject.id,
    label: subject.label,
    levels: [...subject.levels],
    ...(subject.labelByLevel ? { labelByLevel: { ...subject.labelByLevel } } : {}),
  }));
  const publicModules = PreRentreeModulesSchema.parse(modulesData).modules.map((campaignModule) => ({
    id: campaignModule.id,
    level: campaignModule.level,
    subjectId: campaignModule.subjectId,
    subject: campaignModule.subject,
    title: campaignModule.title,
    subtitle: campaignModule.subtitle,
    prerequisites: campaignModule.prerequisites,
    differentiation: campaignModule.differentiation,
    quickAssessment: campaignModule.quickAssessment,
    sessions: campaignModule.sessions.map((session) => ({
      number: session.number,
      title: session.title,
      objective: session.objective,
      topics: [...session.topics],
      method: session.method,
      deliverable: session.deliverable,
    })),
  }));
  // Every (level, subject-count) a family can order, priced from
  // pricing.canonical.json by offer-options.ts. Both pricing models produce
  // the same shape, so a Fondations level and a Premium level need no
  // per-level code anywhere downstream — which is what previously produced
  // the "Volume 0 h" bug (Fondations levels had no entry beyond one subject)
  // and is what lets the 4e work with no code of its own.
  const offerOptions: PublicPlanningPack[] = getPreRentreeOfferOptions()
    .filter((option) => option.subjectsCount <= (subjectIdsByLevel[option.level!]?.length ?? 0))
    .map((option) => ({
      level: option.level!,
      range: option.range!,
      subjectsCount: option.subjectsCount,
      totalHours: option.totalHours,
      price: option.price,
      deposit: option.deposit,
      balance: option.balance,
      pricingModel: option.range === 'FONDATIONS' ? 'PER_SUBJECT' as const : 'PACK_BY_SUBJECT_COUNT' as const,
    }));

  // Cohort size per level, read from the level's own offer — never inferred
  // from its range (the 4e opens at 4, the other Fondations levels at 3).
  const capacityByLevel = Object.fromEntries(
    getPreRentreeLevelCapacities()
      .filter((capacity) => levelIds.includes(capacity.level))
      .map((capacity) => [capacity.level, {
        range: capacity.range,
        minPerCohort: capacity.minPerCohort,
        maxPerCohort: capacity.maxPerCohort,
        maximumSubjects: capacity.maximumSubjects,
      }]),
  ) as Record<LevelId, { range: 'FONDATIONS' | 'PREMIUM'; minPerCohort: number; maxPerCohort: number; maximumSubjects: number }>;

  const maxIdleMinutes = maxIdleMinutesAcrossPublishedItineraries();
  const facts = buildCampaignTemplateVars();
  const publicPage = campaign.content.publicPage;
  const offersSource = PreRentreeOffersSchema.parse(offersData);

  return {
    schemaVersion: '1.0.0',
    version: '2026-public-surface-v1',
    campaignId: campaign.campaignId,
    canonicalPath: campaign.canonicalPath,
    title: publicPage.title,
    promise: publicPage.promise,
    startDate: campaign.startDate,
    startLabel: `Dès le ${firstDate}`,
    venue: campaign.venue.name,
    venueNeighborhood: campaign.venue.neighborhood,
    audience: resolveCampaignTemplate(publicPage.audience, facts),
    heroHighlights: publicPage.heroHighlights.map((highlight) => resolveCampaignTemplate(highlight, facts)),
    levels,
    subjectIdsByLevel,
    offers,
    approvedProofIds,
    publicCapabilities: [] as string[],
    publicManuals: [] as string[],
    planning: {
      metrics: PRE_RENTREE_PUBLIC_METRICS,
      roomsPubliclyConfirmed,
      blocks: campaign.blocks.map((block) => ({
        id: block.id,
        startTime: block.startTime,
        endTime: block.endTime,
      })),
      levels: campaign.levels.map((level) => ({ id: level.id, label: level.label })),
      subjects: publicSubjects,
      schedule,
      scheduleWindows,
      organization: {
        rooms: roomsPubliclyConfirmed
          ? [...new Set(campaign.schedule.flatMap((window) => window.slots.map((slot) => slot.room)))]
            .sort()
            .map((_room, index) => ({
              label: `Salle ${index + 1}`,
              details: 'Affectation publique confirmée pour ce stage',
            }))
          : [],
      },
      capacityByLevel,
      offerOptions,
      /**
       * The one waiting-time figure the campaign publishes, computed from the
       * real planning (itinerary-facts.ts) — the site used to show a
       * per-selection value here while the PDFs printed the policy ceiling.
       */
      maxIdleMinutes,
    },
    programs: publicModules,
    documents: PRE_RENTREE_DOCUMENTS.map((document) => ({ ...document })),
    method: campaign.content.method.map((step) => ({ ...step })),
    reservation: {
      enabled: false,
      depositPercentage: Math.round(offersSource.depositRate * 100),
      rule: campaign.content.practical.preRegistrationNotice,
    },
    contact: {
      whatsappDisplay: getWhatsAppDisplayNumber(),
      whatsappMessage: campaign.contact.whatsappMessage,
      phoneDisplay: LEGAL.contact.phone,
      phoneHref: `tel:${LEGAL.contact.phoneRaw}`,
    },
    publication: {
      sourceStatus: campaign.status,
      indexable: campaign.status !== 'DRAFT',
    },
    seo: {
      title: publicPage.seoTitle,
      description: resolveCampaignTemplate(publicPage.seoDescription, facts),
      canonical: campaign.canonicalPath,
      image: '/images/logo_slogan_nexus.webp',
    },
    faq: (() => {
      const byId = new Map(campaign.content.faq.map((entry) => [entry.id, entry]));
      const publishedIds = campaign.content.faq.filter((entry) => entry.published).map((entry) => entry.id);
      const missing = publishedIds.filter((id) => !(PUBLISHED_FAQ_ORDER as readonly string[]).includes(id));
      if (missing.length > 0) {
        throw new Error(`FAQ entries marked published but absent from PUBLISHED_FAQ_ORDER: ${missing.join(', ')}`);
      }
      return PUBLISHED_FAQ_ORDER.map((id) => {
        const entry = byId.get(id);
        if (!entry) throw new Error(`PUBLISHED_FAQ_ORDER references unknown FAQ id: ${id}`);
        if (!entry.published) throw new Error(`PUBLISHED_FAQ_ORDER references unpublished FAQ id: ${id}`);
        return {
          question: entry.question,
          answer: resolveCampaignTemplate(entry.answer, facts),
        };
      });
    })(),
  } as const;
}

export type PreRentreePublicSurfaceDTO = ReturnType<typeof compilePreRentreeReviewSurfaceDTO>;

export function getPreRentreePublicSurfaceDTO(): PreRentreePublicSurfaceDTO | null {
  if (!getPreRentreeReleaseGate().isPublicReady) return null;
  return compilePreRentreeReviewSurfaceDTO();
}
