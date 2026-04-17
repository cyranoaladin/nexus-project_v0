export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma, UserRole } from '@prisma/client';

import { isErrorResponse, requireAnyRole, requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { createStageSchema } from '@/lib/stages/admin-schemas';

type ReservationLike = {
  richStatus: string | null;
  status: string;
};

type StageWithRelations = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  type: string;
  subject: string[];
  level: string[];
  startDate: Date;
  endDate: Date;
  capacity: number;
  priceAmount: Prisma.Decimal | number | string;
  priceCurrency: string;
  location: string | null;
  isVisible: boolean;
  isOpen: boolean;
  reservations: ReservationLike[];
  bilans: Array<{ isPublished: boolean }>;
};

function countReservationsByStatus(reservations: ReservationLike[]) {
  return reservations.reduce<Record<string, number>>((acc, reservation) => {
    const status = reservation.richStatus ?? reservation.status ?? 'PENDING';
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {
    PENDING: 0,
    CONFIRMED: 0,
    WAITLISTED: 0,
    CANCELLED: 0,
    COMPLETED: 0,
  });
}

function serializeStage(stage: StageWithRelations) {
  const reservationCounts = countReservationsByStatus(stage.reservations ?? []);
  const confirmedCount = reservationCounts.CONFIRMED ?? 0;
  const publishedBilans = (stage.bilans ?? []).filter((bilan: { isPublished: boolean }) => bilan.isPublished).length;

  return {
    ...stage,
    priceAmount: Number(stage.priceAmount),
    reservationCounts,
    confirmedCount,
    pendingCount: reservationCounts.PENDING ?? 0,
    waitlistedCount: reservationCounts.WAITLISTED ?? 0,
    publishedBilans,
    totalBilans: (stage.bilans ?? []).length,
  };
}

export async function GET(_request: NextRequest) {
  const session = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(session)) return session;

  try {
    const stages = await prisma.stage.findMany({
      orderBy: { startDate: 'asc' },
      include: {
        reservations: {
          select: {
            richStatus: true,
            status: true,
          },
        },
        bilans: {
          select: {
            isPublished: true,
          },
        },
      },
    });

    const serializedStages = stages.map(serializeStage);
    const kpis = serializedStages.reduce((acc, stage) => {
      const confirmed = stage.confirmedCount;
      acc.activeStages += stage.isOpen ? 1 : 0;
      acc.totalInscrits += confirmed;
      acc.caEstime += confirmed * stage.priceAmount;
      acc.bilansPublies += stage.publishedBilans;
      acc.totalBilans += stage.totalBilans;
      return acc;
    }, {
      activeStages: 0,
      totalInscrits: 0,
      caEstime: 0,
      bilansPublies: 0,
      totalBilans: 0,
    });

    return NextResponse.json({ stages: serializedStages, kpis });
  } catch (error) {
    console.error('[GET /api/admin/stages]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await requireRole(UserRole.ADMIN);
  if (isErrorResponse(session)) return session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = createStageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (new Date(parsed.data.endDate) <= new Date(parsed.data.startDate)) {
    return NextResponse.json({ error: 'La date de fin doit être postérieure à la date de début' }, { status: 400 });
  }

  try {
    const existingStage = await prisma.stage.findUnique({
      where: { slug: parsed.data.slug },
    });

    if (existingStage) {
      return NextResponse.json({ error: 'Un stage existe déjà avec ce slug' }, { status: 409 });
    }

    const stage = await prisma.stage.create({
      data: {
        ...parsed.data,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
      },
    });

    return NextResponse.json({
      stage: {
        ...stage,
        priceAmount: Number(stage.priceAmount),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/admin/stages]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
