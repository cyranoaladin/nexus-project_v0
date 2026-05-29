export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ stageSlug: string }> }
) {
  const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
  if (sessionOrError instanceof NextResponse) return sessionOrError;

  const { stageSlug } = await params;

  try {
    const stage = await prisma.stage.findUnique({
      where: { slug: stageSlug },
      select: { id: true, slug: true, title: true },
    });
    if (!stage) {
      return NextResponse.json({ error: 'Stage introuvable' }, { status: 404 });
    }

    const reservations = await prisma.stageReservation.findMany({
      where: { stageId: stage.id },
      select: {
        id: true,
        parentName: true,
        studentName: true,
        email: true,
        phone: true,
        classe: true,
        richStatus: true,
        paymentStatus: true,
        confirmedAt: true,
        createdAt: true,
        student: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const safeStage = {
      id: stage.id,
      slug: stage.slug,
      title: stage.title,
    };

    const safeReservations = reservations.map((reservation) => ({
      id: reservation.id,
      parentName: reservation.parentName,
      studentName: reservation.studentName,
      email: reservation.email,
      phone: reservation.phone,
      classe: reservation.classe,
      richStatus: reservation.richStatus,
      paymentStatus: reservation.paymentStatus,
      confirmedAt: reservation.confirmedAt,
      createdAt: reservation.createdAt,
      student: reservation.student
        ? {
            id: reservation.student.id,
            user: reservation.student.user
              ? {
                  firstName: reservation.student.user.firstName,
                  lastName: reservation.student.user.lastName,
                }
              : null,
          }
        : null,
    }));

    return NextResponse.json({ stage: safeStage, reservations: safeReservations });
  } catch (error) {
    console.error('[GET /api/stages/[slug]/reservations]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
