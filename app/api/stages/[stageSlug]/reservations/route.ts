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
    const stage = await prisma.stage.findUnique({ where: { slug: stageSlug } });
    if (!stage) {
      return NextResponse.json({ error: 'Stage introuvable' }, { status: 404 });
    }

    const reservations = await prisma.stageReservation.findMany({
      where: { stageId: stage.id },
      include: {
        student: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ stage, reservations });
  } catch (error) {
    console.error('[GET /api/stages/[slug]/reservations]', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
