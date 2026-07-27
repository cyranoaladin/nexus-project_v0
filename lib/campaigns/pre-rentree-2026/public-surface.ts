import 'server-only';

import modulesData from '@/content/pre-rentree-2026/modules.json';
import { compileCommercialPublicationContract } from './commercial-contract';
import { getPreRentreeCampaign } from './campaign-source';
import { getWhatsAppDisplayNumber } from '@/lib/whatsapp';
import { LEGAL } from '@/lib/legal';
import { getPreRentreeReleaseGate } from './release-gate';
import { PreRentreeModulesSchema } from './schema';
import { PRE_RENTREE_DOCUMENTS } from './documents';
import {
  PRE_RENTREE_PUBLIC_METRICS,
  type PublicPlanningPack,
  type PublicScheduleSlot,
  type PublicScheduleSubject,
  type PublicScheduleWindow,
} from './public-schedule';

const SUBJECT_LABELS = {
  MATHEMATIQUES: 'Mathématiques',
  PHYSIQUE_CHIMIE: 'Physique-Chimie',
  NSI: 'NSI',
  FRANCAIS: 'Français',
  SVT: 'SVT',
  MATHS_EXPERTES: 'Mathématiques expertes',
} as const;

const LEVEL_LABELS = {
  TROISIEME: 'Entrée en 3e',
  SECONDE: 'Entrée en Seconde',
  PREMIERE: 'Entrée en Première',
  TERMINALE: 'Entrée en Terminale',
} as const;

type LevelId = keyof typeof LEVEL_LABELS;
type SubjectId = keyof typeof SUBJECT_LABELS;

function formatAmount(value: number): string {
  return `${value.toLocaleString('fr-TN')} TND`;
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right)) as T[];
}

/**
 * Resolve the public label of a subject for a given level. Uses the campaign's
 * per-level label when present (e.g. Seconde NSI is branded "Initiation
 * informatique, algorithmique et SNT", distinct from the NSI specialty of
 * Première/Terminale), falling back to the generic subject label otherwise.
 */
function subjectLabelFor(campaign: ReturnType<typeof getPreRentreeCampaign>, level: LevelId, subject: SubjectId): string {
  const campaignSubject = campaign.subjects.find((entry) => entry.id === subject) as
    | { labelByLevel?: Partial<Record<LevelId, string>> }
    | undefined;
  return campaignSubject?.labelByLevel?.[level] ?? SUBJECT_LABELS[subject];
}

/**
 * Single fail-closed adapter for every public Pré-rentrée surface.
 * It deliberately exposes only approved offers and approved proof references.
 */
