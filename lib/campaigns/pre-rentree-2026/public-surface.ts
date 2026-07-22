import 'server-only';

import { compileCommercialPublicationContract } from './commercial-contract';
import { getPreRentreeCampaign } from './campaign-source';
import { getWhatsAppDisplayNumber } from '@/lib/whatsapp';

const SUBJECT_LABELS = {
  MATHEMATIQUES: 'Mathématiques',
  PHYSIQUE_CHIMIE: 'Physique-Chimie',
  NSI: 'NSI',
  FRANCAIS: 'Français',
  PHILOSOPHIE: 'Philosophie',
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
 * Single fail-closed adapter for every public Pré-rentrée surface.
 * It deliberately exposes only approved offers and approved proof references.
 */
export function getPreRentreePublicSurfaceDTO() {
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
      subjectLabels: offer.subjects.map((subject) => SUBJECT_LABELS[subject]),
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
      label: SUBJECT_LABELS[subject],
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

  return {
    schemaVersion: '1.0.0',
    version: '2026-public-surface-v1',
    campaignId: campaign.campaignId,
    canonicalPath: campaign.canonicalPath,
    title: 'Stages de pré-rentrée 2026',
    promise: 'Reprendre les fondamentaux. Structurer sa méthode. Aborder la rentrée avec confiance.',
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
    method: [
      'Un groupe dont la capacité est annoncée pour chaque offre',
      'Cinq séances structurées par matière',
      'Des objectifs annoncés',
      'De l’entraînement et de la correction en séance',
      'Des consignes et exercices utilisés pendant les séances',
    ],
    reservation: {
      depositPercentage: 30,
      rule: 'Une demande sans acompte ne réserve pas la place.',
      explanation: 'Après qualification du niveau et de la matière, le versement de l’acompte exact confirme la réservation. Le solde correspond au montant restant affiché pour l’offre.',
    },
    contact: {
      whatsappDisplay: getWhatsAppDisplayNumber(),
      whatsappMessage: 'Bonjour, je souhaite des informations sur les stages de pré-rentrée 2026.',
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
        answer: 'Les offres s’adressent aux élèves du système français en Tunisie et aux candidats libres, selon le niveau et les matières réellement disponibles dans le référentiel commercial.',
      },
      {
        question: 'Quand et où commence la pré-rentrée Nexus ?',
        answer: `Les stages commencent à partir du ${firstDate} dans les locaux de Nexus Réussite à Mutuelleville. Le créneau précis est communiqué lors de la qualification de la demande.`,
      },
      {
        question: 'Quelles matières sont proposées pour une entrée en Seconde ?',
        answer: `Les matières publiées pour une entrée en Seconde sont ${subjectIdsByLevel.SECONDE.map((subject) => SUBJECT_LABELS[subject]).join(', ')}. La sélection est contrôlée par le référentiel de l’offre avant affichage.`,
      },
      {
        question: 'Que comprennent les dix heures par matière ?',
        answer: 'Chaque matière comprend cinq séances structurées de deux heures, avec objectifs annoncés, entraînement et correction en séance, ainsi que les consignes et exercices utilisés pendant le stage.',
      },
      {
        question: 'Quels sont les effectifs des groupes ?',
        answer: `Les offres Fondations accueillent de ${Math.min(...foundationExamples.map((offer) => offer.groupMin))} à ${Math.max(...foundationExamples.map((offer) => offer.groupMax))} élèves. Les offres Premium accueillent de ${Math.min(...premiumExamples.map((offer) => offer.groupMin))} à ${Math.max(...premiumExamples.map((offer) => offer.groupMax))} élèves. La capacité exacte figure sur chaque offre.`,
      },
      {
        question: 'Comment fonctionne l’acompte de réservation ?',
        answer: 'L’acompte représente exactement 30 % du tarif affiché. Une demande sans acompte ne réserve pas la place ; la réservation est confirmée après qualification et réception de cet acompte.',
      },
      {
        question: 'Comment connaître le tarif exact du parcours ?',
        answer: `Les tarifs sont affichés offre par offre et proviennent du référentiel tarifaire canonique. À titre de repère, les offres publiées vont de ${formatAmount(Math.min(...offers.map((offer) => offer.price)))} à ${formatAmount(Math.max(...offers.map((offer) => offer.price)))} selon le niveau et le nombre de matières.`,
      },
    ],
  } as const;
}

export type PreRentreePublicSurfaceDTO = ReturnType<typeof getPreRentreePublicSurfaceDTO>;
