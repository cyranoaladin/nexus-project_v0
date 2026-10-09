import type { Prisma } from '@prisma/client';

/** Pedagogical listing only: no payer, price, payment reference or activation proof. */
export const familyStageReservationSelect = {
  id: true, studentId: true, stageId: true, richStatus: true, confirmedAt: true,
  stage: { select: {
    id: true, title: true, slug: true, startDate: true, endDate: true, location: true,
    sessions: { orderBy: { startAt: 'asc' }, select: {
      id: true, title: true, subject: true, startAt: true, endAt: true, location: true,
    } },
    documents: { where: { isPublic: true }, select: { id: true, title: true, fileUrl: true, fileType: true } },
    coaches: { select: { coach: { select: { pseudonym: true } } } },
  } },
} as const satisfies Prisma.StageReservationSelect;

export const privateStageReadHeaders = {
  'Cache-Control': 'private, no-store, max-age=0', Vary: 'Cookie, Authorization',
} as const;