export function compilePreRentreeReviewSurfaceDTO() {
  const campaign = getPreRentreeCampaign();
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
      levelLabel: LEVEL_LABELS[offer.level],
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
    (Object.keys(LEVEL_LABELS) as LevelId[]).map((level) => [
      level,
      uniqueSorted(
        offers
          .filter((offer) => offer.level === level)
          .flatMap((offer) => offer.subjects),
      ),
    ]),
  ) as Record<LevelId, SubjectId[]>;

  const levels = (Object.keys(LEVEL_LABELS) as LevelId[]).map((level) => ({
    id: level,
    label: LEVEL_LABELS[level],
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
  const foundationExamples = offers.filter((offer) => offer.pricingKind === 'FOUNDATIONS');
  const premiumExamples = offers.filter((offer) => offer.pricingKind === 'PREMIUM_PACK');
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
  const offerOptionsByKey = new Map<string, PublicPlanningPack>();
  for (const offer of offers) {
    const key = `${offer.level}:${offer.subjectCount}`;
    if (offerOptionsByKey.has(key)) continue;
    offerOptionsByKey.set(key, {
      level: offer.level,
      subjectsCount: offer.subjectCount,
      totalHours: offer.hours,
      price: offer.price,
    });
  }
  // Fondations levels are billed per subject (pricingKind FOUNDATIONS): the
  // commercial contract only ever declares ONE offer per level (subjectCount
  // defaults to 1), never a distinct entry per selected-subject-count like
  // Premium packs do. Without this, selecting 2+ subjects at a Fondations
  // level found no matching offerOptions entry and silently showed "Volume
  // 0 h" — this synthesizes the missing counts by multiplying the per-subject
  // unit price/hours, never a flat/discounted rate.
  for (const level of levels) {
    const unitOffer = offers.find((offer) => offer.level === level.id && offer.pricingKind === 'FOUNDATIONS');
    if (!unitOffer) continue;
    const levelSubjectCount = subjectIdsByLevel[level.id].length;
    for (let count = 2; count <= Math.min(levelSubjectCount, 4); count += 1) {
      const key = `${level.id}:${count}`;
      if (offerOptionsByKey.has(key)) continue;
      offerOptionsByKey.set(key, {
        level: level.id,
        subjectsCount: count,
        totalHours: unitOffer.hours * count,
        price: unitOffer.price * count,
      });
    }
  }

  return {
    schemaVersion: '1.0.0',
    version: '2026-public-surface-v1',
    campaignId: campaign.campaignId,
    canonicalPath: campaign.canonicalPath,
    title: 'Préparez la rentrée avec des bases solides',
    promise: 'Des stages intensifs en petits groupes pour reprendre les notions essentielles, retrouver une méthode de travail efficace et démarrer l’année avec confiance.',
    startDate: campaign.startDate,
    startLabel: `Dès le ${firstDate}`,
    venue: campaign.venue.name,
    venueNeighborhood: campaign.venue.neighborhood,
    audience: 'Élèves du système français en Tunisie et candidats libres, selon les offres disponibles.',
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
      capacityByOffer: {
        FONDATIONS: { ...campaign.capacityByOffer.FONDATIONS },
        PREMIUM: { ...campaign.capacityByOffer.PREMIUM },
      },
      offerOptions: [...offerOptionsByKey.values()],
    },
    programs: publicModules,
    documents: PRE_RENTREE_DOCUMENTS.map((document) => ({ ...document })),
    method: [
      'Faire un point rapide sur les acquis',
      'Reprendre les notions essentielles',
      'S’entraîner avec des exercices progressifs',
      'Comprendre les corrections et les méthodes',
      'Repartir avec des repères clairs pour la rentrée',
    ],
    reservation: {
      enabled: false,
      depositPercentage: 30,
      rule: 'La demande en ligne n’engage aucun paiement.',
      explanation: 'Indiquez la classe de rentrée et les matières souhaitées. Notre équipe vous confirme les créneaux disponibles et vous guide vers la formule adaptée.',
    },
    contact: {
      whatsappDisplay: getWhatsAppDisplayNumber(),
      whatsappMessage: 'Bonjour, je souhaite des informations sur les stages de pré-rentrée 2026.',
      phoneDisplay: LEGAL.contact.phone,
      phoneHref: `tel:${LEGAL.contact.phoneRaw}`,
    },
    publication: {
      sourceStatus: campaign.status,
      indexable: campaign.status !== 'DRAFT',
    },
    seo: {
      title: 'Stages de pré-rentrée 2026 à Mutuelleville | Nexus Réussite',
      description: `Dès le ${firstDate} : stages par matière pour les élèves entrant en 3e, Seconde, Première ou Terminale. Effectifs et tarifs affichés offre par offre.`,
      canonical: campaign.canonicalPath,
      image: '/images/logo_slogan_nexus.webp',
    },
    faq: [
      {
        question: 'À qui s’adressent les stages de pré-rentrée 2026 ?',
        answer: 'Les offres s’adressent aux élèves du système français en Tunisie et aux candidats libres, selon le niveau et les matières proposées.',
      },
      {
        question: 'Quand et où commence la pré-rentrée Nexus ?',
        answer: `Les stages commencent à partir du ${firstDate} dans les locaux de Nexus Réussite à Mutuelleville. Le créneau précis est communiqué lors de la qualification de la demande.`,
      },
      {
        question: 'Quelles matières sont proposées pour une entrée en Seconde ?',
        answer: `Les matières proposées pour une entrée en Seconde sont ${subjectIdsByLevel.SECONDE.map((subject) => subjectLabelFor(campaign, 'SECONDE', subject)).join(', ')}.`,
      },
      {
        question: 'Que comprennent les dix heures par matière ?',
        answer: 'Chaque matière comprend cinq séances structurées de deux heures, avec un objectif clair à chaque séance, de l’entraînement et de la correction, ainsi que les consignes et exercices utilisés pendant le stage.',
      },
      {
        question: 'Quels sont les effectifs des groupes ?',
        answer: `Les offres Fondations accueillent de ${Math.min(...foundationExamples.map((offer) => offer.groupMin))} à ${Math.max(...foundationExamples.map((offer) => offer.groupMax))} élèves. Les offres Premium accueillent de ${Math.min(...premiumExamples.map((offer) => offer.groupMin))} à ${Math.max(...premiumExamples.map((offer) => offer.groupMax))} élèves. La capacité exacte figure sur chaque offre.`,
      },
      {
        question: 'Puis-je réserver ou payer depuis le site ?',
        answer: 'Non. Le site permet uniquement de demander une information. Les montants d’acompte et de solde correspondent à la grille tarifaire, mais aucune réservation ni collecte de paiement n’est activée en ligne : notre équipe vous recontacte pour finaliser l’inscription.',
      },
      {
        question: 'Comment connaître le tarif exact du parcours ?',
        answer: `Les tarifs sont affichés offre par offre. À titre de repère, les offres publiées vont de ${formatAmount(Math.min(...offers.map((offer) => offer.price)))} à ${formatAmount(Math.max(...offers.map((offer) => offer.price)))} selon le niveau et le nombre de matières.`,
      },
    ],
  } as const;
}

export type PreRentreePublicSurfaceDTO = ReturnType<typeof compilePreRentreeReviewSurfaceDTO>;

export function getPreRentreePublicSurfaceDTO(): PreRentreePublicSurfaceDTO | null {
  if (!getPreRentreeReleaseGate().isPublicReady) return null;
  return compilePreRentreeReviewSurfaceDTO();
}
