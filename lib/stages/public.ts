import { Prisma, StageReservationStatus, StageType, Subject } from '@prisma/client';

import { prisma } from '@/lib/prisma';

type ReservationLike = {
  richStatus: StageReservationStatus | null;
  status: string;
};

const publicStageInclude = {
  reservations: {
    select: {
      richStatus: true,
      status: true,
    },
  },
  sessions: {
    orderBy: { startAt: 'asc' as const },
    include: {
      coach: {
        select: {
          pseudonym: true,
          title: true,
          description: true,
          subjects: true,
        },
      },
      documents: {
        where: { isPublic: true },
        select: {
          id: true,
          title: true,
          fileUrl: true,
          fileType: true,
        },
      },
    },
  },
  coaches: {
    include: {
      coach: {
        select: {
          id: true,
          pseudonym: true,
          title: true,
          tag: true,
          description: true,
          expertise: true,
          subjects: true,
        },
      },
    },
  },
  bilans: {
    select: {
      id: true,
      scoreGlobal: true,
      isPublished: true,
      pdfUrl: true,
      publishedAt: true,
      createdAt: true,
      student: {
        select: {
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      coach: {
        select: {
          pseudonym: true,
        },
      },
    },
  },
} satisfies Prisma.StageInclude;

type PublicStageRecord = Prisma.StageGetPayload<{
  include: typeof publicStageInclude;
}>;

export const stageTypeLabels: Record<StageType, string> = {
  INTENSIF: 'Intensif',
  SEMAINE_BLANCHE: 'Semaine blanche',
  BILAN: 'Bilan',
  GRAND_ORAL: 'Grand Oral',
  BAC_FRANCAIS: 'Bac Français',
};

export const subjectLabels: Record<Subject, string> = {
  MATHEMATIQUES: 'Maths',
  NSI: 'NSI',
  FRANCAIS: 'Français',
  PHILOSOPHIE: 'Philosophie',
  HISTOIRE_GEO: 'Histoire-Géo',
  ANGLAIS: 'Anglais',
  ESPAGNOL: 'Espagnol',
  PHYSIQUE_CHIMIE: 'Physique-Chimie',
  SVT: 'SVT',
  SES: 'SES',
};

export const levelLabels: Record<string, string> = {
  '3ème': '3ème',
  Première: 'Première',
  Terminale: 'Terminale',
  Autre: 'Autre',
};

export function getLevelLabel(level: string) {
  return levelLabels[level] ?? level;
}

function resolveReservationStatus(reservation: ReservationLike) {
  return reservation.richStatus ?? (reservation.status as StageReservationStatus) ?? 'PENDING';
}

export function countReservationStatuses(reservations: ReservationLike[]) {
  return reservations.reduce<Record<StageReservationStatus, number>>((acc, reservation) => {
    const status = resolveReservationStatus(reservation);
    acc[status] += 1;
    return acc;
  }, {
    PENDING: 0,
    CONFIRMED: 0,
    WAITLISTED: 0,
    CANCELLED: 0,
    COMPLETED: 0,
  });
}

export function isOnlineLocation(location?: string | null) {
  if (!location) return false;
  return /en ligne|online|visi[oô]|zoom|meet|teams/i.test(location);
}

export function formatStagePrice(amount: number, currency: string) {
  return `${amount.toLocaleString('fr-FR')} ${currency}`;
}

export function formatStageDateRange(startDate: string | Date, endDate: string | Date) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();

  if (sameMonth) {
    return `${start.toLocaleDateString('fr-FR', { day: 'numeric' })} – ${end.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}`;
  }

  return `${start.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  })} – ${end.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })}`;
}

export function formatStageDateTime(startAt: string | Date, endAt: string | Date) {
  const start = new Date(startAt);
  const end = new Date(endAt);

  return `${start.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })} · ${start.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })} – ${end.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function serializePublicStage(stage: PublicStageRecord) {
  const reservationCounts = countReservationStatuses(stage.reservations ?? []);
  const activeReservations = reservationCounts.PENDING + reservationCounts.CONFIRMED;
  const confirmedReservations = reservationCounts.CONFIRMED;
  const availablePlaces = Math.max(stage.capacity - activeReservations, 0);

  return {
    id: stage.id,
    slug: stage.slug,
    title: stage.title,
    subtitle: stage.subtitle,
    description: stage.description,
    type: stage.type,
    typeLabel: stageTypeLabels[stage.type],
    subject: stage.subject,
    level: stage.level,
    startDate: stage.startDate.toISOString(),
    endDate: stage.endDate.toISOString(),
    capacity: stage.capacity,
    priceAmount: Number(stage.priceAmount),
    priceCurrency: stage.priceCurrency,
    location: stage.location,
    isVisible: stage.isVisible,
    isOpen: stage.isOpen,
    reservationCounts,
    activeReservations,
    confirmedReservations,
    availablePlaces,
    _count: {
      reservations: activeReservations,
    },
    sessions: stage.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      subject: session.subject,
      startAt: session.startAt.toISOString(),
      endAt: session.endAt.toISOString(),
      location: session.location,
      description: session.description,
      coach: session.coach ? {
        pseudonym: session.coach.pseudonym,
        title: session.coach.title,
        description: session.coach.description,
        subjects: session.coach.subjects,
      } : null,
      documents: session.documents.map((document) => ({
        ...document,
      })),
    })),
    coaches: stage.coaches.map((assignment) => ({
      id: assignment.id,
      role: assignment.role,
      coach: {
        id: assignment.coach.id,
        pseudonym: assignment.coach.pseudonym,
        title: assignment.coach.title,
        tag: assignment.coach.tag,
        description: assignment.coach.description,
        expertise: assignment.coach.expertise,
        subjects: assignment.coach.subjects,
      },
    })),
    bilans: stage.bilans.map((bilan) => ({
      id: bilan.id,
      scoreGlobal: bilan.scoreGlobal,
      isPublished: bilan.isPublished,
      pdfUrl: bilan.pdfUrl,
      publishedAt: bilan.publishedAt?.toISOString() ?? null,
      createdAt: bilan.createdAt.toISOString(),
      student: {
        firstName: bilan.student.user.firstName,
        lastName: bilan.student.user.lastName,
      },
      coach: {
        pseudonym: bilan.coach.pseudonym,
      },
    })),
  };
}

export type PublicStage = ReturnType<typeof serializePublicStage>;

export async function listPublicStages(filters?: {
  open?: boolean;
  level?: string;
  subject?: string;
}) {
  const where: Prisma.StageWhereInput = {
    isVisible: true,
  };

  if (filters?.open === true) {
    where.isOpen = true;
  }

  if (filters?.level) {
    where.level = { has: filters.level };
  }

  if (filters?.subject) {
    where.subject = { has: filters.subject as Subject };
  }

  const stages = (await prisma.stage.findMany({
    where,
    include: publicStageInclude,
    orderBy: { startDate: 'asc' },
  })) ?? [];

  return stages.map(serializePublicStage);
}

export async function getPublicStageBySlug(stageSlug: string) {
  const stage = await prisma.stage.findFirst({
    where: {
      slug: stageSlug,
      isVisible: true,
    },
    include: publicStageInclude,
  });

  return stage ? serializePublicStage(stage) : null;
}
