export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { UserRole } from '@prisma/client';

import { isErrorResponse, requireRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { updateStageSchema } from '@/lib/stages/admin-schemas';

async function getStageById(stageId: string) {
  return prisma.stage.findUnique({
    where: { id: stageId },
    include: {
      sessions: {
        orderBy: { startAt: 'asc' },
        include: {
          coach: {
            select: {
              id: true,
              pseudonym: true,
              subjects: true,
            },
          },
          documents: true,
        },
      },
      coaches: {
        include: {
          coach: {
            select: {
              id: true,
              pseudonym: true,
              subjects: true,
              description: true,
            },
          },
        },
      },
      documents: true,
      bilans: {
        include: {
          coach: {
            select: {
              pseudonym: true,
            },
          },
          student: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
      reservations: {
        select: {
          id: true,
          email: true,
          richStatus: true,
          status: true,
        },
      },
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const session = await requireRole(UserRole.ADMIN);
  if (isErrorResponse(session)) return session;

  const { stageId } = await params;

  try {
    const stage = await getStageById(stageId);

    if (!stage) {
      return NextResponse.json({ error: 'Stage introuvable' }, { status: 404 });
    }

    return NextResponse.json({
      stage: {
        ...stage,
        priceAmount: Number(stage.priceAmount),
      },
    });
  } catch (error) {
    console.error('[GET /api/admin/stages/[stageId]]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const session = await requireRole(UserRole.ADMIN);
  if (isErrorResponse(session)) return session;

  const { stageId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
  }

  const parsed = updateStageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const payload = parsed.data;
  if (payload.startDate && payload.endDate && new Date(payload.endDate) <= new Date(payload.startDate)) {
    return NextResponse.json({ error: 'La date de fin doit être postérieure à la date de début' }, { status: 400 });
  }

  try {
    const existingStage = await prisma.stage.findUnique({ where: { id: stageId } });
    if (!existingStage) {
      return NextResponse.json({ error: 'Stage introuvable' }, { status: 404 });
    }

    if (payload.slug && payload.slug !== existingStage.slug) {
      const duplicateSlug = await prisma.stage.findUnique({ where: { slug: payload.slug } });
      if (duplicateSlug) {
        return NextResponse.json({ error: 'Un stage existe déjà avec ce slug' }, { status: 409 });
      }
    }

    const stage = await prisma.stage.update({
      where: { id: stageId },
      data: {
        ...payload,
        startDate: payload.startDate ? new Date(payload.startDate) : undefined,
        endDate: payload.endDate ? new Date(payload.endDate) : undefined,
      },
    });

    return NextResponse.json({
      stage: {
        ...stage,
        priceAmount: Number(stage.priceAmount),
      },
    });
  } catch (error) {
    console.error('[PATCH /api/admin/stages/[stageId]]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const session = await requireRole(UserRole.ADMIN);
  if (isErrorResponse(session)) return session;

  const { stageId } = await params;

  try {
    const confirmedReservations = await prisma.stageReservation.count({
      where: {
        stageId,
        OR: [
          { richStatus: 'CONFIRMED' },
          { status: 'CONFIRMED' },
        ],
      },
    });

    if (confirmedReservations > 0) {
      return NextResponse.json({
        error: 'Impossible de supprimer un stage avec des inscrits confirmés',
      }, { status: 409 });
    }

    const stage = await prisma.stage.update({
      where: { id: stageId },
      data: {
        isVisible: false,
        isOpen: false,
      },
    });

    return NextResponse.json({
      success: true,
      stage: {
        ...stage,
        priceAmount: Number(stage.priceAmount),
      },
    });
  } catch (error) {
    console.error('[DELETE /api/admin/stages/[stageId]]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
